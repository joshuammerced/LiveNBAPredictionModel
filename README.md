# LiveNBAPredictionModel

🏀 NBA Game Outcome Predictor

Win probabilities for every upcoming NBA game from a model trained on a decade of game logs,
with live data from the NBA API, deployed on Google Cloud Run.

🧠 Features
📊 Live data from stats.nba.com via `nba_api`
🤖 Home-team win probability for every upcoming game, with a per-factor explanation
🏆 Power rankings, team pages and a matchup lab for any two teams
☁️ Deployed on Google Cloud Run
🔄 Model retrained automatically once a year (GitHub Actions)

📈 Model

A logistic regression on pre-game features: Elo rating difference, rolling net rating (last 10
and 30 games), rest days and back-to-backs. Trained on regular-season game logs from `nba_api`
(`leaguegamelog`); evaluated on the most recent completed season, which it never trained on.

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
| `backend/features.py` | Pre-game features: Elo, rolling net rating, rest |
| `backend/game_data.py` | Downloads and caches game logs |
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
