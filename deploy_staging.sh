#!/bin/bash
set -e

echo "Starting deployment to agora-staging..."

# Create Namespace (idempotent)
kubectl create ns agora-staging --dry-run=client -o yaml | kubectl apply -f -

# Source environment variables
if [ -f ./agora/.env ]; then
  set -a
  source ./agora/.env
  set +a
else
  echo "Error: .env file not found at ./agora/.env"
  exit 1
fi

# Construct Staging Configs (override local localhost URLs)
STAGING_DATABASE_URL="postgresql://agora:${POSTGRES_PASSWORD}@agora-postgresql:5432/agora"
STAGING_REDIS_URL="redis://:${REDIS_PASSWORD}@agora-redis-master:6379/0"

echo "Creating secrets..."
# Create Secret with mapped keys matching deployment.yaml and values.yaml defaults
kubectl create secret generic agora-secrets \
  --from-literal=database-url="$STAGING_DATABASE_URL" \
  --from-literal=redis-url="$STAGING_REDIS_URL" \
  --from-literal=jwt-secret="$NUXT_JWT_SECRET" \
  --from-literal=gemini-api-key="$NUXT_GEMINI_API_KEY" \
  --from-literal=postgres-password="$POSTGRES_PASSWORD" \
  --from-literal=redis-password="$REDIS_PASSWORD" \
  --from-literal=minio-root-user="$MINIO_ROOT_USER" \
  --from-literal=minio-root-password="$MINIO_ROOT_PASSWORD" \
  -n agora-staging --dry-run=client -o yaml | kubectl apply -f -

echo "Installing/Upgrading Helm release..."
# Helm Upgrade
# Note: postgres-password and redis-password keys match default values.yaml configuration
helm upgrade --install agora ./helm \
  --namespace agora-staging \
  --set image.repository=docker.io/library/agora \
  --set image.tag=staging \
  --set image.pullPolicy=Never \
  --set ingress.host=vcm-51278.vm.duke.edu \
  --set ingress.pathPrefix=/agora/beta \
  --set env.NUXT_PUBLIC_BASE_URL=/agora/beta \
  --set env.NUXT_APP_BASE_URL=/agora/beta \
  --set secrets.existingSecret=agora-secrets \
  --set postgresql.auth.existingSecret=agora-secrets \
  --set redis.auth.existingSecret=agora-secrets \
  --set probes.liveness.path=/agora/beta/api/health \
  --set probes.readiness.path=/agora/beta/api/health

echo "Deployment complete! ✅"
echo "URL: https://vcm-51278.vm.duke.edu/agora/beta"
