#!/bin/bash

# Create the project structure and files in Cloud Shell

PROJECT_DIR="LiveNBAPredictionModel"
mkdir -p "$PROJECT_DIR/backend"
mkdir -p "$PROJECT_DIR/frontend/src"
mkdir -p "$PROJECT_DIR/k8s"

cd "$PROJECT_DIR"

# Create backend Dockerfile
cat > Dockerfile << 'EOF'
# syntax=docker/dockerfile:1

# Build stage
FROM python:3.10-slim as builder

WORKDIR /app
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.10-slim

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# Create cloudbuild.yaml
cat > cloudbuild.yaml << 'EOF'
steps:
  # Build backend image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/nba-backend:latest'
      - '-f'
      - 'Dockerfile'
      - '.'

  # Push backend image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/nba-backend:latest'

  # Build frontend image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/nba-frontend:latest'
      - '-f'
      - 'frontend/Dockerfile'
      - 'frontend'

  # Push frontend image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/nba-frontend:latest'

images:
  - 'gcr.io/$PROJECT_ID/nba-backend:latest'
  - 'gcr.io/$PROJECT_ID/nba-frontend:latest'

timeout: '1800s'
EOF

# Create backend files
cat > backend/__init__.py << 'EOF'
EOF

cat > backend/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/predictions")
def predictions():
    return {
        "status": "success",
        "message": "NBA Prediction API is running",
        "predictions": []
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
EOF

cat > backend/datacleaining.py << 'EOF'
def get_upcoming_predictions():
    """Placeholder for upcoming predictions"""
    return {
        "upcoming_games": [],
        "predictions": []
    }
EOF

# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi>=0.103.0
uvicorn[standard]>=0.24.0
pandas>=2.0.0
nba_api>=1.1.8
numpy
scikit-learn
joblib
EOF

# Create .dockerignore
cat > .dockerignore << 'EOF'
__pycache__/
*.pyc
*.pyo
.venv/
venv/
env/
.env
.git
.gitignore
node_modules/
.next/
.DS_Store
EOF

# Create frontend Dockerfile
cat > frontend/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production

RUN npm ci --omit=dev

RUN addgroup -g 1001 nextjs && adduser -D -u 1001 -G nextjs nextjs
USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
EOF

cat > frontend/package.json << 'EOF'
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  }
}
EOF

mkdir -p frontend/app
cat > frontend/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main>
      <h1>NBA Prediction Model</h1>
      <p>Frontend is running</p>
    </main>
  )
}
EOF

cat > frontend/next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
EOF

cat > frontend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
EOF

echo "✓ Project structure created successfully!"
echo ""
echo "Files created:"
ls -la
echo ""
echo "Next steps:"
echo "1. cd LiveNBAPredictionModel"
echo "2. gcloud builds submit --config cloudbuild.yaml"
EOF
