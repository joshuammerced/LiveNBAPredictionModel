# Step-by-Step Google Cloud Deployment Guide

## Overview
This guide covers deploying the NBA Prediction application to Google Cloud using:
- **Option 1: GKE (Google Kubernetes Engine)** - Recommended for production, full control
- **Option 2: Cloud Run** - Simpler, serverless option with auto-scaling

---

## Prerequisites

1. **Google Cloud Account**
   - Create at https://console.cloud.google.com
   - Set up billing

2. **Install Google Cloud SDK**
   ```bash
   # macOS
   brew install --cask google-cloud-sdk
   
   # Ubuntu/Debian
   curl https://sdk.cloud.google.com | bash
   
   # Windows
   Download from https://cloud.google.com/sdk/docs/install
   ```

3. **Install kubectl**
   ```bash
   gcloud components install kubectl
   ```

4. **Install Docker** (already done for you)

---

## Option 1: Deploy to GKE (Recommended for Production)

### Step 1: Set Environment Variables
```bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"
```

### Step 2: Authenticate with Google Cloud
```bash
gcloud auth login
gcloud config set project $GCP_PROJECT_ID
```

### Step 3: Enable Required APIs
```bash
gcloud services enable \
    cloudbuild.googleapis.com \
    container.googleapis.com \
    containerregistry.googleapis.com
```

### Step 4: Configure Docker for GCR (Google Container Registry)
```bash
gcloud auth configure-docker
```

### Step 5: Build and Push Images Manually
```bash
# Build backend image
docker build -t gcr.io/$GCP_PROJECT_ID/nba-backend:latest .
docker push gcr.io/$GCP_PROJECT_ID/nba-backend:latest

# Build frontend image
docker build -t gcr.io/$GCP_PROJECT_ID/nba-frontend:latest ./frontend
docker push gcr.io/$GCP_PROJECT_ID/nba-frontend:latest
```

**OR** use Cloud Build to automate (recommended):
```bash
gcloud builds submit --config cloudbuild.yaml
```

### Step 6: Create GKE Cluster
```bash
gcloud container clusters create nba-cluster \
    --zone us-central1-a \
    --num-nodes 3 \
    --machine-type n1-standard-1 \
    --enable-autoscaling \
    --min-nodes 2 \
    --max-nodes 5
```

### Step 7: Get Cluster Credentials
```bash
gcloud container clusters get-credentials nba-cluster --zone us-central1-a
```

### Step 8: Update Kubernetes Manifest
Replace `PROJECT_ID` in `k8s/deployment.yaml`:
```bash
sed -i "s/PROJECT_ID/$GCP_PROJECT_ID/g" k8s/deployment.yaml
```

### Step 9: Deploy to Kubernetes
```bash
kubectl apply -f k8s/deployment.yaml
```

### Step 10: Verify Deployment
```bash
# Check deployments
kubectl get deployments -n nba-app

# Check pods
kubectl get pods -n nba-app

# Check services
kubectl get services -n nba-app

# View logs
kubectl logs -f deployment/nba-backend -n nba-app
```

### Step 11: Get External IP
```bash
kubectl get service nba-frontend -n nba-app
```

The `EXTERNAL-IP` column shows your application URL.

---

## Option 2: Deploy to Cloud Run (Simpler, Serverless)

### Step 1: Set Environment Variables
```bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"
```

### Step 2: Authenticate and Enable APIs
```bash
gcloud auth login
gcloud config set project $GCP_PROJECT_ID
gcloud services enable cloudbuild.googleapis.com cloudrun.googleapis.com
```

### Step 3: Deploy Backend to Cloud Run
```bash
gcloud run deploy nba-backend \
    --source . \
    --platform managed \
    --region $GCP_REGION \
    --memory 512Mi \
    --cpu 1 \
    --allow-unauthenticated
```

This returns a URL like: `https://nba-backend-xxxxx.a.run.app`

### Step 4: Deploy Frontend to Cloud Run
Update `NEXT_PUBLIC_API_URL` with the backend URL from Step 3:
```bash
gcloud run deploy nba-frontend \
    --source frontend \
    --platform managed \
    --region $GCP_REGION \
    --memory 256Mi \
    --cpu 1 \
    --allow-unauthenticated \
    --set-env-vars="NEXT_PUBLIC_API_URL=https://nba-backend-xxxxx.a.run.app"
```

### Step 5: View Your Application
List all Cloud Run services:
```bash
gcloud run services list --region $GCP_REGION
```

Frontend URL will be displayed as `SERVICE_URL`.

---

## Comparison: GKE vs Cloud Run

| Feature | GKE | Cloud Run |
|---------|-----|-----------|
| Complexity | Higher | Lower |
| Cost | Higher (VMs always running) | Lower (pay per request) |
| Control | Full | Limited |
| Scaling | Manual HPA setup | Automatic |
| Best for | Production apps, complex workloads | APIs, simple services, dev/test |

---

## Automated Deployment Script

Run the automated deployment:
```bash
export GCP_PROJECT_ID="your-project-id"
chmod +x deploy.sh
./deploy.sh
```

---

## Monitoring and Logging

### View Logs (GKE)
```bash
kubectl logs -f deployment/nba-backend -n nba-app
kubectl logs -f deployment/nba-frontend -n nba-app
```

### View Logs (Cloud Run)
```bash
gcloud run logs read nba-backend --limit 50
gcloud run logs read nba-frontend --limit 50
```

### Monitor Pods
```bash
kubectl top nodes
kubectl top pods -n nba-app
```

---

## Updating the Application

### Update GKE Deployment
1. Rebuild Docker images locally
2. Push to GCR:
   ```bash
   docker push gcr.io/$GCP_PROJECT_ID/nba-backend:latest
   ```
3. Trigger rolling update:
   ```bash
   kubectl rollout restart deployment/nba-backend -n nba-app
   ```

### Update Cloud Run Service
```bash
gcloud run deploy nba-backend --source .
```

---

## Cleanup

### Delete GKE Cluster
```bash
gcloud container clusters delete nba-cluster --zone us-central1-a
```

### Delete Cloud Run Services
```bash
gcloud run services delete nba-backend --region us-central1
gcloud run services delete nba-frontend --region us-central1
```

### Delete Container Images
```bash
gcloud container images delete gcr.io/$GCP_PROJECT_ID/nba-backend
gcloud container images delete gcr.io/$GCP_PROJECT_ID/nba-frontend
```

---

## Troubleshooting

### Images won't push
```bash
gcloud auth configure-docker
```

### Pods won't start
```bash
kubectl describe pod <pod-name> -n nba-app
kubectl logs <pod-name> -n nba-app
```

### Can't connect to backend from frontend (GKE)
- Use internal service DNS: `http://nba-backend:8000` (already configured)
- Check network policies: `kubectl get networkpolicies -n nba-app`

### Cloud Run health checks failing
- Check logs: `gcloud run logs read SERVICE_NAME`
- Ensure health check paths exist (e.g., `/docs`, `/`)
- Verify environment variables are set

---

## Next Steps

1. **Set up CI/CD Pipeline** (GitHub Actions)
   - Auto-deploy on Git push
   - Run tests before deployment

2. **Add Custom Domain** (Cloud Run)
   - Map your domain in Cloud Run settings

3. **Set up Monitoring** (Cloud Monitoring)
   - Create dashboards
   - Set up alerts

4. **Enable HTTPS** (automatic on Cloud Run)
   - For GKE, use Cloud Load Balancing + Managed Certificates

5. **Scale Configuration** (both options)
   - Adjust resource limits
   - Configure HPA (GKE) or concurrency (Cloud Run)
