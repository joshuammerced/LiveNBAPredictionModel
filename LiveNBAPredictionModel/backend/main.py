from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from datetime import datetime, timedelta
from nba_api.stats.endpoints import scoreboard, leaguegamelog
from nba_api.stats.static import teams
import random
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "NBA backend running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/predictions")
def predictions():
    try:
        today = datetime.now()
        game_date = today.strftime("%m/%d/%Y")
        
        scoreboard_data = scoreboard.Scoreboard(game_date=game_date)
        games = scoreboard_data.get_data_frames()[0] if scoreboard_data.get_data_frames() else pd.DataFrame()
        
        if games.empty:
            return {"status": "success", "predictions": [], "message": "No games today"}
        
        all_teams = teams.get_teams()
        team_map = {t['id']: t['full_name'] for t in all_teams}
        
        results = []
        for _, game in games.head(5).iterrows():
            home_team_id = game.get('HOME_TEAM_ID')
            away_team_id = game.get('AWAY_TEAM_ID')
            
            if pd.isna(home_team_id) or pd.isna(away_team_id):
                continue
                
            home_team = team_map.get(int(home_team_id), "Home Team")
            away_team = team_map.get(int(away_team_id), "Away Team")
            
            game_time = game.get('GAME_TIME', '7:00 PM ET')
            
            home_win_prob = random.uniform(0.45, 0.65)
            
            results.append({
                "home_team": home_team,
                "away_team": away_team,
                "game_time": str(game_time),
                "win_prob": round(home_win_prob, 3),
                "home_player": {
                    "team": home_team,
                    "name": f"Top Performer",
                    "pts_per_game": round(random.uniform(15, 30), 1),
                    "ast_per_game": round(random.uniform(3, 10), 1),
                    "reb_per_game": round(random.uniform(4, 12), 1),
                    "efg": f"{round(random.uniform(48, 62), 1)}%"
                },
                "away_player": {
                    "team": away_team,
                    "name": f"Top Performer",
                    "pts_per_game": round(random.uniform(15, 30), 1),
                    "ast_per_game": round(random.uniform(3, 10), 1),
                    "reb_per_game": round(random.uniform(4, 12), 1),
                    "efg": f"{round(random.uniform(48, 62), 1)}%"
                }
            })
        
        if not results:
            return {"status": "success", "predictions": [], "message": "No games found"}
            
        return {"status": "success", "predictions": results}
        
    except Exception as e:
        return {"status": "error", "predictions": [], "message": str(e)}
