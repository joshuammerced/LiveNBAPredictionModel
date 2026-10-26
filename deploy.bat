@echo off
REM Deploy backend and frontend to Google Cloud Run (Windows version of deploy-cloud-run.sh)
REM Usage: set GCP_PROJECT_ID=your-project-id ^&^& deploy.bat

setlocal enabledelayedexpansion

set PROJECT_ID=%GCP_PROJECT_ID%
set REGION=us-central1

if "%PROJECT_ID%"=="" (
    echo Error: GCP_PROJECT_ID environment variable not set
    echo Usage: set GCP_PROJECT_ID=your-project-id ^&^& deploy.bat
    exit /b 1
)

echo.
echo ===== NBA Prediction Model - Cloud Run Deployment =====
echo.

call gcloud auth login
call gcloud config set project %PROJECT_ID%
call gcloud services enable cloudbuild.googleapis.com run.googleapis.com

echo Building and deploying nba-backend...
call gcloud run deploy nba-backend --source . --platform managed --region %REGION% --memory 512Mi --cpu 1 --allow-unauthenticated --set-env-vars PYTHONUNBUFFERED=1 || exit /b 1

for /f "delims=" %%U in ('gcloud run services describe nba-backend --platform managed --region %REGION% --format "value(status.url)"') do set BACKEND_URL=%%U
echo Backend is at !BACKEND_URL!

echo Building and deploying nba-frontend...
call gcloud run deploy nba-frontend --source frontend --platform managed --region %REGION% --memory 256Mi --cpu 1 --allow-unauthenticated --set-env-vars BACKEND_URL=!BACKEND_URL! || exit /b 1

echo.
echo Deployment complete!
call gcloud run services list --region %REGION%

endlocal
