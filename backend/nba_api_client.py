import time
import random
from nba_api.stats.endpoints import leaguegamefinder, playergamelog
from requests.exceptions import ReadTimeout

class NBAScraper:
    def __init__(self, pause_min=1.2, pause_max=3.5):
        # We use a random range so it looks more like a human browsing
        self.pause_min = pause_min
        self.pause_max = pause_max

    def safe_get_games(self, team_id):
        """
        Fetches games with a built-in sleep timer to prevent rate-limiting.
        """
        try:
            print(f"Fetching games for Team {team_id}...")
            
            # 1. The actual API call
            game_finder = leaguegamefinder.LeagueGameFinder(team_id_nullable=team_id, timeout=30)
            data = game_finder.get_data_frames()[0]

            # 2. The 'Human-like' pause
            sleep_time = random.uniform(self.pause_min, self.pause_max)
            print(f"Pausing for {sleep_time:.2f} seconds...")
            time.sleep(sleep_time)
            
            return data

        except ReadTimeout:
            print("NBA API timed out. Taking a 10-second break before retry...")
            time.sleep(10)
            return self.safe_get_games(team_id) # Recursive retry
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            return None

# --- Main Execution Block ---
if __name__ == "__main__":
    scraper = NBAScraper()
    
    # Test with a few team IDs (Lakers and Warriors)
    test_teams = ['1610612747', '1610612744'] 
    
    for team in test_teams:
        df = scraper.safe_get_games(team)
        if df is not None:
            print(f"Successfully pulled {len(df)} games for {team}.")