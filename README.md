# LiveNBAPredictionModel

🏀 NBA Game Outcome Predictor (AI)

An AI-powered system that predicts NBA game outcomes and players' stats using real-time data from the NBA API, deployed on Google Cloud Run.

🚀 Overview

This project uses machine learning to predict NBA game outcomes and players' stats using historical and real-time data. It fetches game statistics from the NBA API, processes the data, and applies a trained model to generate predictions.

The application is deployed using Google Cloud Run, making it scalable and accessible via API endpoints.

🧠 Features
📊 Real-time NBA data ingestion via NBA API
🤖 AI/ML model for game outcome prediction
☁️ Cloud deployment using Google Cloud Run
⚡ Fast API responses for predictions
🔄 Automated data processing pipeline


📈 Model

Home-team win probability from a logistic regression on pre-game features: Elo rating difference,
rolling net rating (last 10 and 30 games), rest days and back-to-backs. Data is regular-season game
logs from `nba_api` (`leaguegamelog`), one call per season.

Retrain (from the repo root):

```
pip install -r requirements.txt
python -m backend.train_model
```

This writes `backend/model.json`, which the API loads to fill `win_prob`.

▶️ Running locally

With Docker: `docker compose up --build`, then open http://localhost:3000

Without Docker (two terminals):

```
uvicorn backend.main:app --reload        # API on http://localhost:8000
cd frontend && npm install && npm run dev  # site on http://localhost:3000
```

The site calls its own `/api/predictions` route, which forwards to the backend at `BACKEND_URL`
(default `http://localhost:8000`). On Cloud Run, set `BACKEND_URL` on the frontend service to the
backend's URL; `deploy-cloud-run.sh` does this automatically.