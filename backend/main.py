from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datacleaining import get_upcoming_predictions

#Sean's code 
# from data.nba_api_client import NBAScraper
# from processing.features import calculate_rest_days

app = FastAPI()

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

#Sean's code
# def main():
#     team_id = '1610612747'  # Lakers (nba_api uses strings for IDs)
    
#     # Initialize the scraper class
#     scraper = NBAScraper()
    
#     # Call the correct method name
#     df = scraper.safe_get_games(team_id)
    
#     if df is not None:
#         # Use the correct function name from your features.py
#         df = calculate_rest_days(df)
#         print(df[['GAME_DATE', 'MATCHUP', 'days_since_last_game']].head())

# if __name__ == "__main__":
#     main()





