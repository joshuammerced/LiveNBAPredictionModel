import json
import os
import time
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from nba_api.stats.static import teams as static_teams

try:
    from backend.features import build_features
    from backend.game_data import current_season_start_year, fetch_team_logs
except ImportError:
    from features import build_features
    from game_data import current_season_start_year, fetch_team_logs

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.json")
HISTORY_SEASONS = 3          # enough history for Elo to settle and 30-game windows to fill
LOGS_CACHE_SECONDS = 3600
ELO_HISTORY_POINTS = 60

_model = None
_logs_cache = {"logs": None, "fetched_at": 0.0}
_snapshot_cache = {"teams": None, "logs_fetched_at": None}


def load_model():
    global _model
    if _model is None:
        with open(MODEL_PATH) as f:
            _model = json.load(f)
    return _model


def recent_team_logs():
    if time.time() - _logs_cache["fetched_at"] > LOGS_CACHE_SECONDS:
        start = current_season_start_year()
        _logs_cache["logs"] = fetch_team_logs(range(start - HISTORY_SEASONS + 1, start + 1))
        _logs_cache["fetched_at"] = time.time()
    return _logs_cache["logs"]


def _upcoming_games(matchups):
    """Run (home_id, away_id, date) tuples through the feature pipeline; returns (all games, upcoming rows in order)."""
    upcoming = pd.DataFrame(matchups, columns=["HOME_TEAM_ID", "AWAY_TEAM_ID", "GAME_DATE"])
    dates = pd.to_datetime(upcoming["GAME_DATE"])
    if dates.dt.tz is not None:
        dates = dates.dt.tz_localize(None)  # game logs use plain (Eastern) dates
    upcoming["GAME_DATE"] = dates.dt.normalize()
    upcoming["SEASON"] = current_season_start_year()

    games = build_features(recent_team_logs(), upcoming)
    rows = games[games["IS_UPCOMING"]].set_index("GAME_ID")
    return games, rows.loc[[f"UPCOMING_{i}" for i in range(len(upcoming))]]


def _score(rows):
    """Home win probabilities, plus each feature's log-odds contribution measured from an even matchup
    (all differences zero). What's left over, `baseline`, is the model's home-court edge."""
    model = load_model()
    coef = np.array(model["coef"]) / np.array(model["scale"])
    baseline = model["intercept"] - float(coef @ np.array(model["mean"]))

    x = rows[model["features"]].astype(float).fillna(0).to_numpy()
    contributions = x * coef
    z = contributions.sum(axis=1) + baseline
    return 1 / (1 + np.exp(-z)), contributions, baseline


def predict_home_win_probs(matchups):
    """matchups: list of (home_team_id, away_team_id, game_date). Returns home win probabilities in order."""
    if not matchups:
        return []
    _, rows = _upcoming_games(matchups)
    probs, _, _ = _score(rows)
    return probs.round(3).tolist()


def next_game_date():
    """Hypothetical matchups are scored as if played tomorrow, so rest days are realistic."""
    return datetime.now() + timedelta(days=1)


def predict_matchup(home_id, away_id, game_date=None):
    _, rows = _upcoming_games([(home_id, away_id, game_date or next_game_date())])
    probs, contributions, baseline = _score(rows)
    model = load_model()
    row = rows.iloc[0]

    factors = [{"feature": "HOME_COURT", "value": None, "contribution": round(baseline, 4)}]
    factors += [
        {"feature": f, "value": round(float(row[f]), 2), "contribution": round(float(c), 4)}
        for f, c in zip(model["features"], contributions[0])
    ]
    return {"home_team_id": int(home_id), "away_team_id": int(away_id),
            "home_win_prob": round(float(probs[0]), 3), "factors": factors}


def _parse_matchup(matchup):
    # "LAL vs. GSW" (home) or "LAL @ GSW" (away)
    return matchup.split()[-1], " vs. " in matchup


def league_snapshot():
    """Current state of all 30 teams: the same Elo / rolling ratings / rest the model would use
    for a game tomorrow, plus record, last 10 games and recent Elo history."""
    logs = recent_team_logs()
    if _snapshot_cache["teams"] is not None and _snapshot_cache["logs_fetched_at"] == _logs_cache["fetched_at"]:
        return _snapshot_cache["teams"]

    team_info = sorted(static_teams.get_teams(), key=lambda t: t["id"])
    ids = [t["id"] for t in team_info]
    half = len(ids) // 2
    game_date = next_game_date()
    # Pair every team into a hypothetical game tomorrow so each gets its current pre-game features.
    games, rows = _upcoming_games([(ids[i], ids[i + half], game_date) for i in range(half)])

    state = {}
    for _, r in rows.iterrows():
        for side in ("HOME", "AWAY"):
            state[int(r[f"{side}_TEAM_ID"])] = {
                "elo": r[f"{side}_ELO"], "net_rtg_10": r[f"{side}_NET_RTG_10"],
                "net_rtg_30": r[f"{side}_NET_RTG_30"], "rest_days": r[f"{side}_REST_DAYS"],
            }

    played = games[~games["IS_UPCOMING"]]
    season = current_season_start_year()
    out = []
    for t in team_info:
        tid = t["id"]
        s = state[tid]
        team_logs = logs[logs["TEAM_ID"] == tid].sort_values("GAME_DATE")

        def record(year):
            season_logs = team_logs[team_logs["SEASON"] == year]
            return {"wins": int((season_logs["WL"] == "W").sum()), "losses": int((season_logs["WL"] == "L").sum())}

        last10 = []
        for g in team_logs.tail(10).itertuples():
            opp, is_home = _parse_matchup(g.MATCHUP)
            last10.append({
                "date": g.GAME_DATE.strftime("%Y-%m-%d"), "opponent": opp, "home": is_home,
                "result": g.WL, "pts": int(g.PTS), "opp_pts": int(g.PTS - g.PLUS_MINUS),
            })

        team_games = played[(played["HOME_TEAM_ID"] == tid) | (played["AWAY_TEAM_ID"] == tid)]
        elo_series = np.where(team_games["HOME_TEAM_ID"] == tid, team_games["HOME_ELO"], team_games["AWAY_ELO"])
        elo_history = [{"date": d.strftime("%Y-%m-%d"), "elo": round(float(e), 1)}
                       for d, e in zip(team_games["GAME_DATE"], elo_series)]
        elo_history.append({"date": game_date.strftime("%Y-%m-%d"), "elo": round(float(s["elo"]), 1)})

        out.append({
            "id": tid, "abbr": t["abbreviation"], "name": t["full_name"],
            "city": t["city"], "nickname": t["nickname"],
            "elo": round(float(s["elo"]), 1),
            "net_rtg_10": None if pd.isna(s["net_rtg_10"]) else round(float(s["net_rtg_10"]), 1),
            "net_rtg_30": None if pd.isna(s["net_rtg_30"]) else round(float(s["net_rtg_30"]), 1),
            "rest_days": int(s["rest_days"]),
            "record": record(season), "last_season_record": record(season - 1),
            "last10": last10[::-1],
            "elo_history": elo_history[-ELO_HISTORY_POINTS:],
        })

    for rank, team in enumerate(sorted(out, key=lambda t: -t["elo"]), start=1):
        team["elo_rank"] = rank

    _snapshot_cache.update(teams=out, logs_fetched_at=_logs_cache["fetched_at"])
    return out
