# Production Deployment Guide: Voice Orchestration Platform (Enterprise Edition)

This document contains the complete enterprise production deployment specification, architectural design, containerization assets, automation scripts, and operations guide for deploying the **Voice Orchestration Platform** on a single **Google Cloud Compute Engine (GCE)** VM running **Ubuntu 24.04 LTS**.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Deployment Artifacts & File Directory](#2-deployment-artifacts--file-directory)
3. [Component Specifications & Code](#3-component-specifications--code)
   - [3.1 Backend Dockerfile](#31-backend-dockerfile)
   - [3.2 Backend .dockerignore](#32-backend-dockerignore)
   - [3.3 Backend .env.example](#33-backend-envexample)
   - [3.4 Frontend Dockerfile](#34-frontend-dockerfile)
   - [3.5 Frontend .dockerignore](#35-frontend-dockerignore)
   - [3.6 Frontend .env.example](#36-frontend-envexample)
   - [3.7 Hardened Docker Compose Specification](#37-hardened-docker-compose-specification)
   - [3.8 Hardened Nginx Gateway Configuration](#38-hardened-nginx-gateway-configuration)
   - [3.9 Production Deployment Script](#39-production-deployment-script)
   - [3.10 Database Backup & Cloud Storage Script](#310-database-backup--cloud-storage-script)
   - [3.11 Automated Rollback Script](#311-automated-rollback-script)
   - [3.12 Health & Diagnostics Probe Script](#312-health--diagnostics-probe-script)
   - [3.13 GitHub Actions CI/CD Pipeline](#313-github-actions-cicd-pipeline)
4. [Step-by-Step GCE VM Setup & Operations Guide](#4-step-by-step-gce-vm-setup--operations-guide)
   - [Step 1: Host Linux Kernel Tuning for High-Throughput UDP](#step-1-host-linux-kernel-tuning-for-high-throughput-udp)
   - [Step 2: Configure GCP VPC Firewall Rules](#step-2-configure-gcp-vpc-firewall-rules)
   - [Step 3: Clone Repository & Configure Environment Variables](#step-3-clone-repository--configure-environment-variables)
   - [Step 4: Configure Host Nginx Reverse Proxy](#step-4-configure-host-nginx-reverse-proxy)
   - [Step 5: Issue SSL Certificates via Certbot](#step-5-issue-ssl-certificates-via-certbot)
   - [Step 6: Setup Automated Backup Cron Job](#step-6-setup-automated-backup-cron-job)
   - [Step 7: Configure GitHub Actions CI/CD Secrets](#step-7-configure-github-actions-cicd-secrets)
5. [Enterprise Scaling & Monitoring Blueprint](#5-enterprise-scaling--monitoring-blueprint)

---

## 1. Architecture Overview

```
                          Internet / Clients
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                 │
  HTTP/HTTPS (Port 80/443)                         WebRTC RTP (Port 20000-29999 UDP/TCP)
         │                                                 │
         ▼                                                 │
 ┌───────────────┐                                         │
 │  Host Nginx   │                                         │
 └───┬───────┬───┘                                         │
     │       │                                             │
     │ /ws   │ /api (Rate Limited)                         │
     │       └─────────────┐                               │
     │ /                   │                               │
     ▼                     ▼                               ▼
┌──────────────┐   ┌───────────────────────────────────────────────┐
│   frontend   │   │                    backend                    │
│   (Next.js)  │   │        (Express / TypeScript / Mediasoup)     │
│  Port: 3001  │   │                  Port: 3000                   │
└──────┬───────┘   └───────┬───────────────────────────────┬───────┘
       │                   │                               │
       │                   ▼                               ▼
       │         ┌───────────────────┐           ┌───────────────────┐
       │         │     postgres      │           │       redis       │
       │         │   (PostgreSQL 16) │           │     (Redis 7)     │
       │         │  1GB Shared Buff  │           │   LRU Eviction    │
       │         │    Port: 5432     │           │    Port: 6379     │
       │         └─────────┬─────────┘           └─────────┬─────────┘
       │                   │                               │
       └───────────────────┴───────────────┬───────────────┘
                                           │
                           Docker Bridge: voice_bridge_network
```

---

## 2. Deployment Artifacts & File Directory

```
voice-orchestration-platform/
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD validation and automated deployment workflow
├── backend/
│   ├── .dockerignore             # Exclusions for backend Docker build
│   ├── .env.example              # Environment variables template for backend
│   └── Dockerfile                # Multi-stage production build for backend
├── frontend/
│   ├── .dockerignore             # Exclusions for frontend Docker build
│   ├── .env.example              # Environment variables template for frontend
│   └── Dockerfile                # Multi-stage standalone build for Next.js
├── nginx/
│   └── nginx.conf                # Nginx reverse proxy with rate limiting & WebSocket upgrade
├── scripts/
│   ├── backup.sh                 # Database backup with GCS cloud offsite sync
│   ├── deploy.sh                 # Production deployment & migration script
│   ├── health.sh                 # System probe and container health check script
│   └── rollback.sh               # Emergency automated rollback script
├── docker-compose.yml            # Hardened multi-container resource-bounded orchestration
└── DEPLOYMENT.md                 # Complete operations manual (this document)
```

---

## 3. Component Specifications & Code

### 3.1 Backend Dockerfile
`backend/Dockerfile`

```dockerfile
# ==============================================================================
# Stage 1: Build & Dependencies
# ==============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install native compilation toolchain required for mediasoup (C++/Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Clean install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma Client & compile TypeScript to dist/
RUN npx prisma generate
RUN npm run build

# Remove devDependencies to keep final production node_modules lean
RUN npm prune --omit=dev

# ==============================================================================
# Stage 2: Production Runner
# ==============================================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies: FFmpeg is mandatory for audio transcoding,
# dumb-init for proper PID 1 signal forwarding & graceful shutdowns,
# curl for Docker health checks.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create persistent directories with proper non-root node ownership
RUN mkdir -p /app/uploads /app/logs && chown -R node:node /app

# Copy production runtime artifacts from builder
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma

# Switch to non-root user for security
USER node

# Expose HTTP/WS signaling port and Mediasoup WebRTC RTP port ranges
EXPOSE 3000
EXPOSE 20000-29999/udp
EXPOSE 20000-29999/tcp

# Native Docker Healthcheck against backend health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# dumb-init handles SIGTERM/SIGINT signals properly for graceful Node process termination
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

---

### 3.2 Backend .dockerignore
`backend/.dockerignore`

```dockerignore
node_modules
npm-debug.log
yarn-error.log
.pnpm-debug.log

dist
build
out
.next

.git
.github
.gitignore

.env
.env.local
.env.development
.env.test
.env.production
*.env

uploads
logs
*.log

*.sqlite
*.sqlite3
*.sql
backup_before_multitenant_migration.sql

.DS_Store
Thumbs.db
.idea
.vscode
*.tsbuildinfo
```

---

### 3.3 Backend .env.example
`backend/.env.example`

```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# PostgreSQL Database Connection
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_STRONG_PASSWORD@postgres:5432/voice_orchestration?schema=public&connection_limit=50"

# Redis Cache & PubSub Connection
REDIS_URL="redis://redis:6379"

# Security & Encryption (Generate 32-byte hex keys for production)
JWT_SECRET="generate_a_secure_jwt_secret_64_characters_long"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# AI & Voice Provider API Keys
OPENAI_API_KEY="sk-proj-your-openai-api-key"
DEEPGRAM_API_KEY="your-deepgram-api-key"

# Mediasoup WebRTC Infrastructure Configuration
MEDIASOUP_LISTEN_IP="0.0.0.0"
MEDIASOUP_ANNOUNCED_IP="YOUR_GCE_STATIC_EXTERNAL_IP"

# Google Cloud Storage Backup Destination
GCS_BACKUP_BUCKET="gs://your-voice-platform-backups"
```

---

### 3.4 Frontend Dockerfile
`frontend/Dockerfile`

```dockerfile
# ==============================================================================
# Stage 1: Dependency Installation
# ==============================================================================
FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ==============================================================================
# Stage 2: Next.js Production Build
# ==============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

RUN npm run build

# ==============================================================================
# Stage 3: Minimal Production Runtime
# ==============================================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
```

---

### 3.5 Frontend .dockerignore
`frontend/.dockerignore`

```dockerignore
node_modules
npm-debug.log
yarn-error.log
.pnpm-debug.log

.next
out
build
dist

.git
.github
.gitignore

.env
.env.local
.env.development
.env.test
.env.production
*.env

.DS_Store
Thumbs.db
.idea
.vscode
*.tsbuildinfo
```

---

### 3.6 Frontend .env.example
`frontend/.env.example`

```env
NODE_ENV=production
PORT=3001

NEXT_PUBLIC_API_URL="https://your-domain.com"
NEXT_PUBLIC_WS_URL="wss://your-domain.com"
```

---

### 3.7 Hardened Docker Compose Specification
`docker-compose.yml`

```yaml
services:
  # ----------------------------------------------------------------------------
  # PostgreSQL Database Service
  # ----------------------------------------------------------------------------
  postgres:
    image: postgres:16-alpine
    container_name: voice-platform-postgres
    restart: unless-stopped
    shm_size: 1gb
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgrespassword}
      POSTGRES_DB: ${POSTGRES_DB:-voice_orchestration}
      PGDATA: /var/lib/postgresql/data/pgdata
    command: >
      postgres
        -c shared_buffers=1GB
        -c effective_cache_size=3GB
        -c maintenance_work_mem=256MB
        -c checkpoint_completion_target=0.9
        -c wal_buffers=16MB
        -c default_statistics_target=100
        -c random_page_cost=1.1
        -c effective_io_concurrency=200
        -c work_mem=16MB
        -c min_wal_size=1GB
        -c max_wal_size=4GB
        -c max_connections=200
    volumes:
      - postgres-data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1.5G
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-voice_orchestration}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - voice-bridge-network

  # ----------------------------------------------------------------------------
  # Redis Cache & Session State
  # ----------------------------------------------------------------------------
  redis:
    image: redis:7-alpine
    container_name: voice-platform-redis
    restart: unless-stopped
    command: >
      redis-server
        --appendonly yes
        --appendfsync everysec
        --maxmemory 1024mb
        --maxmemory-policy allkeys-lru
        --tcp-backlog 65535
        --timeout 300
    volumes:
      - redis-data:/data
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1.5G
        reservations:
          cpus: '0.2'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    networks:
      - voice-bridge-network

  # ----------------------------------------------------------------------------
  # Backend Voice & Signaling Service
  # ----------------------------------------------------------------------------
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: voice-platform-backend
    restart: unless-stopped
    env_file:
      - ./backend/.env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgrespassword}@postgres:5432/${POSTGRES_DB:-voice_orchestration}?schema=public&connection_limit=50
      - REDIS_URL=redis://redis:6379
      - UV_THREADPOOL_SIZE=64
    ulimits:
      nofile:
        soft: 65535
        hard: 65535
    ports:
      - "127.0.0.1:3000:3000"
      - "20000-29999:20000-29999/udp"
      - "20000-29999:20000-29999/tcp"
    volumes:
      - uploads:/app/uploads
      - logs:/app/logs
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 6G
        reservations:
          cpus: '1.0'
          memory: 2G
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 25s
    networks:
      - voice-bridge-network

  # ----------------------------------------------------------------------------
  # Frontend Next.js Service
  # ----------------------------------------------------------------------------
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: voice-platform-frontend
    restart: unless-stopped
    env_file:
      - ./frontend/.env
    environment:
      - NODE_ENV=production
      - PORT=3001
    ports:
      - "127.0.0.1:3001:3001"
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.2'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 15s
    networks:
      - voice-bridge-network

volumes:
  postgres-data:
    name: voice_postgres_data
  redis-data:
    name: voice_redis_data
  uploads:
    name: voice_uploads_data
  logs:
    name: voice_logs_data

networks:
  voice-bridge-network:
    name: voice_bridge_network
    driver: bridge
```

---

### 3.8 Hardened Nginx Gateway Configuration
`nginx/nginx.conf`

```nginx
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    client_max_body_size 50M;
    client_body_buffer_size 128k;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/x-javascript
        application/xml
        application/xml+rss
        application/x-font-ttf
        application/vnd.ms-fontobject
        image/svg+xml;

    # Rate limiting & connection limits
    limit_req_zone $binary_remote_addr zone=api_limit:20m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=5r/s;
    limit_conn_zone $binary_remote_addr zone=addr_conn:10m;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    upstream backend_upstream {
        server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
        keepalive 64;
    }

    upstream frontend_upstream {
        server 127.0.0.1:3001 max_fails=3 fail_timeout=10s;
        keepalive 32;
    }

    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
            allow all;
        }

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        location /ws {
            limit_req zone=ws_limit burst=10 nodelay;
            limit_conn addr_conn 50;

            proxy_pass http://backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
            proxy_connect_timeout 60s;
            proxy_buffering off;
        }

        location /api {
            limit_req zone=api_limit burst=50 nodelay;
            limit_conn addr_conn 50;

            proxy_pass http://backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_buffering on;
            proxy_buffer_size 8k;
            proxy_buffers 8 8k;
            proxy_busy_buffers_size 16k;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        location / {
            limit_conn addr_conn 100;

            proxy_pass http://frontend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_buffering on;
            proxy_buffer_size 8k;
            proxy_buffers 8 8k;
            proxy_busy_buffers_size 16k;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
}
```

---

### 3.9 Production Deployment Script
`scripts/deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "[INFO] Starting deployment in ${PROJECT_ROOT}..."

if [ ! -f "backend/.env" ] || [ ! -f "frontend/.env" ]; then
    echo "[ERROR] .env files missing in backend/ or frontend/!"
    exit 1
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo "[INFO] Pulling branch ${CURRENT_BRANCH}..."
    git pull origin "${CURRENT_BRANCH}"
fi

echo "[INFO] Building Docker images..."
docker compose build

echo "[INFO] Starting containers..."
docker compose up -d --remove-orphans

echo "[INFO] Executing database migrations..."
MAX_RETRIES=10
RETRY_COUNT=0
until docker compose exec -T backend npx prisma migrate deploy || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    echo "[WAIT] Database not ready, retrying ($((RETRY_COUNT + 1))/$MAX_RETRIES)..."
    sleep 3
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[ERROR] Prisma migrations failed!"
    exit 1
fi

echo "[INFO] Cleaning dangling images..."
docker image prune -f

echo "[INFO] Checking health status..."
sleep 5
./scripts/health.sh

echo "[SUCCESS] Deployment completed."
```

---

### 3.10 Database Backup & Cloud Storage Script
`scripts/backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
GCS_BUCKET="${GCS_BACKUP_BUCKET:-}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/voice_platform_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
cd "${PROJECT_ROOT}"

echo "[$(date)] Starting PostgreSQL database backup..."

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-voice_orchestration}"

if docker compose exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip -9 > "${BACKUP_FILE}"; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[SUCCESS] Local backup generated: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    echo "[ERROR] Database backup failed!"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

if [ -n "${GCS_BUCKET}" ]; then
    if command -v gcloud >/dev/null 2>&1 || command -v gsutil >/dev/null 2>&1; then
        echo "[INFO] Uploading to Google Cloud Storage: ${GCS_BUCKET}..."
        gcloud storage cp "${BACKUP_FILE}" "${GCS_BUCKET}/database/${TIMESTAMP}.sql.gz" || \
        gsutil cp "${BACKUP_FILE}" "${GCS_BUCKET}/database/${TIMESTAMP}.sql.gz"
        echo "[SUCCESS] Offsite GCS upload complete."
    fi
fi

find "${BACKUP_DIR}" -type f -name "voice_platform_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
echo "[SUCCESS] Rotation complete."
```

---

### 3.11 Automated Rollback Script
`scripts/rollback.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "[INFO] Initiating emergency rollback..."

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    PREV_COMMIT=$(git rev-parse HEAD~1)
    echo "[INFO] Checking out previous commit: ${PREV_COMMIT}"
    git checkout "${PREV_COMMIT}"
else
    echo "[ERROR] Cannot determine previous commit."
    exit 1
fi

echo "[INFO] Rebuilding previous images..."
docker compose build

echo "[INFO] Redeploying previous containers..."
docker compose up -d --remove-orphans

sleep 5
./scripts/health.sh
echo "[SUCCESS] Rollback completed."
```

---

### 3.12 Health & Diagnostics Probe Script
`scripts/health.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo " Voice Orchestration Platform Health Status Check"
echo "========================================================"

echo -e "\n[1/4] Docker Containers Status:"
docker compose ps

echo -e "\n[2/4] Backend API & Database Connectivity:"
if BACKEND_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" http://localhost:3000/api/health); then
    HTTP_CODE=$(echo "$BACKEND_RES" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$BACKEND_RES" | grep -v "HTTP_STATUS")
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "✅ Backend OK (HTTP 200): $BODY"
    else
        echo "❌ Backend Returned Error (HTTP $HTTP_CODE): $BODY"
    fi
else
    echo "❌ Backend Unreachable"
fi

echo -e "\n[3/4] Frontend HTTP Server:"
if FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/); then
    if [ "$FRONTEND_CODE" -eq 200 ]; then
        echo "✅ Frontend OK (HTTP 200)"
    else
        echo "⚠️ Frontend Returned HTTP $FRONTEND_CODE"
    fi
else
    echo "❌ Frontend Unreachable"
fi

echo -e "\n[4/4] Redis Memory & Ping:"
if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    USED_MEM=$(docker compose exec -T redis redis-cli info memory | grep "used_memory_human" | tr -d '\r')
    echo "✅ Redis Connected ($USED_MEM)"
else
    echo "❌ Redis Unhealthy"
fi

echo -e "\n========================================================"
```

---

### 3.13 GitHub Actions CI/CD Pipeline
`.github/workflows/deploy.yml`

```yaml
name: Production CI/CD Pipeline

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

concurrency:
  group: production-deployment
  cancel-in-progress: false

jobs:
  validate:
    name: Lint & Build Validation
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Validate Backend TypeScript & Prisma
        run: |
          cd backend
          npm ci
          npx prisma generate
          npm run build

      - name: Validate Frontend Build
        run: |
          cd frontend
          npm ci
          npm run build

  deploy:
    name: Deploy to Google Cloud VM
    needs: validate
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - name: Trigger Remote Deployment via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.GCE_HOST }}
          username: ${{ secrets.GCE_SSH_USER }}
          key: ${{ secrets.GCE_SSH_KEY }}
          port: ${{ secrets.GCE_SSH_PORT || 22 }}
          script_stop: true
          envs: PROJECT_PATH
          script: |
            TARGET_DIR="${{ secrets.PROJECT_PATH || '/opt/voice-orchestration-platform' }}"
            cd "${TARGET_DIR}"

            chmod +x scripts/*.sh

            if ! ./scripts/deploy.sh; then
              echo "Deployment failed! Initiating rollback..."
              ./scripts/rollback.sh
              exit 1
            fi

            ./scripts/health.sh
```

---

## 4. Step-by-Step GCE VM Setup & Operations Guide

### Step 1: Host Linux Kernel Tuning for High-Throughput UDP
On your GCE Ubuntu 24.04 VM, run:
```bash
sudo tee /etc/sysctl.d/99-voice-platform.conf << 'EOF'
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384
net.ipv4.udp_mem = 262144 524288 1048576
net.core.netdev_max_backlog = 100000
net.core.somaxconn = 65535
fs.file-max = 2097152
vm.overcommit_memory = 1
EOF

sudo sysctl --system
```

### Step 2: Configure GCP VPC Firewall Rules
In Google Cloud Console under **VPC Network → Firewall Rules**, configure:
- **Direction**: `Ingress`
- **Source IP ranges**: `0.0.0.0/0`
- **Protocols and ports**:
  - `tcp: 80, 443, 20000-29999`
  - `udp: 20000-29999`

### Step 3: Clone Repository & Configure Environment Variables
```bash
sudo git clone <YOUR_GITHUB_REPOSITORY_URL> /opt/voice-orchestration-platform
sudo chown -R $USER:$USER /opt/voice-orchestration-platform
cd /opt/voice-orchestration-platform

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Update secrets and GCE static external IP in backend/.env
nano backend/.env
nano frontend/.env

chmod +x scripts/*.sh
```

### Step 4: Configure Host Nginx Reverse Proxy
```bash
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Issue SSL Certificates via Certbot
```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Step 6: Setup Automated Backup Cron Job
```bash
crontab -e
```
Add:
```cron
0 2 * * * /opt/voice-orchestration-platform/scripts/backup.sh >> /var/log/voice_platform_backup.log 2>&1
```

### Step 7: Configure GitHub Actions CI/CD Secrets
In GitHub **Settings → Secrets and variables → Actions**:
- `GCE_HOST`: Public static IP of GCE VM.
- `GCE_SSH_USER`: SSH username (`ubuntu`).
- `GCE_SSH_KEY`: Private SSH Key.
- `GCE_SSH_PORT`: `22`.
- `PROJECT_PATH`: `/opt/voice-orchestration-platform`.

---

## 5. Enterprise Scaling & Monitoring Blueprint

| Component | Target Metric | Healthy Range | Alert Threshold | Action |
|---|---|---|---|---|
| **Mediasoup Worker** | CPU Utilization per Core | `< 60%` | `> 75%` | Scale worker thread pool |
| **RTP Media Transport** | Packet Loss Rate | `< 1.0%` | `> 3.0%` | Verify UDP buffers / bandwidth |
| **Node.js Signaling** | Event Loop Lag | `< 15ms` | `> 30ms` | Optimize sync tasks |
| **PostgreSQL** | Connection Pool Saturation | `< 70%` | `> 85%` | Increase PgBouncer pool |
| **Redis** | Memory Usage | `< 70%` | `> 85%` | Verify TTL eviction policies |
| **Disk Space** | Storage Utilization | `< 65%` | `> 80%` | Clean old logs and local backups |
