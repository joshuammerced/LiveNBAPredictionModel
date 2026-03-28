import requests

def get_scoreboard():
    url = "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"
    response = requests.get(url)
    return response.json()