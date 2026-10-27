# LiveNBAPredictionModel

🏀 NBA Game Outcome Predictor

Win probabilities for every upcoming NBA game from a model trained on a decade of game logs,
updated live from ESPN's public API, deployed on Google Cloud Run.

🧠 Features
📊 Live scores, schedule and player stats from ESPN's public API
🤖 Home-team win probability for every upcoming game, with a per-factor explanation
🏆 Power rankings, team pages and a matchup lab for any two teams
☁️ Deployed on Google Cloud Run
🔄 Model retrained automatically once a year (GitHub Actions)

📈 Model

A logistic regression on pre-game features: Elo rating difference, average point margin (last 10
and 30 games), rest days and back-to-backs. Trained on regular-season game logs since 2014-15
(snapshots in `backend/history/`, pulled from `nba_api`); evaluated on the most recent completed
season, which it never trained on.

The trained model is `backend/model.json`. Retrain (from the repo root):

```
pip install -r requirements.txt
python -m backend.train_model
```

📁 Where things live

| Path | What it is |
|---|---|
| `backend/model.json` | The trained model: learned weights plus held-out test scores |
| `backend/train_model.py` | Trains and evaluates the model, writes `model.json` |
| `backend/features.py` | Pre-game features: Elo, rolling point margin, rest |
| `backend/game_data.py` | Game logs: completed seasons from `backend/history/`, current season from ESPN |
| `backend/history/` | One CSV per completed season (scores only); never changes once written |
| `backend/espn.py` | Live data from ESPN: current-season results, upcoming games, top scorers |
| `backend/predictor.py` | Scores games with `model.json`; team snapshots for the site |
| `backend/schedule.py` | Upcoming games and each team's top scorer |
| `backend/main.py` | FastAPI app: `/predictions`, `/teams`, `/matchup`, `/model` |
| `frontend/` | Next.js site |
| `Dockerfile`, `frontend/Dockerfile` | Container images for the backend and frontend |
| `deploy-cloud-run.sh`, `deploy.bat`, `cloudbuild.yaml` | Google Cloud Run deployment (see [DEPLOYMENT.md](DEPLOYMENT.md)) |
| `.github/workflows/retrain-model.yml` | Yearly automatic retraining |

▶️ Running locally

With Docker: `docker compose up --build`, then open http://localhost:3000

Without Docker (two terminals):

```
uvicorn backend.main:app --reload          # API on http://localhost:8000
cd frontend && npm install && npm run dev  # site on http://localhost:3000
```

The site calls its own `/api/*` routes, which forward to the backend at `BACKEND_URL`
(default `http://localhost:8000`).

☁️ Deploying: see [DEPLOYMENT.md](DEPLOYMENT.md).
