#!/bin/bash
# One-time setup: redeploy to Cloud Run automatically on every push to main.
#
# Creates a dedicated "nba-deployer" service account with only the roles a deploy needs, connects
# the GitHub repo to Cloud Build (you approve the GitHub App in a browser), and creates a trigger
# that runs cloudbuild.yaml on pushes to main.
#
# Usage: export GCP_PROJECT_ID=your-project-id && ./setup-auto-deploy.sh

set -e

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="us-central1"
REPO_URL="https://github.com/joshuammerced/LiveNBAPredictionModel.git"
CONNECTION="nba-github"
REPO_NAME="live-nba-prediction-model"
DEPLOYER="nba-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
BACKEND_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"   # backend's runtime identity
FRONTEND_SA="nba-frontend@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com \
    secretmanager.googleapis.com

echo "1/4 Deployer service account and permissions..."
if ! gcloud iam service-accounts describe "$DEPLOYER" >/dev/null 2>&1; then
    gcloud iam service-accounts create nba-deployer --display-name="Cloud Build deployer for the NBA app"
fi
for role in roles/run.admin roles/artifactregistry.writer roles/logging.logWriter; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOYER" \
        --role="$role" --condition=None --quiet >/dev/null
done
# Deploying a service "as" a runtime service account requires permission to act as it.
for sa in "$BACKEND_SA" "$FRONTEND_SA"; do
    gcloud iam service-accounts add-iam-policy-binding "$sa" --member="serviceAccount:$DEPLOYER" \
        --role=roles/iam.serviceAccountUser --quiet >/dev/null
done

echo "2/4 Connecting GitHub (opens an authorization link)..."
if ! gcloud builds connections describe "$CONNECTION" --region="$REGION" >/dev/null 2>&1; then
    gcloud builds connections create github "$CONNECTION" --region="$REGION"
    echo
    echo "Open the link above, sign in to GitHub, and install the Google Cloud Build app on the repo."
    read -r -p "Press Enter once that's done... "
fi

echo "3/4 Linking the repository..."
if ! gcloud builds repositories describe "$REPO_NAME" --connection="$CONNECTION" --region="$REGION" >/dev/null 2>&1; then
    gcloud builds repositories create "$REPO_NAME" --remote-uri="$REPO_URL" \
        --connection="$CONNECTION" --region="$REGION"
fi

echo "4/4 Creating the push-to-main trigger..."
if ! gcloud builds triggers describe deploy-main --region="$REGION" >/dev/null 2>&1; then
    gcloud builds triggers create github --name=deploy-main --region="$REGION" \
        --repository="projects/$PROJECT_ID/locations/$REGION/connections/$CONNECTION/repositories/$REPO_NAME" \
        --branch-pattern='^main$' --build-config=cloudbuild.yaml \
        --service-account="projects/$PROJECT_ID/serviceAccounts/$DEPLOYER"
fi

echo
echo "Done. Every push to main now builds and deploys both services."
echo "Watch builds: https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID"
