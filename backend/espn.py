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
ATHLETE_API = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes"
REGULAR_SEASON = 2
# ESPN season-type ids -> the names used in game logs (nba_api's)
SEASON_TYPES = {2: "Regular Season", 5: "PlayIn", 3: "Playoffs"}
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


def _team_schedule(espn_id, espn_season, season_type):
    data = _get(f"{SITE_API}/teams/{espn_id}/schedule", {"season": espn_season, "seasontype": season_type})
    return [(season_type, event) for event in data.get("events", [])]


def _parse_event(event, season_type):
    comp = event["competitions"][0]
    sides = {}
    for c in comp["competitors"]:
        abbr = ESPN_TEAMS.get(str(c["team"]["id"]))
        score = (c.get("score") or {}).get("value")
        sides[c["homeAway"]] = (abbr, None if score is None else int(score))
    if "home" not in sides or "away" not in sides or None in (sides["home"][0], sides["away"][0]):
        return None
    notes = [n.get("headline") for n in comp.get("notes", []) if n.get("headline")]
    return {
        "event_id": str(event["id"]),
        "season_type": SEASON_TYPES[season_type],
        "stage": notes[0] if notes else None,  # e.g. "West 1st Round - Game 3"
        "start_utc": pd.Timestamp(event["date"]),
        "state": comp["status"]["type"]["state"],  # pre / in / post
        "neutral": bool(comp.get("neutralSite")),
        "home": sides["home"][0], "away": sides["away"][0],
        "home_pts": sides["home"][1], "away_pts": sides["away"][1],
    }


def season_games(start_year):
    """Every game of the season starting in `start_year`, played and upcoming: regular season, plus
    play-in and playoffs once the postseason is near (from April 1).

    One schedule request per team per season type, deduplicated by event id, cached for 15 minutes.
    """
    def fetch():
        types = [REGULAR_SEASON]
        if pd.Timestamp.now() >= pd.Timestamp(f"{start_year + 1}-04-01"):
            types += [5, 3]
        jobs = [(team, t) for t in types for team in ESPN_TEAMS]
        with ThreadPoolExecutor(max_workers=10) as pool:
            schedules = list(pool.map(lambda job: _team_schedule(job[0], start_year + 1, job[1]), jobs))
        games = {}
        for events in schedules:
            for season_type, event in events:
                parsed = _parse_event(event, season_type)
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
                "SEASON": start_year, "SEASON_TYPE": g["season_type"],
                "TEAM_ID": NBA_TEAMS[team]["id"], "GAME_ID": f"ESPN{g['event_id']}",
                "GAME_DATE": game_date, "MATCHUP": matchup, "WL": "W" if pts > opp_pts else "L",
                "PTS": pts, "PLUS_MINUS": pts - opp_pts,
            })
    return pd.DataFrame(rows, columns=[
        "SEASON", "SEASON_TYPE", "TEAM_ID", "GAME_ID", "GAME_DATE", "MATCHUP", "WL", "PTS", "PLUS_MINUS",
    ])


def player_season_stats(start_year):
    """Season averages for every player who has played this season, best scorers first."""
    def fetch():
        data = _get(PLAYER_STATS_API, {
            "season": start_year + 1, "seasontype": REGULAR_SEASON,
            "limit": 1000, "sort": "offensive.points:desc",
        })
        names = {c["name"]: c["names"] for c in data.get("categories", [])}
        players = []
        for entry in data.get("athletes", []):
            athlete = entry["athlete"]
            abbr = ESPN_TEAMS.get(str(athlete.get("teamId")))
            if not abbr:
                continue
            stats = {}
            for cat in entry.get("categories", []):
                stats.update(zip(names.get(cat["name"], []), cat.get("values", [])))
            players.append({"id": str(athlete["id"]), "name": athlete["displayName"], "team": abbr, "stats": stats})
        return players

    return _cached(("players", start_year), fetch)


def top_scorers(start_year):
    """Each team's leading scorer this season (by total points): name and per-game averages."""
    leaders = {}
    for p in player_season_stats(start_year):
        if p["team"] in leaders:
            continue
        stats = p["stats"]
        fga = stats.get("fieldGoalsAttempted") or 0
        efg = (stats.get("fieldGoalsMade", 0) + 0.5 * stats.get("threePointFieldGoalsMade", 0)) / fga if fga else 0
        leaders[p["team"]] = {
            "team": NBA_TEAMS[p["team"]]["full_name"],
            "name": p["name"],
            "pts_per_game": round(float(stats.get("avgPoints", 0)), 1),
            "ast_per_game": round(float(stats.get("avgAssists", 0)), 1),
            "reb_per_game": round(float(stats.get("avgRebounds", 0)), 1),
            "efg": f"{efg * 100:.1f}%",
        }
    return leaders


GAMELOG_STATS = {  # ESPN game-log column -> our stat
    "points": "PTS", "totalRebounds": "REB", "assists": "AST", "steals": "STL", "blocks": "BLK", "turnovers": "TOV",
}


def _player_gamelog(athlete_id, espn_season):
    data = _get(f"{ATHLETE_API}/{athlete_id}/gamelog", {"season": espn_season})
    names = data.get("names", [])
    dates = {eid: e.get("gameDate") for eid, e in data.get("events", {}).items()}
    rows = []
    for season_type in data.get("seasonTypes", []):
        if "Preseason" in season_type.get("displayName", ""):
            continue
        for category in season_type.get("categories", []):
            for game in category.get("events", []):
                values = dict(zip(names, game.get("stats", [])))
                minutes = float(values.get("minutes") or 0)
                if minutes <= 0 or not dates.get(game["eventId"]):
                    continue
                row = {ours: float(values.get(theirs) or 0) for theirs, ours in GAMELOG_STATS.items()}
                threes = values.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted", "0-0")
                row["FG3M"] = float(threes.split("-")[0] or 0)
                row["GAME_DATE"] = pd.Timestamp(dates[game["eventId"]])
                row["SEASON"] = espn_season - 1
                row["EVENT_ID"] = game["eventId"]
                rows.append(row)
    return rows


def player_games(athlete_id, start_year):
    """A player's games from this season and last (regular season + playoffs), oldest first."""
    def fetch():
        rows = _player_gamelog(athlete_id, start_year + 1) + _player_gamelog(athlete_id, start_year)
        df = pd.DataFrame(rows)
        if df.empty:
            return df
        return df.drop_duplicates("EVENT_ID").sort_values("GAME_DATE").reset_index(drop=True)

    return _cached(("gamelog", athlete_id, start_year), fetch)
