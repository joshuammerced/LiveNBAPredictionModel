#!/bin/bash

# Build and push NBA backend and frontend to Google Cloud

set -e

PROJECT_ID="535607797220"
REGION="us-central1"

echo "Building and pushing NBA backend..."
docker build -t gcr.io/$PROJECT_ID/nba-backend:latest .
docker push gcr.io/$PROJECT_ID/nba-backend:latest

echo "Building and pushing NBA frontend..."
docker build -t gcr.io/$PROJECT_ID/nba-frontend:latest ./frontend
docker push gcr.io/$PROJECT_ID/nba-frontend:latest

echo ""
echo "✓ Images built and pushed successfully!"
echo ""
echo "Next, deploy to Cloud Run:"
echo ""
echo "Backend:"
echo "  gcloud run deploy nba-backend --image gcr.io/$PROJECT_ID/nba-backend:latest --platform managed --region $REGION --memory 512Mi --allow-unauthenticated"
echo ""
echo "Frontend (replace BACKEND_URL with backend service URL):"
echo "  gcloud run deploy nba-frontend --image gcr.io/$PROJECT_ID/nba-frontend:latest --platform managed --region $REGION --memory 256Mi --allow-unauthenticated --set-env-vars NEXT_PUBLIC_API_URL=https://BACKEND_URL"
