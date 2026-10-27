import pandas as pd

try:
    from backend.game_data import pair_games
except ImportError:
    from game_data import pair_games

FEATURES = [
    "ELO_DIFF",          # home Elo - away Elo, before the game
    "MARGIN_10_DIFF",    # average point margin, last 10 games (home - away)
    "MARGIN_30_DIFF",    # same, last 30 games
    "REST_DIFF",         # home rest days - away rest days (capped at 4)
    "HOME_B2B",          # home team on the 2nd night of a back-to-back
    "AWAY_B2B",
]

ELO_START = 1500
ELO_MEAN = 1505
ELO_K = 20
ELO_HOME_ADV = 100
ELO_SEASON_CARRYOVER = 0.75


def add_elo(games):
    """Pre-game Elo for both teams (FiveThirtyEight-style: margin-of-victory multiplier,
    25% regression to the mean between seasons). Upcoming games get a rating but don't update it."""
    ratings, last_season = {}, {}
    home_elo, away_elo = [], []

    for g in games.itertuples(index=False):
        for team in (g.HOME_TEAM_ID, g.AWAY_TEAM_ID):
            if team not in ratings:
                ratings[team] = ELO_START
            elif last_season[team] != g.SEASON:
                ratings[team] = ELO_SEASON_CARRYOVER * ratings[team] + (1 - ELO_SEASON_CARRYOVER) * ELO_MEAN
            last_season[team] = g.SEASON

        h, a = ratings[g.HOME_TEAM_ID], ratings[g.AWAY_TEAM_ID]
        home_elo.append(h)
        away_elo.append(a)

        if g.IS_UPCOMING:
            continue
        home_adv = 0 if g.NEUTRAL else ELO_HOME_ADV
        expected_home = 1 / (1 + 10 ** ((a - h - home_adv) / 400))
        margin = g.HOME_PTS - g.AWAY_PTS
        winner_edge = (h + home_adv - a) if margin > 0 else (a - h - home_adv)
        mov_mult = (abs(margin) + 3) ** 0.8 / (7.5 + 0.006 * winner_edge)
        delta = ELO_K * mov_mult * (g.HOME_WIN - expected_home)
        ratings[g.HOME_TEAM_ID] = h + delta
        ratings[g.AWAY_TEAM_ID] = a - delta

    games["HOME_ELO"] = home_elo
    games["AWAY_ELO"] = away_elo
    return games


def add_rolling_team_stats(games, team_logs):
    """Rolling point margin and rest days per team, using only games before each row.

    Point margin needs only final scores, so live data can come from any scores feed. (It tracks
    possession-adjusted net rating at r = 0.999 and gives the same held-out accuracy.)
    """
    stats = team_logs[["GAME_ID", "TEAM_ID", "PLUS_MINUS", "PTS"]].rename(columns={"PLUS_MINUS": "MARGIN"})
    stats["OPP_PTS"] = stats["PTS"] - stats["MARGIN"]

    long = pd.concat([
        games[["GAME_ID", "GAME_DATE", "HOME_TEAM_ID"]].rename(columns={"HOME_TEAM_ID": "TEAM_ID"}),
        games[["GAME_ID", "GAME_DATE", "AWAY_TEAM_ID"]].rename(columns={"AWAY_TEAM_ID": "TEAM_ID"}),
    ]).merge(stats, on=["GAME_ID", "TEAM_ID"], how="left")
    long = long.sort_values(["TEAM_ID", "GAME_DATE", "GAME_ID"])

    by_team = long.groupby("TEAM_ID")
    long["MARGIN_10"] = by_team["MARGIN"].transform(lambda s: s.shift(1).rolling(10, min_periods=3).mean())
    long["MARGIN_30"] = by_team["MARGIN"].transform(lambda s: s.shift(1).rolling(30, min_periods=5).mean())
    # Points scored / allowed, for the game-total model (not a win-probability feature)
    long["PF_20"] = by_team["PTS"].transform(lambda s: s.shift(1).rolling(20, min_periods=5).mean())
    long["PA_20"] = by_team["OPP_PTS"].transform(lambda s: s.shift(1).rolling(20, min_periods=5).mean())
    long["REST_DAYS"] = by_team["GAME_DATE"].diff().dt.days.clip(upper=4).fillna(4)

    team_cols = ["GAME_ID", "TEAM_ID", "MARGIN_10", "MARGIN_30", "PF_20", "PA_20", "REST_DAYS"]
    for side in ("HOME", "AWAY"):
        side_stats = long[team_cols].rename(columns={c: f"{side}_{c}" for c in team_cols[2:]})
        games = games.merge(
            side_stats.rename(columns={"TEAM_ID": f"{side}_TEAM_ID"}),
            on=["GAME_ID", f"{side}_TEAM_ID"], how="left",
        )
    return games


def build_features(team_logs, upcoming=None):
    """One row per game with FEATURES filled in.

    upcoming: optional DataFrame of unplayed games (HOME_TEAM_ID, AWAY_TEAM_ID, GAME_DATE, SEASON).
    They run through the exact same pipeline as historical games, so training and serving
    features are computed identically.
    """
    games = pair_games(team_logs)
    games["IS_UPCOMING"] = False

    if upcoming is not None and len(upcoming):
        upcoming = upcoming.copy()
        upcoming["GAME_ID"] = [f"UPCOMING_{i}" for i in range(len(upcoming))]
        upcoming["IS_UPCOMING"] = True
        upcoming["NEUTRAL"] = False
        games = pd.concat([games, upcoming], ignore_index=True)

    games = games.sort_values(["GAME_DATE", "IS_UPCOMING", "GAME_ID"]).reset_index(drop=True)
    games = add_elo(games)
    games = add_rolling_team_stats(games, team_logs)
    return add_matchup_features(games)


TEAM_STATE_COLUMNS = ["ELO", "MARGIN_10", "MARGIN_30", "PF_20", "PA_20", "REST_DAYS"]


def add_matchup_features(games):
    """FEATURES (and EXPECTED_TOTAL) from the HOME_*/AWAY_* team-state columns.

    Shared by the historical pipeline and by hypothetical matchups built from team snapshots.
    """
    games["ELO_DIFF"] = games["HOME_ELO"] - games["AWAY_ELO"]
    games["MARGIN_10_DIFF"] = games["HOME_MARGIN_10"] - games["AWAY_MARGIN_10"]
    games["MARGIN_30_DIFF"] = games["HOME_MARGIN_30"] - games["AWAY_MARGIN_30"]
    games["REST_DIFF"] = games["HOME_REST_DAYS"] - games["AWAY_REST_DAYS"]
    # Each side's expected points: its scoring averaged with what the opponent allows
    games["EXPECTED_TOTAL"] = (games["HOME_PF_20"] + games["AWAY_PA_20"] + games["AWAY_PF_20"] + games["HOME_PA_20"]) / 2
    games["HOME_B2B"] = (games["HOME_REST_DAYS"] == 1).astype(int)
    games["AWAY_B2B"] = (games["AWAY_REST_DAYS"] == 1).astype(int)
    return games
