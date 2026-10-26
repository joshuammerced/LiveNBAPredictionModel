import os
import time
from datetime import datetime

import pandas as pd
from nba_api.stats.endpoints import leaguegamelog

CACHE_DIR = os.path.join(os.path.dirname(__file__), "data")
FETCH_ATTEMPTS = 3

LOG_COLUMNS = [
    "SEASON_ID", "TEAM_ID", "GAME_ID", "GAME_DATE", "MATCHUP", "WL",
    "FGA", "FTA", "OREB", "TOV", "PTS", "PLUS_MINUS",
]


def season_string(start_year):
    return f"{start_year}-{str(start_year + 1)[2:]}"


def current_season_start_year(now=None):
    now = now or datetime.now()
    return now.year if now.month >= 7 else now.year - 1


def fetch_season_logs(start_year, use_cache=True):
    """One row per team per game for a regular season, from a single leaguegamelog call.

    Finished seasons are cached to backend/data/ so retraining doesn't refetch them.
    The current season is always fetched fresh.
    """
    is_current = start_year >= current_season_start_year()
    cache_path = os.path.join(CACHE_DIR, f"gamelog_{start_year}.csv")

    if use_cache and not is_current and os.path.exists(cache_path):
        return pd.read_csv(cache_path, dtype={"GAME_ID": str})

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
            # stats.nba.com times out intermittently, especially from cloud IPs
            if attempt == FETCH_ATTEMPTS - 1:
                raise
            time.sleep(5 * (attempt + 1))
    df = df[LOG_COLUMNS].copy()

    if use_cache and not is_current:
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            df.to_csv(cache_path, index=False)
        except OSError:
            pass
    return df


def fetch_team_logs(start_years, use_cache=True):
    frames = []
    for i, year in enumerate(start_years):
        if i:
            time.sleep(1)  # stats.nba.com rate-limits rapid requests
        frames.append(fetch_season_logs(year, use_cache))
    logs = pd.concat(frames, ignore_index=True)
    logs["GAME_DATE"] = pd.to_datetime(logs["GAME_DATE"])
    logs["SEASON"] = logs["SEASON_ID"].astype(str).str[-4:].astype(int)
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
