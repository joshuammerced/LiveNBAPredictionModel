# Deployment

The app runs on **Google Cloud Run** as two services built from this repo:

| Service | Built from | What it does |
|---|---|---|
| `nba-backend` | `Dockerfile` (repo root) | FastAPI: fetches NBA data, runs the model (`backend/model.json`), serves `/predictions`, `/teams`, `/matchup`, `/model` |
| `nba-frontend` | `frontend/Dockerfile` | Next.js site; its `/api/*` route forwards to the backend at `BACKEND_URL` |

Both containers listen on `$PORT`, which Cloud Run sets automatically.

**Only the frontend is public.** The backend is deployed with `--no-allow-unauthenticated`, so
Cloud Run rejects any request without a valid Google identity token. The frontend runs as the
`nba-frontend` service account, which is the only account granted `roles/run.invoker` on the
backend; its `/api/*` route fetches an identity token from the Cloud Run metadata server and
attaches it to each backend request. Locally (no `K_SERVICE` env var) no token is sent.

## Deploy by hand

Needs the [gcloud CLI](https://cloud.google.com/sdk/docs/install).

```bash
export GCP_PROJECT_ID=your-project-id
./deploy-cloud-run.sh
```

On Windows (cmd): `set GCP_PROJECT_ID=your-project-id && deploy.bat`

The script creates the `nba-frontend` service account (first run only), deploys the private
backend, grants the frontend permission to call it, then deploys the public frontend with
`BACKEND_URL` set to the backend's URL. Re-run it any time to ship a new version.

## Deploy automatically on every push (optional)

`cloudbuild.yaml` builds both images and deploys them to Cloud Run. To run it on every push to
`main`, create a trigger once in the Google Cloud console: **Cloud Build → Triggers → Create
trigger**, connect the GitHub repo, branch `^main$`, configuration file `cloudbuild.yaml`.
The Cloud Build service account needs the *Cloud Run Admin* and *Service Account User* roles.

## Updating the model

The model is retrained once a year by `.github/workflows/retrain-model.yml` (July 15, or on demand
from the Actions tab). It commits a new `backend/model.json` (and the just-completed season's
snapshot in `backend/history/`) to `main` only if the new model passes a sanity check. With the Cloud Build trigger above, that commit redeploys the site; without it,
run the deploy script.

To retrain by hand: `python -m backend.train_model`, then commit `backend/model.json`.

Predictions don't need retraining to stay current: Elo, recent form and rest are recomputed from
the latest results (cached for 15 minutes).

## Environment variables

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `BACKEND_URL` | frontend | `http://localhost:8000` | Where `/api/*` requests are forwarded |
| `ALLOWED_ORIGINS` | backend | `http://localhost:3000,http://127.0.0.1:3000` | CORS origins, comma-separated (only needed if a browser calls the backend directly) |
| `PORT` | both | `8080` backend / `3000` frontend | Set by Cloud Run |

## Running locally

- Docker: `docker compose up --build`, then open http://localhost:3000
- Without Docker: see the README.

## Data sources

stats.nba.com and cdn.nba.com block requests from cloud providers (Cloud Run, Cloud Build, and
most likely GitHub Actions), so the deployed backend never calls them:

- **Completed seasons** are committed snapshots in `backend/history/`.
- **The current season** (results, upcoming games, top scorers) comes from ESPN's public site API
  (`backend/espn.py`), cached for 15 minutes.

When a season ends, training adds it to `backend/history/` from `nba_api`, falling back to ESPN
if stats.nba.com is unreachable. ESPN's API is unofficial; if it changes, `backend/espn.py` is the
only file to update.
