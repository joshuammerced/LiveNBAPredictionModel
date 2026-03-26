import requests
from bs4 import BeautifulSoup

def scrape_standings():
    url = "https://www.espn.com/nba/standings"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    soup = BeautifulSoup(requests.get(url, headers=headers).text, "html.parser")
    teams = soup.find_all("span", class_="hide-mobile")
    
    return [team.text for team in teams]