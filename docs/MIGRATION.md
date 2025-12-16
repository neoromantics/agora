# Project Agora - Developer Guide

Welcome to the Agora project! This guide covers everything from setting up your local environment to understanding the production infrastructure.

---

## 1. Quick Start (Local Development)

### Prerequisites
- **Node.js** (v18+ recommended)
- **Docker** & **Docker Compose**
- **Git**

### Step-by-Step Setup

1.  **Install Dependencies**
    ```bash
    cd agora
    npm install
    # This automatically runs prisma generate and nuxt prepare
    ```

2.  **Configure Environment**
    Create a `.env` file in the `agora/` directory. Copy and paste these local defaults:
    ```env
    # Database (used by Docker Compose and Prisma)
    POSTGRES_PASSWORD=password123
    REDIS_PASSWORD=password123
    
    # App Config
    NODE_ENV=development
    DATABASE_URL=postgresql://postgres:password123@localhost:5432/agora?schema=public
    REDIS_URL=redis://:password123@localhost:6379
    JWT_SECRET=dev-secret-minimum-32-chars-length-required
    
    # Optional
    # GEMINI_API_KEY=your_key (Required for LLM features)
    # DISABLE_LLM=true (To skip LLM requirement)
    ```

3.  **Start Infrastructure**
    Start the local database and Redis containers:
    ```bash
    # From project root
    docker compose up -d postgres redis
    ```

4.  **Initialize Database**
    Run migrations and seed the database:
    ```bash
    cd agora
    npx prisma migrate dev
    npx prisma db seed
    ```

5.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Access the app at: [http://localhost:3000](http://localhost:3000)

---

## 2. Infrastructure Architecture

For production, we use a K3s Kubernetes cluster managed via Helm.

```mermaid
graph TB
    subgraph Internet
        Client[User Browser]
    end
    
    subgraph K3s Cluster
        Traefik[Traefik Ingress]
        
        subgraph Agora Namespace
            Agora[Agora Pods]
            Secrets[K8s Secret: agora-secrets]
        end
        
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis)]
    end
    
    Client --> Traefik
    Traefik -->|PathPrefix /agora| Agora
    Agora --> PostgreSQL
    Agora --> Redis
    Secrets -.->|Inject ENV| Agora
```

### Key Components
- **K3s**: Lightweight Kubernetes distribution.
- **Traefik**: Ingress controller handling SSL (Let's Encrypt) and routing.
- **Helm**: Manages the deployment charts (`helm/agora`).
- **Secrets**: Kubernetes `Secret` objects store sensitive data (never committed).

---

## 3. Configuration & Secrets

We strictly use **Environment Variables** for configuration. We have unified the codebase to use `NUXT_` prefixed variables for runtime overrides.

### Secret to Environment Variable Mapping
The application relies on the `agora-secrets` Kubernetes object. Here is the exhaustive mapping of keys to variables:

| Secret Key (`agora-secrets`) | Environment Variable (Pod) | Purpose |
|------------------------------|----------------------------|---------|
| `database-url` | `NUXT_DATABASE_URL` | **Runtime**: Application database connection |
| `database-url` | `DATABASE_URL` | **CLI**: Prisma migration usage |
| `redis-url` | `NUXT_REDIS_URL` | **Runtime**: Socket.IO & caching connection |
| `jwt-secret` | `NUXT_JWT_SECRET` | **Runtime**: Signing Auth Tokens |
| `gemini-api-key` | `NUXT_GEMINI_API_KEY` | **Runtime**: LLM API access |
| `postgres-password` | *(Internal)* | **Helm**: PostgreSQL container auth |
| `redis-password` | *(Internal)* | **Helm**: Redis container auth |

### Service Authentication via Helm
The PostgreSQL and Redis containers (managed by Bitnami charts) consume passwords directly from the secret:

1.  **Configuration**: `helm/agora/values.yaml` tells the charts to look at `agora-secrets`.
2.  **Injection**:
    *   `postgres-password` key ➔ Injected into **PostgreSQL** container.
    *   `redis-password` key ➔ Injected into **Redis** container.
    *   *Our App does not need these separately; it uses the connection strings.*

### Startup Validation
We enforce strict validation via `server/plugins/config.ts`. The server **will not start** if:
*   `NUXT_JWT_SECRET` is missing.
*   `NUXT_DATABASE_URL` is missing.
*   `NUXT_REDIS_URL` is missing.

---

## 4. Deployment Checklists

### New Server Setup
1.  **Install K3s**: `curl -sfL https://get.k3s.io | sh -`
2.  **Configure Access (kubectl)**:
    ```bash
    mkdir -p ~/.kube
    sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
    sudo chown $USER ~/.kube/config
    chmod 600 ~/.kube/config
    ```

    **3. Configure Cluster (SSL/Traefik)**:
    Apply the infrastructure config to enable Let's Encrypt:
    ```bash
    kubectl apply -f helm/k3s-traefik-config.yaml
    ```

    **Critical for Remote Access / CI/CD:**
    You must replace `127.0.0.1` with your server's **Public IP** or **Domain Name**:
    ```bash
    sed -i 's/127.0.0.1/YOUR_PUBLIC_IP_OR_DOMAIN/g' ~/.kube/config
    ```

3.  **Setup CI/CD Secret**:
    Get the base64 config for GitHub Actions:
    ```bash
    base64 ~/.kube/config | tr -d '\n'
    ```
    Add this as `KUBECONFIG` in GitHub Repository Secrets.

4.  **Create Image Pull Secret (`regcred`)**:
    Required to pull the Docker image from GHCR (if private):
    ```bash
    kubectl create namespace agora
    kubectl create secret docker-registry regcred -n agora \
      --docker-server=ghcr.io \
      --docker-username=YOUR_GITHUB_USERNAME \
      --docker-password=YOUR_GITHUB_TOKEN_OR_PAT
    ```

5.  **Create Application Secrets (`agora-secrets`)**:
    Run this block to generate passwords and create the secret. Replace `YOUR_GEMINI_KEY` strictly.
    
    ```bash
    # 1. Generate strong passwords
    PG_PASS=$(openssl rand -base64 12)
    REDIS_PASS=$(openssl rand -base64 12)
    JWT_SEC=$(openssl rand -hex 32)
    GEMINI_KEY="your-real-gemini-api-key"

    # 2. Create the secret with internal service addresses
    kubectl create secret generic agora-secrets -n agora \
      --from-literal=postgres-password=$PG_PASS \
      --from-literal=redis-password=$REDIS_PASS \
      --from-literal=database-url="postgresql://postgres:${PG_PASS}@agora-postgresql:5432/agora?schema=public" \
      --from-literal=redis-url="redis://:${REDIS_PASS}@agora-redis-master:6379" \
      --from-literal=jwt-secret=$JWT_SEC \
      --from-literal=gemini-api-key=$GEMINI_KEY
    ```

6.  **Deploy**: Use the CI/CD pipeline or run Helm manually.

### CI/CD Pipeline
The pipeline is fully automated via GitHub Actions, supporting two environments:

| Branch | Environment | URL | Namespace | Purpose |
|--------|-------------|-----|-----------|---------|
| `dev`  | **Staging** | `.../agora/beta` | `agora-staging` | Pre-production testing. Wipes/syncs allowed. |
| `main` | **Production**| `.../agora` | `agora` | Live user traffic. Stable. |

*   **Push to `dev`**: Triggers Deploy to Staging.
*   **Push to `main`**: Triggers Deploy to Production.
    > The workflow dynamically detects the branch (`dev` vs `main`) and applies the correct environment context (Namespaces, URLs, Secrets).
*   **Manual Deployment**:
    ```bash
    # Staging
    helm upgrade --install agora ./helm -n agora-staging --create-namespace --set ingress.pathPrefix=/agora/beta --set ingress.priority=100 --set ingress.stickyName=agora_staging_sticky --wait

    # Production
    helm upgrade --install agora ./helm -n agora --create-namespace --wait
    ```
    ```

### Promoting Changes to Production
Once you have verified your changes on Staging (`dev` branch):

1.  **Switch to Main**:
    ```bash
    git checkout main
    git pull origin main
    ```
2.  **Merge Dev**:
    ```bash
    git merge dev
    ```
3.  **Push to Deploy**:
    ```bash
    git push origin main
    ```
    This triggers the Production deployment pipeline automatically. It is "seamless" because the same Docker image built for dev (if unchanged) or a fresh build will be deployed to the `agora` namespace.
---


### Setting up Staging (One-Time)
To initialize the staging environment from scratch (e.g., on a new cluster):

1.  **Create Namespace**: `kubectl create namespace agora-staging`
2.  **Copy Registry Creds**:
    ```bash
    kubectl get secret regcred -n agora -o yaml | sed 's/namespace: agora/namespace: agora-staging/' | kubectl apply -f -
    ```
3.  **Create Secrets**:
    **CRITICAL**: Use hex-only passwords for Staging to avoid URL-encoding issues in connection strings.
    ```bash
    kubectl create secret generic agora-secrets -n agora-staging \
      --from-literal=postgres-password=$(openssl rand -hex 12) \
      --from-literal=redis-password=$(openssl rand -hex 12) \
      --from-literal=database-url="postgresql://postgres:pass@agora-postgresql:5432/agora_staging?schema=public" \
      --from-literal=redis-url="redis://:pass@agora-redis-master:6379" \
      --from-literal=jwt-secret=$(openssl rand -hex 32) \
      --from-literal=gemini-api-key="your-api-key"
    ```

---

## 5. Operational Tasks

### Database Sync (Prod -> Staging)
To overwrite Staging data with a snapshot of Production:

1.  **Get Credentials**:
    ```bash
    PROD_PASS=$(kubectl get secret agora-secrets -n agora -o jsonpath='{.data.postgres-password}' | base64 -d)
    STAGING_PASS=$(kubectl get secret agora-secrets -n agora-staging -o jsonpath='{.data.postgres-password}' | base64 -d)
    ```

2.  **Scale Down Staging** (Releases locks):
    ```bash
    kubectl scale deployment agora --replicas=0 -n agora-staging
    kubectl wait --for=delete pod -l app.kubernetes.io/name=agora -n agora-staging --timeout=60s
    ```

3.  **Copy Data** (Direct Pipe):
    ```bash
    kubectl exec -n agora agora-postgresql-0 -- env PGPASSWORD=$PROD_PASS pg_dump -U postgres --clean --if-exists agora | \
    kubectl exec -i -n agora-staging agora-postgresql-0 -- env PGPASSWORD=$STAGING_PASS psql -U postgres agora
    ```

4.  **Restore Staging**:
    ```bash
    kubectl scale deployment agora --replicas=1 -n agora-staging
    ```

### Troubleshooting

*   **Redis "WRONGPASS" or "MaxRetriesPerRequestError"**:
    *   Happens if the Redis password contains special characters that break the connection URL.
    *   **Fix**: Regenerate secrets using `openssl rand -hex 12` and restart the Redis StatefulSet (delete PVCs if needed).
    
*   **404 on Staging (`/agora/beta`)**:
    *   Check Ingress priority. Staging must have `priority: 100` to override Production's `/agora` rule.
    *   Check `NUXT_APP_BASE_URL`. It must match the path prefix (e.g., `/agora/beta`).
    
*   **Sticky Session Failures**:
    *   Prod and Staging must use **different cookie names** (e.g., `agora_sticky` vs `agora_staging_sticky`) to prevent routing conflicts.

---

## 6. Key Files
| File | Purpose |
|------|---------|
| [agora/nuxt.config.ts](file:///home/tl370/agora/agora/nuxt.config.ts) | Main App Config |
| [agora/server/plugins/config.ts](file:///home/tl370/agora/agora/server/plugins/config.ts) | Startup Validation |
| [helm/templates/deployment.yaml](file:///home/tl370/agora/helm/templates/deployment.yaml) | K8s Deployment Manifest |
| [docker-compose.yaml](file:///home/tl370/agora/docker-compose.yaml) | Local DB/Redis setup |

---

## 7. Database Migration (Backup & Restore)

To move your database to a new server:

### 1. Backup (Old Server)
Run this from your local machine connected to the **OLD** cluster:
```bash
# Dump the 'agora' database to a local file
kubectl exec -t -n agora agora-postgresql-0 -- bash -c "export PGPASSWORD=\$POSTGRES_PASSWORD; pg_dump -U agora agora" > agora_backup.sql
```

### 2. Restore (New Server)
After setting up the **NEW** cluster (and ensuring pods are running):

1.  **Copy backup to pod**:
    ```bash
    kubectl cp agora_backup.sql agora/agora-postgresql-0:/tmp/backup.sql
    ```

2.  **Import data**:
    ```bash
    kubectl exec -it -n agora agora-postgresql-0 -- bash -c "export PGPASSWORD=\$POSTGRES_PASSWORD; psql -U agora agora -f /tmp/backup.sql"
    ```

*Note: Redis data is typically ephemeral (cache). If you need to migrate it, copy the `/bitnami/redis/data/dump.rdb` file similarly.*
