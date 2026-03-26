from data.nba_api_client import get_team_games
from processing.features import add_features

def main():
    team_id = 1610612747  # Lakers
    
    df = get_team_games(team_id)
    df = add_features(df)
    
    print(df[['GAME_DATE', 'MATCHUP', 'WIN']].head())

if __name__ == "__main__":
    main()