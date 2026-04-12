#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="us-central1"
CLUSTER_NAME="nba-cluster"
CLUSTER_ZONE="us-central1-a"

echo -e "${YELLOW}NBA Prediction Model - Google Cloud Deployment${NC}\n"

# Check prerequisites
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID environment variable not set${NC}"
    echo "Usage: export GCP_PROJECT_ID=your-project-id && ./deploy.sh"
    exit 1
fi

# Authenticate with Google Cloud
echo -e "${YELLOW}1. Authenticating with Google Cloud...${NC}"
gcloud auth login
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}2. Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    container.googleapis.com \
    containerregistry.googleapis.com \
    cloudrun.googleapis.com

# Create GKE cluster if it doesn't exist
echo -e "${YELLOW}3. Creating GKE cluster (if not exists)...${NC}"
if ! gcloud container clusters describe $CLUSTER_NAME --zone $CLUSTER_ZONE &>/dev/null; then
    gcloud container clusters create $CLUSTER_NAME \
        --zone $CLUSTER_ZONE \
        --num-nodes 3 \
        --machine-type n1-standard-1 \
        --enable-autoscaling \
        --min-nodes 2 \
        --max-nodes 5 \
        --enable-autorepair \
        --enable-autoupgrade
    echo -e "${GREEN}✓ GKE cluster created${NC}"
else
    echo -e "${GREEN}✓ GKE cluster already exists${NC}"
fi

# Get cluster credentials
echo -e "${YELLOW}4. Getting cluster credentials...${NC}"
gcloud container clusters get-credentials $CLUSTER_NAME --zone $CLUSTER_ZONE

# Update kubernetes manifest with correct project ID
echo -e "${YELLOW}5. Updating Kubernetes manifests...${NC}"
sed -i "s/PROJECT_ID/$PROJECT_ID/g" k8s/deployment.yaml

# Build and push images
echo -e "${YELLOW}6. Building and pushing Docker images...${NC}"
gcloud builds submit --config cloudbuild.yaml

# Deploy to GKE
echo -e "${YELLOW}7. Deploying to GKE...${NC}"
kubectl apply -f k8s/deployment.yaml

# Wait for services to be ready
echo -e "${YELLOW}8. Waiting for services to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s \
    deployment/nba-backend -n nba-app
kubectl wait --for=condition=available --timeout=300s \
    deployment/nba-frontend -n nba-app

# Get external IP
echo -e "${YELLOW}9. Getting external IP address...${NC}"
EXTERNAL_IP=$(kubectl get service nba-frontend -n nba-app -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

if [ -z "$EXTERNAL_IP" ]; then
    echo -e "${YELLOW}Waiting for LoadBalancer IP assignment...${NC}"
    sleep 30
    EXTERNAL_IP=$(kubectl get service nba-frontend -n nba-app -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
fi

echo -e "${GREEN}✓ Deployment complete!${NC}\n"
echo -e "${GREEN}Application URL: http://$EXTERNAL_IP${NC}"
echo -e "${GREEN}Backend API: http://$EXTERNAL_IP/api (via reverse proxy)${NC}\n"

echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:        kubectl logs -f deployment/nba-backend -n nba-app"
echo "  Port forward:     kubectl port-forward service/nba-backend 8000:8000 -n nba-app"
echo "  Delete deployment: kubectl delete namespace nba-app"
echo "  View pods:        kubectl get pods -n nba-app"
