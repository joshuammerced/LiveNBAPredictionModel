import os
from typing import Annotated, Literal, Optional, Union

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Docker/Cloud Run start the app as backend.main from the repo root;
# running `uvicorn main:app` inside backend/ also works.
try:
    from backend import espn, parlay, props
    from backend.game_data import current_season_start_year
    from backend.schedule import get_upcoming_predictions
    from backend.predictor import league_snapshot, load_model, predict_matchup
except ImportError:
    import espn
    import parlay
    import props
    from game_data import current_season_start_year
    from schedule import get_upcoming_predictions
    from predictor import league_snapshot, load_model, predict_matchup

PlayerId = Annotated[str, Field(pattern=r"^\d{1,12}$")]  # ESPN athlete id; ends up in a URL path
StatKey = Literal[tuple(props.STATS)]
Line = Annotated[float, Field(ge=0, le=200)]
AmericanOdds = Annotated[int, Field(ge=-100000, le=100000)]

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
                                 "test_metrics", "baseline_metrics", "elo_only_metrics", "playoff_metrics", "game_lines")}

@app.get("/players")
def players():
    """Everyone who has played this season (or last, in the offseason), for the parlay builder."""
    season = current_season_start_year()
    rows = espn.player_season_stats(season) or espn.player_season_stats(season - 1)
    return {
        "stats": props.stat_options(),
        "players": [
            {"id": p["id"], "name": p["name"], "team": p["team"],
             "ppg": round(float(p["stats"].get("avgPoints", 0)), 1),
             "rpg": round(float(p["stats"].get("avgRebounds", 0)), 1),
             "apg": round(float(p["stats"].get("avgAssists", 0)), 1)}
            for p in rows
        ],
    }

@app.get("/prop")
def prop(player: Annotated[str, Query(pattern=r"^\d{1,12}$")], stat: StatKey,
         line: Annotated[float, Query(ge=0, le=200)]):
    try:
        return props.prop(player, stat, line)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

class PropLeg(BaseModel):
    type: Literal["prop"]
    player_id: PlayerId
    player_name: Optional[Annotated[str, Field(max_length=80)]] = None
    team: Optional[Annotated[str, Field(pattern=r"^[A-Z]{3}$")]] = None
    stat: StatKey
    line: Line
    side: Literal["over", "under"]
    odds: Optional[AmericanOdds] = None

class GameLeg(BaseModel):
    type: Literal["moneyline", "spread", "total"]
    home_id: int
    away_id: int
    pick: Optional[Literal["home", "away"]] = None      # moneyline / spread
    side: Optional[Literal["over", "under"]] = None     # total
    line: Optional[Annotated[float, Field(ge=-60, le=400)]] = None
    odds: Optional[AmericanOdds] = None

class ParlayRequest(BaseModel):
    mode: Literal["pickem", "sportsbook"]
    legs: Annotated[list[Union[PropLeg, GameLeg]], Field(min_length=1, max_length=10)]
    payout: Optional[Annotated[float, Field(gt=1, le=10000)]] = None
    flex_payouts: Optional[dict[Annotated[str, Field(pattern=r"^\d{1,2}$")], Annotated[float, Field(ge=0, le=10000)]]] = None
    parlay_odds: Optional[AmericanOdds] = None

@app.post("/parlay")
def evaluate_parlay(req: ParlayRequest):
    valid_ids = {t["id"] for t in league_snapshot()}
    legs = []
    for leg in req.legs:
        if isinstance(leg, GameLeg):
            if leg.home_id not in valid_ids or leg.away_id not in valid_ids or leg.home_id == leg.away_id:
                raise HTTPException(status_code=400, detail="Pick two different, valid teams")
            if leg.type in ("moneyline", "spread") and leg.pick is None:
                raise HTTPException(status_code=400, detail=f"A {leg.type} leg needs a pick")
            if leg.type in ("spread", "total") and leg.line is None:
                raise HTTPException(status_code=400, detail=f"A {leg.type} leg needs a line")
            if leg.type == "total" and leg.side is None:
                raise HTTPException(status_code=400, detail="A total leg needs over or under")
        legs.append(leg.model_dump())
    try:
        return parlay.evaluate(legs, req.mode, req.payout, req.flex_payouts, req.parlay_odds)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
