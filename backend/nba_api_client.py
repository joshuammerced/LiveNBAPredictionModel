from nba_api.stats.endpoints import leaguegamefinder, playergamelog

def get_team_games(team_id):
    games = leaguegamefinder.LeagueGameFinder(team_id_nullable=team_id)
    return games.get_data_frames()[0]

def get_player_stats(player_id):
    gamelog = playergamelog.PlayerGameLog(player_id=player_id)
    return gamelog.get_data_frames()[0]