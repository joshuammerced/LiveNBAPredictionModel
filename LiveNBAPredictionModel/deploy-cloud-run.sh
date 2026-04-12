#!/bin/bash

# Alternative: Deploy backend to Cloud Run only (simpler, serverless)
# This is useful if you want auto-scaling without managing a Kubernetes cluster

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

gcloud services enable cloudbuild.googleapis.com cloudrun.googleapis.com

echo "Building and deploying backend to Cloud Run..."
gcloud run deploy nba-backend \
    --source . \
    --platform managed \
    --region $REGION \
    --memory 512Mi \
    --cpu 1 \
    --allow-unauthenticated \
    --set-env-vars="PYTHONUNBUFFERED=1"

echo "Building and deploying frontend to Cloud Run..."
gcloud run deploy nba-frontend \
    --source frontend \
    --platform managed \
    --region $REGION \
    --memory 256Mi \
    --cpu 1 \
    --allow-unauthenticated \
    --set-env-vars="NEXT_PUBLIC_API_URL=https://nba-backend-xxxxx.a.run.app"

echo "Deployments complete!"
gcloud run services list --platform managed --region $REGION
