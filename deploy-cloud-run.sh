#!/bin/bash

# Deploy backend and frontend to Google Cloud Run (Windows: deploy.bat).
# The backend is private: only the frontend's service account may call it.
# The frontend is public and attaches an identity token to each backend request.

set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="us-central1"
FRONTEND_SA="nba-frontend@${PROJECT_ID}.iam.gserviceaccount.com"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: GCP_PROJECT_ID environment variable not set"
    echo "Usage: export GCP_PROJECT_ID=your-project-id && ./deploy-cloud-run.sh"
    exit 1
fi

if [ -z "$(gcloud auth list --filter=status:ACTIVE --format='value(account)')" ]; then
    gcloud auth login
fi
gcloud config set project "$PROJECT_ID"

gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com

if ! gcloud iam service-accounts describe "$FRONTEND_SA" >/dev/null 2>&1; then
    gcloud iam service-accounts create nba-frontend --display-name="NBA frontend (calls the private backend)"
fi

echo "Building and deploying backend (private)..."
gcloud run deploy nba-backend \
    --source . \
    --region $REGION \
    --memory 1Gi \
    --cpu 1 \
    --no-allow-unauthenticated \
    --set-env-vars="PYTHONUNBUFFERED=1" \
    --quiet

gcloud run services add-iam-policy-binding nba-backend \
    --region $REGION \
    --member="serviceAccount:$FRONTEND_SA" \
    --role="roles/run.invoker" \
    --quiet >/dev/null

BACKEND_URL=$(gcloud run services describe nba-backend --region $REGION --format "value(status.url)")
echo "Backend is at $BACKEND_URL (private)"

echo "Building and deploying frontend (public)..."
gcloud run deploy nba-frontend \
    --source frontend \
    --region $REGION \
    --memory 512Mi \
    --cpu 1 \
    --service-account "$FRONTEND_SA" \
    --allow-unauthenticated \
    --set-env-vars="BACKEND_URL=$BACKEND_URL" \
    --quiet

echo "Deployments complete!"
gcloud run services describe nba-frontend --region $REGION --format "value(status.url)"
