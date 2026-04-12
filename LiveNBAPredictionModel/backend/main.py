from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    return {
        "status": "success",
        "predictions": [],
        "message": "No predictions available yet"
    }
