@echo off
REM Windows deployment script for Google Cloud

setlocal enabledelayedexpansion

set PROJECT_ID=%GCP_PROJECT_ID%
set REGION=us-central1
set CLUSTER_NAME=nba-cluster
set CLUSTER_ZONE=us-central1-a

if "%PROJECT_ID%"=="" (
    echo Error: GCP_PROJECT_ID environment variable not set
    echo Usage: set GCP_PROJECT_ID=your-project-id ^&^& deploy.bat
    exit /b 1
)

echo.
echo ===== NBA Prediction Model - Google Cloud Deployment =====
echo.

REM Authenticate
echo 1. Authenticating with Google Cloud...
call gcloud auth login
call gcloud config set project %PROJECT_ID%

REM Enable APIs
echo 2. Enabling required APIs...
call gcloud services enable cloudbuild.googleapis.com container.googleapis.com containerregistry.googleapis.com cloudrun.googleapis.com

REM Configure Docker
echo 3. Configuring Docker for GCR...
call gcloud auth configure-docker

REM Option: Build images locally
echo.
echo Choose deployment option:
echo 1. GKE (Kubernetes) - Recommended for production
echo 2. Cloud Run - Simpler, serverless option
echo.
set /p OPTION="Enter your choice (1 or 2): "

if "%OPTION%"=="1" (
    echo Building and pushing images for GKE deployment...
    
    REM Build backend
    echo Building nba-backend...
    call docker build -t gcr.io/%PROJECT_ID%/nba-backend:latest .
    call docker push gcr.io/%PROJECT_ID%/nba-backend:latest
    
    REM Build frontend
    echo Building nba-frontend...
    call docker build -t gcr.io/%PROJECT_ID%/nba-frontend:latest ./frontend
    call docker push gcr.io/%PROJECT_ID%/nba-frontend:latest
    
    echo.
    echo Next steps:
    echo 1. Create GKE cluster:
    echo    gcloud container clusters create nba-cluster --zone us-central1-a --num-nodes 3
    echo.
    echo 2. Get credentials:
    echo    gcloud container clusters get-credentials nba-cluster --zone us-central1-a
    echo.
    echo 3. Update k8s/deployment.yaml with your PROJECT_ID
    echo.
    echo 4. Deploy:
    echo    kubectl apply -f k8s/deployment.yaml
    echo.
    
) else if "%OPTION%"=="2" (
    echo Deploying to Cloud Run...
    
    REM Deploy backend
    echo Deploying nba-backend to Cloud Run...
    call gcloud run deploy nba-backend --source . --platform managed --region %REGION% --memory 512Mi --cpu 1 --allow-unauthenticated
    
    REM Deploy frontend
    echo Deploying nba-frontend to Cloud Run...
    call gcloud run deploy nba-frontend --source frontend --platform managed --region %REGION% --memory 256Mi --cpu 1 --allow-unauthenticated
    
    echo.
    echo Deployment complete! View services:
    call gcloud run services list --region %REGION%
    
) else (
    echo Invalid option
    exit /b 1
)

endlocal
