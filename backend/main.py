import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Docker/Cloud Run start the app as backend.main from the repo root;
# running `uvicorn main:app` inside backend/ also works.
try:
    from backend.schedule import get_upcoming_predictions
    from backend.predictor import league_snapshot, load_model, predict_matchup
except ImportError:
    from schedule import get_upcoming_predictions
    from predictor import league_snapshot, load_model, predict_matchup

app = FastAPI()

# Comma-separated list, e.g. set ALLOWED_ORIGINS to the deployed frontend URL on Cloud Run.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/predictions")
def predictions():
    return get_upcoming_predictions()

@app.get("/teams")
def teams():
    return league_snapshot()

@app.get("/matchup")
def matchup(home: int, away: int):
    valid_ids = {t["id"] for t in league_snapshot()}
    if home not in valid_ids or away not in valid_ids:
        raise HTTPException(status_code=400, detail="Unknown team id")
    if home == away:
        raise HTTPException(status_code=400, detail="Pick two different teams")
    return predict_matchup(home, away)

@app.get("/model")
def model():
    m = load_model()
    return {k: m[k] for k in ("features", "coef", "trained_on", "trained_at", "test_season", "test_games",
                                 "test_metrics", "baseline_metrics", "elo_only_metrics")}
