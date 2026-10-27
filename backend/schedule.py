import pandas as pd

try:
    from backend import espn
    from backend.game_data import current_season_start_year
    from backend.predictor import predict_home_win_probs
except ImportError:
    import espn
    from game_data import current_season_start_year
    from predictor import predict_home_win_probs


def upcoming_games(games):
    """Games still to tip off today (Pacific time); if there are none, tomorrow's."""
    now = pd.Timestamp.now(tz="US/Pacific")
    pending = [{**g, "local": g["start_utc"].tz_convert("US/Pacific")} for g in games if g["state"] == "pre"]

    today = [g for g in pending if g["local"].date() == now.date() and g["local"] > now]
    if today:
        return today
    tomorrow = (now + pd.Timedelta(days=1)).date()
    return [g for g in pending if g["local"].date() == tomorrow]


def get_upcoming_predictions():
    season = current_season_start_year()
    upcoming = upcoming_games(espn.season_games(season))

    try:
        scorers = espn.top_scorers(season)
    except Exception as e:
        print(f"Player stats unavailable: {e}")
        scorers = {}

    teams = espn.NBA_TEAMS
    try:
        win_probs = predict_home_win_probs([
            # Game logs use Eastern dates, so score each game on its Eastern tip-off date.
            (teams[g["home"]]["id"], teams[g["away"]]["id"], g["start_utc"].tz_convert("US/Eastern").tz_localize(None))
            for g in upcoming
        ])
    except Exception as e:
        print(f"Model prediction failed, falling back to 50/50: {e}")
        win_probs = [0.50] * len(upcoming)

    return [
        {
            "home_team": teams[g["home"]]["full_name"],
            "away_team": teams[g["away"]]["full_name"],
            "home_team_id": teams[g["home"]]["id"],
            "away_team_id": teams[g["away"]]["id"],
            "home_abbr": g["home"],
            "away_abbr": g["away"],
            "game_time": g["local"].strftime("%a, %b %d at %I:%M %p PT"),
            "season_type": g["season_type"],
            "stage": g["stage"],
            "win_prob": win_prob,
            "home_player": scorers.get(g["home"]),
            "away_player": scorers.get(g["away"]),
        }
        for g, win_prob in zip(upcoming, win_probs)
    ]


if __name__ == "__main__":
    import json
    print(json.dumps(get_upcoming_predictions(), indent=2))
