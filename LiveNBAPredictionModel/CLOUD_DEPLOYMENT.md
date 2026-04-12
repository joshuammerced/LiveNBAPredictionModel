# Quick Start: Google Cloud Deployment

## Files Created

1. **cloudbuild.yaml** - Automated image building and GKE deployment
2. **k8s/deployment.yaml** - Kubernetes manifests (deployments, services, HPA)
3. **deploy.sh** - Bash script for automated GKE deployment (macOS/Linux)
4. **deploy.bat** - Batch script for Windows deployment
5. **deploy-cloud-run.sh** - Cloud Run deployment script (simpler alternative)
6. **docker-compose.prod.yml** - Production Compose file (no volumes)
7. **DEPLOYMENT_GUIDE.md** - Comprehensive deployment documentation

---

## Quick Start (Choose One)

### Option 1: Cloud Run (Easiest - Recommended for Getting Started)
```bash
export GCP_PROJECT_ID="your-project-id"
gcloud auth login
gcloud config set project $GCP_PROJECT_ID

# Deploy backend
gcloud run deploy nba-backend \
    --source . \
    --platform managed \
    --region us-central1 \
    --memory 512Mi \
    --allow-unauthenticated

# Deploy frontend (replace URL from backend output)
gcloud run deploy nba-frontend \
    --source frontend \
    --platform managed \
    --region us-central1 \
    --memory 256Mi \
    --allow-unauthenticated \
    --set-env-vars="NEXT_PUBLIC_API_URL=https://nba-backend-xxxxx.a.run.app"
```

### Option 2: GKE (Production-Grade)
```bash
export GCP_PROJECT_ID="your-project-id"
chmod +x deploy.sh
./deploy.sh
```

### Option 3: Windows Users
```cmd
set GCP_PROJECT_ID=your-project-id
deploy.bat
```

---

## What Each File Does

### Docker Images (Already Created)
- `./Dockerfile` - Backend (Python FastAPI)
- `./frontend/Dockerfile` - Frontend (Next.js)

### Cloud Deployment
- **cloudbuild.yaml**: Automated CI/CD pipeline on Cloud Build
  - Builds both images
  - Pushes to Google Container Registry (GCR)
  - Deploys to GKE automatically

- **k8s/deployment.yaml**: Kubernetes manifests
  - 2 replicas each for backend/frontend
  - Auto-scaling (2-5 pods)
  - Health checks and probes
  - Non-root user security context
  - LoadBalancer service for frontend
  - ClusterIP service for backend

### Scripts
- **deploy.sh**: Full automated GKE setup (creates cluster, deploys everything)
- **deploy-cloud-run.sh**: Simple Cloud Run deployment
- **deploy.bat**: Windows-friendly deployment script

---

## Architecture

### GKE Architecture
```
Internet
    ↓
LoadBalancer (Port 80 → 3000)
    ↓
Frontend Pod (Replicas: 2, Auto-scale: 2-5)
    ↓
ClusterIP Service (Port 8000)
    ↓
Backend Pod (Replicas: 2, Auto-scale: 2-5)
```

### Cloud Run Architecture
```
Internet
    ↓
Cloud Run Frontend Service
    ↓
Calls Backend URL (auto-scaled, per-request billing)
    ↓
Cloud Run Backend Service (auto-scaled, per-request billing)
```

---

## Key Differences

| Aspect | Cloud Run | GKE |
|--------|-----------|-----|
| Setup Time | 5 minutes | 15-20 minutes |
| Cost Model | Pay per request | Pay per node-hour |
| Ideal For | APIs, demos, low traffic | Production apps, sustained traffic |
| Auto-scaling | Automatic (seconds) | Manual HPA setup (default included) |
| Multi-region | With Traffic Director | Multi-cluster setup |
| Network Control | Limited | Full |

---

## Next Steps After Deployment

1. **Get Your URLs**
   ```bash
   # Cloud Run
   gcloud run services list --region us-central1
   
   # GKE
   kubectl get service nba-frontend -n nba-app
   ```

2. **Monitor Application**
   ```bash
   # GKE logs
   kubectl logs -f deployment/nba-backend -n nba-app
   
   # Cloud Run logs
   gcloud run logs read nba-backend --limit 50
   ```

3. **Scale Resources**
   - Cloud Run: Settings → Memory, CPU
   - GKE: Edit `k8s/deployment.yaml` resources section

4. **Add Custom Domain**
   - Cloud Run: Service Details → Add Custom Domain
   - GKE: Use Cloud Load Balancing + Cloud Armor

5. **Set Up CI/CD**
   - Connect GitHub/GitLab to Cloud Build
   - Auto-deploy on push

---

## Estimated Costs (Per Month)

**Cloud Run (low traffic)**
- 1M requests: ~$0.40 for compute + data transfer

**GKE (3 nodes)**
- 3x n1-standard-1: ~$70/month
- Load Balancer: ~$18/month
- Total: ~$88/month (minimum, scales up with nodes)

---

## Support

For detailed instructions, see: `DEPLOYMENT_GUIDE.md`

For issues:
1. Check logs: `kubectl logs` or `gcloud run logs read`
2. Verify images pushed: `gcloud container images list`
3. Check quotas: `gcloud compute project-info describe --project=$GCP_PROJECT_ID`
