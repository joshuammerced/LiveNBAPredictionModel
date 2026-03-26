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