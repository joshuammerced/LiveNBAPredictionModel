from fastapi import FastAPI
import pandas as pd
from nba_api import get_current_season_games, get_player_stats_for_game

app = FastAPI()

# @app.get("/clean-data")
# def clean_data():
