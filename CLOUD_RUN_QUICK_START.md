# Quick deployment to Cloud Run from Cloud Shell

Run these commands in Cloud Shell:

```bash
# 1. Clone or navigate to your project
cd LiveNBAPredictionModel

# 2. Build backend image
docker build -t gcr.io/535607797220/nba-backend:latest .

# 3. Push backend image
docker push gcr.io/535607797220/nba-backend:latest

# 4. Build frontend image
docker build -t gcr.io/535607797220/nba-frontend:latest ./frontend

# 5. Push frontend image
docker push gcr.io/535607797220/nba-frontend:latest

# 6. Deploy backend to Cloud Run
gcloud run deploy nba-backend \
  --image gcr.io/535607797220/nba-backend:latest \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --allow-unauthenticated

# Copy the backend service URL from output (e.g., https://nba-backend-xxxxx.a.run.app)

# 7. Deploy frontend to Cloud Run (replace BACKEND_URL with the URL from step 6)
gcloud run deploy nba-frontend \
  --image gcr.io/535607797220/nba-frontend:latest \
  --platform managed \
  --region us-central1 \
  --memory 256Mi \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_API_URL=https://nba-backend-xxxxx.a.run.app

# 8. View your services
gcloud run services list --platform managed --region us-central1
```

**What happens at each step:**

- **Steps 2-5**: Build Docker images and push to Google Container Registry
- **Step 6**: Deploy backend API (starts accepting requests)
- **Step 7**: Deploy frontend UI (points to your backend API)
- **Step 8**: Show both running services with their URLs

**After deployment:**
- Backend API URL: `https://nba-backend-xxxxx.a.run.app`
- Frontend URL: `https://nba-frontend-xxxxx.a.run.app` → Opens in browser, calls backend API

---

## Troubleshooting

**Error: "No such image: nba-backend:latest"**
- You're in a different environment (Cloud Shell, different machine, etc.)
- Solution: Run the build commands again in that environment

**Error: "Unauthenticated request" when pushing**
- Docker not authenticated with GCR
- Solution: `gcloud auth configure-docker`

**Backend/Frontend won't start**
- Check logs: `gcloud run logs read SERVICE_NAME --limit 50`
- Common issues: Missing imports, wrong environment variables, port binding

**Can't connect frontend to backend**
- Frontend needs the full backend URL (https://..., not http://...)
- Use `--set-env-vars NEXT_PUBLIC_API_URL=https://backend-url`
