"""Fit the player-prop model: P(stat > line) from a player's recent games.

Run from the repo root (needs stats.nba.com, so run it locally, not in the cloud):
    python -m backend.train_props

For each stat it picks a distribution (normal, or negative binomial for low counts), fit on one
season and tested on the next: every player-game predicted only from earlier games, at several
lines around the player's average. A per-stat logistic correction fixes small calibration drift.
Writes backend/props_model.json for props.py.
"""
import json
import os
import time
from datetime import date

import numpy as np
import pandas as pd
from nba_api.stats.endpoints import leaguegamelog
from scipy import stats
from scipy.optimize import minimize_scalar
from sklearn.linear_model import LogisticRegression

try:
    from backend.game_data import current_season_start_year, season_string
    from backend.props import HALFLIFE, MIN_GAMES, STATS, prob_over
except ImportError:
    from game_data import current_season_start_year, season_string
    from props import HALFLIFE, MIN_GAMES, STATS, prob_over

MODEL_PATH = os.path.join(os.path.dirname(__file__), "props_model.json")
LINE_OFFSETS = (-2, -1, 0, 1, 2)  # test lines around each player's average, in units of STATS[...]["step"]

NBA_API_COLUMNS = {"PTS": "PTS", "REB": "REB", "AST": "AST", "FG3M": "FG3M", "STL": "STL", "BLK": "BLK", "TOV": "TOV"}


def player_logs(seasons):
    frames = []
    for y in seasons:
        df = leaguegamelog.LeagueGameLog(season=season_string(y), season_type_all_star="Regular Season",
                                         player_or_team_abbreviation="P", timeout=90).get_data_frames()[0]
        df["SEASON"] = y
        frames.append(df)
        time.sleep(1)
    df = pd.concat(frames, ignore_index=True)
    df["GAME_DATE"] = pd.to_datetime(df["GAME_DATE"])
    for stat, spec in STATS.items():
        df[stat] = sum(df[NBA_API_COLUMNS[part]] for part in spec["parts"])
    return df.sort_values(["PLAYER_ID", "GAME_DATE"]).reset_index(drop=True)


def prior_estimates(df, stat):
    """Recency-weighted mean/variance from each player's earlier games only (same as props.py)."""
    by_player = df.groupby("PLAYER_ID")[stat]
    mean = by_player.transform(lambda x: x.ewm(halflife=HALFLIFE).mean().shift(1))
    var = by_player.transform(lambda x: x.ewm(halflife=HALFLIFE).var().shift(1))
    return mean, var


def prop_outcomes(rows, stat, mean, var, dist, r):
    """(probability, outcome) pairs at lines around each player's average."""
    step = STATS[stat]["step"]
    probs, ys = [], []
    for k in LINE_OFFSETS:
        line = np.floor(mean) + 0.5 + k * step
        ok = line > 0
        probs.append(prob_over(line[ok], mean[ok], var[ok], dist, r))
        ys.append((rows[stat].to_numpy() > line)[ok])
    return np.concatenate(probs), np.concatenate(ys)


def fit_dispersion(x, mean):
    nll = lambda log_r: -stats.nbinom.logpmf(x, np.exp(log_r), np.exp(log_r) / (np.exp(log_r) + mean)).mean()
    return float(np.exp(minimize_scalar(nll, bounds=(-3, 6), method="bounded").x))


def logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def log_loss(y, p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def main():
    test_season = current_season_start_year() - 1
    fit_season = test_season - 1
    print(f"Fetching player game logs {season_string(fit_season - 1)} to {season_string(test_season)}...")
    df = player_logs(range(fit_season - 1, test_season + 1))
    df["N_PRIOR"] = df.groupby("PLAYER_ID").cumcount()

    out = {}
    for stat in STATS:
        mean, var = prior_estimates(df, stat)
        mean, var = mean.clip(lower=0.05), var.fillna(1)
        eligible = df["N_PRIOR"] >= MIN_GAMES
        fit, test = eligible & (df["SEASON"] == fit_season), eligible & (df["SEASON"] == test_season)

        def outcomes(mask, dist, r):
            return prop_outcomes(df[mask], stat, mean[mask].to_numpy(), var[mask].to_numpy(), dist, r)

        # Pick the distribution on the fit season, then fit the calibration correction there too.
        r = fit_dispersion(df.loc[fit, stat].to_numpy(), mean[fit].to_numpy())
        p_norm, y_fit = outcomes(fit, "normal", None)
        p_nb, _ = outcomes(fit, "negbin", r)
        dist = "normal" if log_loss(y_fit, p_norm) < log_loss(y_fit, p_nb) else "negbin"
        p_fit = p_norm if dist == "normal" else p_nb
        calib = LogisticRegression(C=1e6).fit(logit(p_fit)[:, None], y_fit)
        a, b = float(calib.coef_[0][0]), float(calib.intercept_[0])

        # Test on the next season, which none of the above has seen.
        p_raw, y = outcomes(test, dist, r)
        p = 1 / (1 + np.exp(-(a * logit(p_raw) + b)))
        out[stat] = {
            "dist": dist, "r": round(r, 3) if dist == "negbin" else None, "calibration": [round(a, 4), round(b, 4)],
            "test": {"log_loss": round(log_loss(y, p), 4), "brier": round(float(np.mean((p - y) ** 2)), 4),
                     "outcomes": int(len(y))},
        }
        print(f"  {stat:<6} {dist:<7} test log loss {log_loss(y, p):.4f} (uncalibrated {log_loss(y, p_raw):.4f}, "
              f"coin flip 0.6931)  n={len(y):,}")

    artifact = {
        "halflife": HALFLIFE, "min_games": MIN_GAMES, "stats": out,
        "fit_season": season_string(fit_season), "test_season": season_string(test_season),
        "trained_at": date.today().isoformat(),
    }
    with open(MODEL_PATH, "w") as f:
        json.dump(artifact, f, indent=2)
    print(f"\nSaved {MODEL_PATH}")


if __name__ == "__main__":
    main()
