import pandas as pd
from datetime import datetime
from nba_api.stats.endpoints import scheduleleaguev2, leaguedashplayerstats
from nba_api.stats.static import teams

def get_upcoming_predictions():
    now = datetime.now()
    #new season starts in October, so if it's July or later, we're in the next season
    season = f"{now.year}-{str(now.year + 1)[2:]}" if now.month >= 7 else f"{now.year - 1}-{str(now.year)[2:]}" 

    nba_teams = teams.get_teams()
    team_lookup = {team['id']: team['full_name'] for team in nba_teams}

    player_stats_call = leaguedashplayerstats.LeagueDashPlayerStats(season=season)
    all_players = player_stats_call.get_data_frames()[0]

    star_players = all_players.sort_values(by='PTS', ascending=False).drop_duplicates('TEAM_ID')
    
    def get_star_data(team_id):
        row = star_players[star_players['TEAM_ID'] == team_id]
        if row.empty:
            return None
        row = row.iloc[0]

        efg_pct = row.get('EFG_PCT', row.get('FG_PCT', 0.0))
        if pd.isna(efg_pct):
            efg_pct = 0.0

        gp = row.get('GP', 1)
        if gp == 0 or pd.isna(gp):
            gp = 1

        return {
            "team": team_lookup.get(team_id),
            "name": row['PLAYER_NAME'],
            "pts_per_game": round(float(row['PTS']) / float(gp), 1),
            "ast_per_game": round(float(row['AST']) / float(gp), 1),
            "reb_per_game": round(float(row['REB']) / float(gp), 1),
            "efg": f"{float(efg_pct) * 100:.1f}%"
        }

    sched_call = scheduleleaguev2.ScheduleLeagueV2()
    games_df = sched_call.season_games.get_data_frame()

    status_field = 'gameStatus' if 'gameStatus' in games_df.columns else 'GAME_STATUS_ID'
    date_field = 'gameDateTimeEst' if 'gameDateTimeEst' in games_df.columns else 'GAME_DATE_EST'
    home_id_field = 'homeTeam_teamId' if 'homeTeam_teamId' in games_df.columns else 'HOME_TEAM_ID'
    away_id_field = 'awayTeam_teamId' if 'awayTeam_teamId' in games_df.columns else 'VISITOR_TEAM_ID'

    games_df[date_field] = pd.to_datetime(games_df[date_field], utc=True, errors='coerce')
    now_utc = pd.Timestamp.now(tz='UTC')

    # Calculate end of today
    end_of_day = now_utc.replace(hour=23, minute=59, second=59, microsecond=999999)

    upcoming = games_df[
        (games_df.get(status_field, pd.Series([], dtype=int)).astype(float) == 1) &
        (games_df[date_field] >= now_utc) &
        (games_df[date_field] <= end_of_day)
    ]

    predictions = []
    for _, row in upcoming.iterrows():  # Remove .head(5) to get all this week
        home_id = row.get(home_id_field)
        away_id = row.get(away_id_field)
        game_datetime = row.get(date_field)
        
        # Format the game time for display
        if pd.notna(game_datetime):
            game_time_str = pd.Timestamp(game_datetime).strftime("%a, %b %d at %I:%M %p")
        else:
            game_time_str = "Time TBD"
        
        prediction = {
            "home_team": team_lookup.get(home_id),
            "away_team": team_lookup.get(away_id),
            "game_time": game_time_str,
            "win_prob": 0.50, 
            "home_player": get_star_data(home_id),
            "away_player": get_star_data(away_id)
        }
        predictions.append(prediction)

    return predictions

if __name__ == "__main__":
    import json
    results = get_upcoming_predictions()
    print(json.dumps(results, indent=2))