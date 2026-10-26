import json
import os
import time

import numpy as np
import pandas as pd

try:
    from backend.features import build_features
    from backend.game_data import current_season_start_year, fetch_team_logs
except ImportError:
    from features import build_features
    from game_data import current_season_start_year, fetch_team_logs

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.json")
HISTORY_SEASONS = 3          # enough history for Elo to settle and 30-game windows to fill
LOGS_CACHE_SECONDS = 3600

_model = None
_logs_cache = {"logs": None, "fetched_at": 0.0}


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


def predict_home_win_probs(matchups):
    """matchups: list of (home_team_id, away_team_id, game_date). Returns home win probabilities in order."""
    if not matchups:
        return []

    model = load_model()
    upcoming = pd.DataFrame(matchups, columns=["HOME_TEAM_ID", "AWAY_TEAM_ID", "GAME_DATE"])
    dates = pd.to_datetime(upcoming["GAME_DATE"])
    if dates.dt.tz is not None:
        dates = dates.dt.tz_localize(None)  # game logs use plain (Eastern) dates
    upcoming["GAME_DATE"] = dates.dt.normalize()
    upcoming["SEASON"] = current_season_start_year()

    games = build_features(recent_team_logs(), upcoming)
    rows = games[games["IS_UPCOMING"]].set_index("GAME_ID")
    rows = rows.loc[[f"UPCOMING_{i}" for i in range(len(upcoming))]]

    x = rows[model["features"]].astype(float).fillna(0).to_numpy()
    z = ((x - model["mean"]) / model["scale"]) @ np.array(model["coef"]) + model["intercept"]
    return (1 / (1 + np.exp(-z))).round(3).tolist()
