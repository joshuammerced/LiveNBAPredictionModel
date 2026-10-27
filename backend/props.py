"""Player props: the chance a player goes over a line, from his recent games.

The stat definitions and probability math here are shared with train_props.py, which fits the
per-stat settings in props_model.json and backtests them.
"""
import json
import os

import numpy as np
from scipy import stats

try:
    from backend import espn
    from backend.game_data import current_season_start_year
except ImportError:
    import espn
    from game_data import current_season_start_year

MODEL_PATH = os.path.join(os.path.dirname(__file__), "props_model.json")
HALFLIFE = 10  # games; recent games count most (half the weight after 10 games)
MIN_GAMES = 5
VAR_FLOOR = 1.0

# "parts" are summed for combo props. "step" is the line spacing used when backtesting.
STATS = {
    "PTS": {"label": "Points", "parts": ["PTS"], "step": 2},
    "REB": {"label": "Rebounds", "parts": ["REB"], "step": 1},
    "AST": {"label": "Assists", "parts": ["AST"], "step": 1},
    "FG3M": {"label": "3-pointers made", "parts": ["FG3M"], "step": 1},
    "PRA": {"label": "Pts + Reb + Ast", "parts": ["PTS", "REB", "AST"], "step": 3},
    "PR": {"label": "Pts + Reb", "parts": ["PTS", "REB"], "step": 2},
    "PA": {"label": "Pts + Ast", "parts": ["PTS", "AST"], "step": 2},
    "RA": {"label": "Reb + Ast", "parts": ["REB", "AST"], "step": 1},
    "STL": {"label": "Steals", "parts": ["STL"], "step": 1},
    "BLK": {"label": "Blocks", "parts": ["BLK"], "step": 1},
    "STOCKS": {"label": "Steals + Blocks", "parts": ["STL", "BLK"], "step": 1},
    "TOV": {"label": "Turnovers", "parts": ["TOV"], "step": 1},
}

_model = None


def load_model():
    global _model
    if _model is None:
        with open(MODEL_PATH) as f:
            _model = json.load(f)
    return _model


def prob_over(line, mean, var, dist, r):
    """P(stat > line) before calibration. Lines are x.5, so there are no pushes."""
    if dist == "normal":
        return 1 - stats.norm.cdf((line - mean) / np.sqrt(np.maximum(var, VAR_FLOOR)))
    return stats.nbinom.sf(np.floor(line), r, r / (r + mean))


def calibrated_prob_over(stat, line, mean, var):
    spec = load_model()["stats"][stat]
    p = np.clip(prob_over(np.asarray(line, float), mean, var, spec["dist"], spec["r"]), 1e-4, 1 - 1e-4)
    a, b = spec["calibration"]
    return 1 / (1 + np.exp(-(a * np.log(p / (1 - p)) + b)))


def recent_form(games, stat):
    """Recency-weighted mean and variance over a player's games (oldest first)."""
    values = games[STATS[stat]["parts"]].sum(axis=1).astype(float)
    ewm = values.ewm(halflife=HALFLIFE)
    return float(ewm.mean().iloc[-1]), float(ewm.var().iloc[-1]) if len(values) > 1 else VAR_FLOOR


def prop(player_id, stat, line):
    """Model probability for one over/under line, with the numbers behind it."""
    if stat not in STATS:
        raise ValueError(f"Unknown stat {stat}")
    games = espn.player_games(player_id, current_season_start_year())
    if len(games) < MIN_GAMES:
        raise ValueError(f"Only {len(games)} games on record; need {MIN_GAMES}")
    mean, var = recent_form(games, stat)
    p_over = float(calibrated_prob_over(stat, line, max(mean, 0.05), var))
    values = games[STATS[stat]["parts"]].sum(axis=1)
    last10 = values.tail(10)
    return {
        "stat": stat, "stat_label": STATS[stat]["label"], "line": line,
        "prob_over": round(p_over, 4), "prob_under": round(1 - p_over, 4),
        "projection": round(mean, 1),
        "games_used": int(len(games)),
        "last10": [int(v) for v in last10],
        "last10_over": int((last10 > line).sum()),
        "season_avg": round(float(values[games["SEASON"] == games["SEASON"].max()].mean()), 1),
    }


def stat_options():
    return [{"key": k, "label": v["label"]} for k, v in STATS.items()]

