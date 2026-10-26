@echo off
REM Deploy backend and frontend to Google Cloud Run (Windows version of deploy-cloud-run.sh)
REM The backend is private: only the frontend's service account may call it.
REM Usage: set GCP_PROJECT_ID=your-project-id ^&^& deploy.bat

setlocal enabledelayedexpansion

set PROJECT_ID=%GCP_PROJECT_ID%
set REGION=us-central1
set FRONTEND_SA=nba-frontend@%PROJECT_ID%.iam.gserviceaccount.com

if "%PROJECT_ID%"=="" (
    echo Error: GCP_PROJECT_ID environment variable not set
    echo Usage: set GCP_PROJECT_ID=your-project-id ^&^& deploy.bat
    exit /b 1
)

echo.
echo ===== NBA Prediction Model - Cloud Run Deployment =====
echo.

set ACCOUNT=
for /f "delims=" %%A in ('gcloud auth list --filter=status:ACTIVE --format="value(account)"') do set ACCOUNT=%%A
if "!ACCOUNT!"=="" call gcloud auth login
call gcloud config set project %PROJECT_ID%
call gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com

call gcloud iam service-accounts describe %FRONTEND_SA% >nul 2>&1
if errorlevel 1 call gcloud iam service-accounts create nba-frontend --display-name="NBA frontend (calls the private backend)"

echo Building and deploying nba-backend (private)...
call gcloud run deploy nba-backend --source . --region %REGION% --memory 1Gi --cpu 1 --no-allow-unauthenticated --set-env-vars PYTHONUNBUFFERED=1 --quiet || exit /b 1
call gcloud run services add-iam-policy-binding nba-backend --region %REGION% --member=serviceAccount:%FRONTEND_SA% --role=roles/run.invoker --quiet >nul || exit /b 1

for /f "delims=" %%U in ('gcloud run services describe nba-backend --region %REGION% --format "value(status.url)"') do set BACKEND_URL=%%U
echo Backend is at !BACKEND_URL! (private)

echo Building and deploying nba-frontend (public)...
call gcloud run deploy nba-frontend --source frontend --region %REGION% --memory 512Mi --cpu 1 --service-account %FRONTEND_SA% --allow-unauthenticated --set-env-vars BACKEND_URL=!BACKEND_URL! --quiet || exit /b 1

echo.
echo Deployment complete!
call gcloud run services describe nba-frontend --region %REGION% --format "value(status.url)"

endlocal
