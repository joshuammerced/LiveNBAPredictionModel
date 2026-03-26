from nba_api.stats.endpoints import leaguegamefinder
from processor import NBADataProcessor
import pandas as pd

def run_health_check():
    print("--- Starting NBA Data Pipeline Test ---")
    
    # 1. Fetch Raw Data (Using Golden State Warriors as an example: 1610612744)
    print("Step 1: Fetching raw data from nba_api...")
    game_finder = leaguegamefinder.LeagueGameFinder(team_id_nullable='1610612744')
    raw_df = game_finder.get_data_frames()[0]
    
    if raw_df.empty:
        print("Error: No data received from API. Check your connection.")
        return

    # 2. Process Data
    print("Step 2: Running NBADataProcessor (Cleaning + Rest Days)...")
    processor = NBADataProcessor(raw_df)
    clean_df = processor.clean_game_logs()

    # 3. Verify Features
    print("\n--- Pipeline Results (Sample) ---")
    # We'll look at the most recent 5 games to see the logic in action
    sample = clean_df[['GAME_DATE', 'MATCHUP', 'is_home', 'days_since_last_game', 'rest_type']].tail(5)
    print(sample)

    # 4. Final Validation
    if 'days_since_last_game' in clean_df.columns and not clean_df['is_home'].isnull().any():
        print("\n✅ SUCCESS: Data is cleaned, categorized, and ready for Phase 1.5!")
    else:
        print("\n❌ FAILURE: Some features are missing or contain null values.")

if __name__ == "__main__":
    run_health_check()