from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from datacleaining import get_upcoming_predictions

app = FastAPI()

# Allow local frontend to call this API in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/predictions")
def predictions():
    return get_upcoming_predictions()

class Playerstats(BaseModel):
    player_name: str
    ovrll_rating: int
    is_injured: bool = False
    pts_rolling_5: float = 0.0
    reb_rolling_5: float = 0.0
    ast_rolling_5: float = 0.0
    blk_rolling_5: float = 0.0
    stl_rolling_5: float = 0.0
    efg_pct_5: float = 0.0  
    ts_pct_5: float = 0.0   

class TeamStats(BaseModel):
    team_name: str
    wins: int
    losses: int
    players: list[Playerstats]




