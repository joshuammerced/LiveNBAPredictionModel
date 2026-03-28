<<<<<<< HEAD
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




=======
from data.nba_api_client import NBAScraper
from processing.features import calculate_rest_days

def main():
    team_id = '1610612747'  # Lakers (nba_api uses strings for IDs)
    
    # Initialize the scraper class
    scraper = NBAScraper()
    
    # Call the correct method name
    df = scraper.safe_get_games(team_id)
    
    if df is not None:
        # Use the correct function name from your features.py
        df = calculate_rest_days(df)
        print(df[['GAME_DATE', 'MATCHUP', 'days_since_last_game']].head())

if __name__ == "__main__":
    main()
>>>>>>> 6f3476533fff14d40e23438c038a4b377756ed7e
