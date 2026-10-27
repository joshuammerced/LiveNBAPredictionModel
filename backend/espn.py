"""Live NBA data from ESPN's public site API.

stats.nba.com and cdn.nba.com block requests from cloud providers (Cloud Run, GitHub Actions),
so everything the deployed app needs for the *current* season comes from here: game results,
the upcoming schedule, and player season stats. Completed seasons come from the snapshots in
backend/history/ (see game_data.py).
"""
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import requests
from nba_api.stats.static import teams as static_teams

SITE_API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
PLAYER_STATS_API = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete"
REGULAR_SEASON = 2
CACHE_SECONDS = 900
ATTEMPTS = 3

# ESPN team id -> NBA abbreviation (ESPN spells six of them differently: GS, NY, NO, SA, UTAH, WSH).
ESPN_TEAMS = {
    "1": "ATL", "2": "BOS", "3": "NOP", "4": "CHI", "5": "CLE", "6": "DAL", "7": "DEN", "8": "DET",
    "9": "GSW", "10": "HOU", "11": "IND", "12": "LAC", "13": "LAL", "14": "MIA", "15": "MIL",
    "16": "MIN", "17": "BKN", "18": "NYK", "19": "ORL", "20": "PHI", "21": "PHX", "22": "POR",
    "23": "SAC", "24": "SAS", "25": "OKC", "26": "UTA", "27": "WAS", "28": "TOR", "29": "MEM",
    "30": "CHA",
}
NBA_TEAMS = {t["abbreviation"]: t for t in static_teams.get_teams()}

_cache = {}


def _get(url, params=None):
    for attempt in range(ATTEMPTS):
        try:
            res = requests.get(url, params=params, timeout=20, headers={"User-Agent": "nba-prediction-lab"})
            res.raise_for_status()
            return res.json()
        except requests.RequestException:
            if attempt == ATTEMPTS - 1:
                raise
            time.sleep(2 * (attempt + 1))


def _cached(key, fetch):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    value = fetch()
    _cache[key] = (time.time(), value)
    return value


def _team_schedule(espn_id, espn_season):
    data = _get(f"{SITE_API}/teams/{espn_id}/schedule", {"season": espn_season, "seasontype": REGULAR_SEASON})
    return data.get("events", [])


def _parse_event(event):
    comp = event["competitions"][0]
    sides = {}
    for c in comp["competitors"]:
        abbr = ESPN_TEAMS.get(str(c["team"]["id"]))
        score = (c.get("score") or {}).get("value")
        sides[c["homeAway"]] = (abbr, None if score is None else int(score))
    if "home" not in sides or "away" not in sides or None in (sides["home"][0], sides["away"][0]):
        return None
    return {
        "event_id": str(event["id"]),
        "start_utc": pd.Timestamp(event["date"]),
        "state": comp["status"]["type"]["state"],  # pre / in / post
        "neutral": bool(comp.get("neutralSite")),
        "home": sides["home"][0], "away": sides["away"][0],
        "home_pts": sides["home"][1], "away_pts": sides["away"][1],
    }


def season_games(start_year):
    """Every regular-season game of the season starting in `start_year` (played and upcoming).

    30 requests (one schedule per team), deduplicated by event id, cached for 15 minutes.
    """
    def fetch():
        with ThreadPoolExecutor(max_workers=10) as pool:
            schedules = list(pool.map(lambda i: _team_schedule(i, start_year + 1), ESPN_TEAMS))
        games = {}
        for events in schedules:
            for event in events:
                parsed = _parse_event(event)
                if parsed:
                    games[parsed["event_id"]] = parsed
        return sorted(games.values(), key=lambda g: g["start_utc"])

    return _cached(("games", start_year), fetch)


def season_team_logs(start_year):
    """Finished games in the same one-row-per-team format as the nba_api snapshots."""
    rows = []
    for g in season_games(start_year):
        if g["state"] != "post" or g["home_pts"] is None or g["away_pts"] is None:
            continue
        if g["home_pts"] == 0 and g["away_pts"] == 0:
            continue  # postponed games show up as "post" with a 0-0 score
        game_date = g["start_utc"].tz_convert("US/Eastern").normalize().tz_localize(None)
        for team, opp, pts, opp_pts, is_home in (
            (g["home"], g["away"], g["home_pts"], g["away_pts"], True),
            (g["away"], g["home"], g["away_pts"], g["home_pts"], False),
        ):
            # Neutral-site games list both teams with "@", like nba_api does.
            matchup = f"{team} vs. {opp}" if is_home and not g["neutral"] else f"{team} @ {opp}"
            rows.append({
                "SEASON": start_year, "TEAM_ID": NBA_TEAMS[team]["id"], "GAME_ID": f"ESPN{g['event_id']}",
                "GAME_DATE": game_date, "MATCHUP": matchup, "WL": "W" if pts > opp_pts else "L",
                "PTS": pts, "PLUS_MINUS": pts - opp_pts,
            })
    return pd.DataFrame(rows, columns=["SEASON", "TEAM_ID", "GAME_ID", "GAME_DATE", "MATCHUP", "WL", "PTS", "PLUS_MINUS"])


def top_scorers(start_year):
    """Each team's leading scorer this season (by total points): name and per-game averages."""
    def fetch():
        data = _get(PLAYER_STATS_API, {
            "season": start_year + 1, "seasontype": REGULAR_SEASON,
            "limit": 1000, "sort": "offensive.points:desc",
        })
        names = {c["name"]: c["names"] for c in data.get("categories", [])}
        leaders = {}
        for entry in data.get("athletes", []):
            athlete = entry["athlete"]
            abbr = ESPN_TEAMS.get(str(athlete.get("teamId")))
            if not abbr or abbr in leaders:
                continue
            stats = {}
            for cat in entry.get("categories", []):
                stats.update(zip(names.get(cat["name"], []), cat.get("values", [])))
            fga = stats.get("fieldGoalsAttempted") or 0
            efg = (stats.get("fieldGoalsMade", 0) + 0.5 * stats.get("threePointFieldGoalsMade", 0)) / fga if fga else 0
            leaders[abbr] = {
                "team": NBA_TEAMS[abbr]["full_name"],
                "name": athlete["displayName"],
                "pts_per_game": round(float(stats.get("avgPoints", 0)), 1),
                "ast_per_game": round(float(stats.get("avgAssists", 0)), 1),
                "reb_per_game": round(float(stats.get("avgRebounds", 0)), 1),
                "efg": f"{efg * 100:.1f}%",
            }
        return leaders

    return _cached(("scorers", start_year), fetch)
