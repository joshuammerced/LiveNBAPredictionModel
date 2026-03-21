from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

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




