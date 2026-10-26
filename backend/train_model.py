"""Train the game outcome model.

Run from the repo root:  python -m backend.train_model

Pulls regular-season game logs with leaguegamelog, builds pre-game features, evaluates on the
most recent completed season (trained only on earlier seasons), then refits on everything and
writes backend/model.json for predictor.py.
"""
import json
import os
from datetime import date

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

try:
    from backend.features import FEATURES, build_features
    from backend.game_data import current_season_start_year, fetch_team_logs, season_string
except ImportError:
    from features import FEATURES, build_features
    from game_data import current_season_start_year, fetch_team_logs, season_string

FIRST_SEASON = 2014  # used only to warm up Elo and rolling stats; not trained on
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.json")


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


def main():
    test_season = current_season_start_year() - 1  # last completed season
    seasons = list(range(FIRST_SEASON, test_season + 1))
    print(f"Fetching {season_string(seasons[0])} through {season_string(seasons[-1])}...")
    logs = fetch_team_logs(seasons)

    games = build_features(logs)
    # Neutral-site games still feed Elo/rest/rolling stats above, but have no home team to learn from.
    games = games[(games["SEASON"] > FIRST_SEASON) & ~games["NEUTRAL"]].dropna(subset=FEATURES)
    train = games[games["SEASON"] < test_season]
    test = games[games["SEASON"] == test_season]
    print(f"Train: {len(train)} games   Test ({season_string(test_season)}): {len(test)} games\n")

    y_train, y_test = train["HOME_WIN"], test["HOME_WIN"]

    print("Held-out season results:")
    evaluate("Home team always wins", y_test, np.full(len(test), y_train.mean()))

    elo_only = make_model().fit(train[["ELO_DIFF"]], y_train)
    evaluate("Elo only", y_test, elo_only.predict_proba(test[["ELO_DIFF"]])[:, 1])

    model = make_model().fit(train[FEATURES], y_train)
    metrics = evaluate("Logistic regression", y_test, model.predict_proba(test[FEATURES])[:, 1])

    # Refit on every season, including the test season, for the model we actually serve.
    final = make_model().fit(games[FEATURES], games["HOME_WIN"])
    scaler, clf = final.named_steps["standardscaler"], final.named_steps["logisticregression"]

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
    }
    with open(MODEL_PATH, "w") as f:
        json.dump(artifact, f, indent=2)
    print(f"\nSaved {MODEL_PATH}")


if __name__ == "__main__":
    main()
