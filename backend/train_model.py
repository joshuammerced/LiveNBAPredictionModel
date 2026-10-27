"""Train the game outcome model.

Run from the repo root:  python -m backend.train_model

Loads game logs (backend/history/ snapshots), builds pre-game features, evaluates on the
most recent completed season (trained only on earlier seasons), then refits on everything and
writes backend/model.json for predictor.py.
"""
import json
import os
from datetime import date

import numpy as np
from scipy import stats
from scipy.optimize import minimize_scalar
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

try:
    from backend.features import FEATURES, build_features
    from backend.game_data import FIRST_SEASON, current_season_start_year, fetch_team_logs, season_string
except ImportError:
    from features import FEATURES, build_features
    from game_data import FIRST_SEASON, current_season_start_year, fetch_team_logs, season_string

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.json")
PLAYOFF_BACKTEST_SEASONS = 5
TOTALS_SEASONS = 5  # scoring levels drift, so the totals model uses recent seasons only


def make_model():
    return make_pipeline(StandardScaler(), LogisticRegression(C=1.0))


def evaluate(name, y_true, prob):
    print(f"  {name:<28} acc {accuracy_score(y_true, prob > 0.5):.3f}   "
          f"log loss {log_loss(y_true, prob):.4f}   brier {brier_score_loss(y_true, prob):.4f}")
    return {
        "accuracy": round(float(accuracy_score(y_true, prob > 0.5)), 4),
        "log_loss": round(float(log_loss(y_true, prob)), 4),
        "brier": round(float(brier_score_loss(y_true, prob)), 4),
    }


def playoff_backtest(games, last_season, seasons=PLAYOFF_BACKTEST_SEASONS):
    """Play-in + playoff accuracy, each season scored by a model trained only on earlier seasons.
    A single postseason is ~90 games, so pool several to get a stable number."""
    probs, ys = [], []
    for season in range(last_season - seasons + 1, last_season + 1):
        train = games[(games["SEASON"] < season) & (games["SEASON_TYPE"] == "Regular Season")]
        test = games[(games["SEASON"] == season) & (games["SEASON_TYPE"] != "Regular Season")]
        if len(test):
            probs.append(make_model().fit(train[FEATURES], train["HOME_WIN"]).predict_proba(test[FEATURES])[:, 1])
            ys.append(test["HOME_WIN"].to_numpy())
    y, p = np.concatenate(ys), np.concatenate(probs)
    print(f"\nPlay-in + playoffs, {season_string(last_season - seasons + 1)} to {season_string(last_season)} ({len(y)} games):")
    evaluate("Home team always wins", y, np.full(len(y), y.mean()))
    return {**evaluate("Logistic regression", y, p), "games": int(len(y))}


def fit_game_lines(train, win_model):
    """Spread and total distributions for parlay legs.

    Margin ~ Normal(sigma * z, sigma), z = probit of the win probability, so spreads always agree
    with the moneyline. Total ~ Normal(a + b * EXPECTED_TOTAL, sigma_total).
    """
    z = stats.norm.ppf(win_model.predict_proba(train[FEATURES])[:, 1])
    margin = (train["HOME_PTS"] - train["AWAY_PTS"]).to_numpy()
    sigma = minimize_scalar(lambda s: -stats.norm.logpdf(margin, s * z, s).sum(), bounds=(5, 25), method="bounded").x

    recent = train[train["SEASON"] > train["SEASON"].max() - TOTALS_SEASONS].dropna(subset=["EXPECTED_TOTAL"])
    total = recent["HOME_PTS"] + recent["AWAY_PTS"]
    reg = LinearRegression().fit(recent[["EXPECTED_TOTAL"]], total)
    total_sigma = float((total - reg.predict(recent[["EXPECTED_TOTAL"]])).std())
    return {"margin_sigma": round(float(sigma), 3), "total_intercept": round(float(reg.intercept_), 3),
            "total_slope": round(float(reg.coef_[0]), 4), "total_sigma": round(total_sigma, 3)}


def backtest_game_lines(train, test):
    """Log loss of spread/total over-probabilities at lines around the projection, on the test season."""
    win_model = make_model().fit(train[FEATURES], train["HOME_WIN"])
    lines = fit_game_lines(train, win_model)
    test = test.dropna(subset=["EXPECTED_TOTAL"])
    mu_margin = lines["margin_sigma"] * stats.norm.ppf(win_model.predict_proba(test[FEATURES])[:, 1])
    mu_total = lines["total_intercept"] + lines["total_slope"] * test["EXPECTED_TOTAL"].to_numpy()
    out = {}
    for name, mu, sigma, actual, offsets in (
        ("spread", mu_margin, lines["margin_sigma"], (test["HOME_PTS"] - test["AWAY_PTS"]).to_numpy(), (-6, -3, 0, 3, 6)),
        ("total", mu_total, lines["total_sigma"], (test["HOME_PTS"] + test["AWAY_PTS"]).to_numpy(), (-10, -5, 0, 5, 10)),
    ):
        y = np.concatenate([actual > np.round(mu) + 0.5 + k for k in offsets])
        p = np.concatenate([1 - stats.norm.cdf((np.round(mu) + 0.5 + k - mu) / sigma) for k in offsets])
        out[name] = round(float(log_loss(y, p)), 4)
    print(f"\nGame lines, {len(test)} test games: spread log loss {out['spread']:.4f}, "
          f"total log loss {out['total']:.4f} (coin flip 0.6931)")
    return out


def main():
    test_season = current_season_start_year() - 1  # last completed season
    seasons = list(range(FIRST_SEASON, test_season + 1))
    print(f"Fetching {season_string(seasons[0])} through {season_string(seasons[-1])}...")
    logs = fetch_team_logs(seasons)

    games = build_features(logs)
    # Neutral-site games still feed Elo/rest/rolling stats above, but have no home team to learn from.
    games = games[(games["SEASON"] > FIRST_SEASON) & ~games["NEUTRAL"]].dropna(subset=FEATURES)
    # Playoff games update Elo and form, but the model trains on the regular season: adding playoff
    # rows didn't improve held-out playoff accuracy.
    regular = games[games["SEASON_TYPE"] == "Regular Season"]
    train = regular[regular["SEASON"] < test_season]
    test = regular[regular["SEASON"] == test_season]
    print(f"Train: {len(train)} games   Test ({season_string(test_season)}): {len(test)} games\n")

    y_train, y_test = train["HOME_WIN"], test["HOME_WIN"]

    print("Held-out season results:")
    baseline_metrics = evaluate("Home team always wins", y_test, np.full(len(test), y_train.mean()))

    elo_only = make_model().fit(train[["ELO_DIFF"]], y_train)
    elo_only_metrics = evaluate("Elo only", y_test, elo_only.predict_proba(test[["ELO_DIFF"]])[:, 1])

    model = make_model().fit(train[FEATURES], y_train)
    metrics = evaluate("Logistic regression", y_test, model.predict_proba(test[FEATURES])[:, 1])

    playoff_metrics = playoff_backtest(games, test_season)
    game_line_metrics = backtest_game_lines(train, test)

    # Refit on every season, including the test season, for the model we actually serve.
    final = make_model().fit(regular[FEATURES], regular["HOME_WIN"])
    scaler, clf = final.named_steps["standardscaler"], final.named_steps["logisticregression"]
    game_lines = fit_game_lines(regular, final)

    print("\nStandardized coefficients (bigger = more influence):")
    for feature, coef in sorted(zip(FEATURES, clf.coef_[0]), key=lambda x: -abs(x[1])):
        print(f"  {feature:<18} {coef:+.3f}")

    artifact = {
        "features": FEATURES,
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "coef": clf.coef_[0].tolist(),
        "intercept": float(clf.intercept_[0]),
        "trained_on": f"{season_string(FIRST_SEASON + 1)} to {season_string(test_season)}",
        "trained_at": date.today().isoformat(),
        "test_season": season_string(test_season),
        "test_metrics": metrics,
        "baseline_metrics": baseline_metrics,
        "elo_only_metrics": elo_only_metrics,
        "test_games": len(test),
        "playoff_metrics": playoff_metrics,
        "game_lines": {**game_lines, "test_log_loss": game_line_metrics},
    }
    with open(MODEL_PATH, "w") as f:
        json.dump(artifact, f, indent=2)
    print(f"\nSaved {MODEL_PATH}")


if __name__ == "__main__":
    main()
