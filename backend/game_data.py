import os
import time
from datetime import datetime

import pandas as pd
from nba_api.stats.endpoints import leaguegamelog

try:
    from backend import espn
except ImportError:
    import espn

# Completed seasons never change, so they're committed here as snapshots. That keeps training
# reproducible and means the deployed app never has to reach stats.nba.com (which blocks cloud IPs).
HISTORY_DIR = os.path.join(os.path.dirname(__file__), "history")
FETCH_ATTEMPTS = 3
FIRST_SEASON = 2014  # history starts here; the first season only warms up Elo and rolling stats

LOG_COLUMNS = ["SEASON", "TEAM_ID", "GAME_ID", "GAME_DATE", "MATCHUP", "WL", "PTS", "PLUS_MINUS"]


def season_string(start_year):
    return f"{start_year}-{str(start_year + 1)[2:]}"


def current_season_start_year(now=None):
    now = now or datetime.now()
    return now.year if now.month >= 7 else now.year - 1


def _nba_api_season(start_year):
    for attempt in range(FETCH_ATTEMPTS):
        try:
            df = leaguegamelog.LeagueGameLog(
                season=season_string(start_year),
                season_type_all_star="Regular Season",
                player_or_team_abbreviation="T",
                timeout=60,
            ).get_data_frames()[0]
            break
        except Exception:
            if attempt == FETCH_ATTEMPTS - 1:
                raise
            time.sleep(5 * (attempt + 1))
    df["SEASON"] = start_year
    return df[LOG_COLUMNS]


def fetch_season_logs(start_year):
    """One row per team per regular-season game.

    Current season: live from ESPN. Completed seasons: the snapshot in backend/history/; if it's
    missing, it's downloaded from nba_api (or ESPN, if stats.nba.com is unreachable) and saved there.
    """
    if start_year >= current_season_start_year():
        return espn.season_team_logs(start_year)

    path = os.path.join(HISTORY_DIR, f"gamelog_{start_year}.csv")
    if os.path.exists(path):
        return pd.read_csv(path, dtype={"GAME_ID": str})

    try:
        df = _nba_api_season(start_year)
    except Exception as e:
        print(f"nba_api unavailable for {season_string(start_year)} ({e}); using ESPN instead")
        df = espn.season_team_logs(start_year)
    os.makedirs(HISTORY_DIR, exist_ok=True)
    df.to_csv(path, index=False)
    return df


def fetch_team_logs(start_years):
    logs = pd.concat([fetch_season_logs(year) for year in start_years], ignore_index=True)
    logs["GAME_DATE"] = pd.to_datetime(logs["GAME_DATE"])
    logs["GAME_ID"] = logs["GAME_ID"].astype(str)
    return logs.dropna(subset=["WL"])


def pair_games(team_logs):
    """Collapse the two team rows of each game into one row: home vs away.

    Neutral-site games (NBA Cup knockouts, international games) list both teams with "@";
    they're kept, with an arbitrary home side, and flagged NEUTRAL so Elo skips home advantage.
    """
    logs = team_logs.assign(IS_HOME=team_logs["MATCHUP"].str.contains("vs.", regex=False))
    logs = logs.sort_values(["GAME_ID", "IS_HOME", "TEAM_ID"], ascending=[True, False, True])
    first = logs.groupby("GAME_ID").cumcount() == 0
    home = logs[first]
    away = logs[~first]

    games = home[["GAME_ID", "GAME_DATE", "SEASON", "TEAM_ID", "PTS", "IS_HOME"]].merge(
        away[["GAME_ID", "TEAM_ID", "PTS"]], on="GAME_ID", suffixes=("_HOME", "_AWAY")
    )
    games = games.rename(columns={
        "TEAM_ID_HOME": "HOME_TEAM_ID", "TEAM_ID_AWAY": "AWAY_TEAM_ID",
        "PTS_HOME": "HOME_PTS", "PTS_AWAY": "AWAY_PTS",
    })
    games["NEUTRAL"] = ~games.pop("IS_HOME")
    games["HOME_WIN"] = (games["HOME_PTS"] > games["AWAY_PTS"]).astype(int)
    return games.sort_values(["GAME_DATE", "GAME_ID"]).reset_index(drop=True)
