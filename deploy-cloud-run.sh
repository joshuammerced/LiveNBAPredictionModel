#!/bin/bash

# Deploy backend and frontend to Google Cloud Run (Windows: deploy.bat).
# Builds each service from source; the frontend is pointed at the backend's URL.

set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="us-central1"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID environment variable not set"
    echo "Usage: export GCP_PROJECT_ID=your-project-id && ./deploy-cloud-run.sh"
    exit 1
fi

gcloud auth login
gcloud config set project $PROJECT_ID

gcloud services enable cloudbuild.googleapis.com run.googleapis.com

echo "Building and deploying backend to Cloud Run..."
gcloud run deploy nba-backend \
    --source . \
    --platform managed \
    --region $REGION \
    --memory 512Mi \
    --cpu 1 \
    --allow-unauthenticated \
    --set-env-vars="PYTHONUNBUFFERED=1"

BACKEND_URL=$(gcloud run services describe nba-backend --platform managed --region $REGION --format "value(status.url)")
echo "Backend is at $BACKEND_URL"

echo "Building and deploying frontend to Cloud Run..."
gcloud run deploy nba-frontend \
    --source frontend \
    --platform managed \
    --region $REGION \
    --memory 256Mi \
    --cpu 1 \
    --allow-unauthenticated \
    --set-env-vars="BACKEND_URL=$BACKEND_URL"

echo "Deployments complete!"
gcloud run services list --platform managed --region $REGION
