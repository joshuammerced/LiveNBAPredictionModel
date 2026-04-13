import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder, playergamelog
from init_db import GameLog, PlayerStat, DATABASE_URL # Import your DB setup
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

def map_and_save_games(team_id):
    # 1. Fetch data from nba_api
    game_finder = leaguegamefinder.LeagueGameFinder(team_id_nullable=team_id)
    games_dict = game_finder.get_dict()
    
    # 2. Extract headers and rows from the JSON
    headers = games_dict['resultSets'][0]['headers']
    data = games_dict['resultSets'][0]['rowSet']
    df = pd.DataFrame(data, columns=headers)

    # 3. Map API columns to your GameLog table columns
    # We rename columns to match our GameLog class in Step 1.3
    mapped_df = df[[
        'GAME_ID', 'GAME_DATE', 'TEAM_NAME', 'MATCHUP', 'PTS'
    ]].copy()
    
    # Logic to determine Home/Away from the 'MATCHUP' string (e.g., "LAL vs. GSW")
    mapped_df['home_team'] = mapped_df.apply(lambda x: x['TEAM_NAME'] if 'vs.' in x['MATCHUP'] else 'Opponent', axis=1)
    
    # 4. Save to SQL
    # 'if_exists=append' ensures we don't wipe the table every time
    mapped_df.to_sql('game_logs', engine, if_exists='append', index=False)
    print(f"Mapped and saved {len(mapped_df)} games for Team ID {team_id}")

def map_and_save_player_stats(player_id, season='2023-24'):
    # Fetch player stats for a specific season
    log = playergamelog.PlayerGameLog(player_id=player_id, season=season)
    df = log.get_data_frames()[0] # nba_api provides a helper to get DF directly

    # Select only the columns defined in our PlayerStat model
    player_stats_to_save = df[[
        'Player_ID', 'Game_ID', 'PTS', 'REB', 'AST', 'MIN'
    ]]
    
    # Standardize column names to lowercase to match our DB
    player_stats_to_save.columns = [c.lower() for c in player_stats_to_save.columns]
    
    player_stats_to_save.to_sql('player_stats', engine, if_exists='append', index=False)
    print(f"Stats for player {player_id} synced.")

if __name__ == "__main__":
    # Example: Los Angeles Lakers Team ID is 1610612747
    map_and_save_games('1610612747')