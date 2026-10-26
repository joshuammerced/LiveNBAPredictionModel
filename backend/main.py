import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Docker/Cloud Run start the app as backend.main from the repo root;
# running `uvicorn main:app` inside backend/ also works.
try:
    from backend.datacleaining import get_upcoming_predictions
except ImportError:
    from datacleaining import get_upcoming_predictions

app = FastAPI()

# Comma-separated list, e.g. set ALLOWED_ORIGINS to the deployed frontend URL on Cloud Run.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/predictions")
def predictions():
    return get_upcoming_predictions()
