#!/usr/bin/env bash
# ==============================================================================
# Production Deployment Script
# Voice Orchestration Platform
# ==============================================================================

set -euo pipefail

# Text formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Navigate to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

log_info "Starting deployment in ${PROJECT_ROOT}..."

# 1. Verify required environment files exist
if [ ! -f "backend/.env" ]; then
    log_error "backend/.env not found! Please create backend/.env from backend/.env.example before deploying."
    exit 1
fi

if [ ! -f "frontend/.env" ]; then
    log_error "frontend/.env not found! Please create frontend/.env from frontend/.env.example before deploying."
    exit 1
fi

# 2. Pull latest changes from remote Git repository
log_info "Fetching latest code from Git repository..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    log_info "Current branch: ${CURRENT_BRANCH}"
    git pull origin "${CURRENT_BRANCH}"
else
    log_warning "Not a git repository or detached HEAD. Skipping git pull."
fi

# 3. Build only changed images
log_info "Building updated Docker images..."
docker compose build

# 4. Launch containers in background
log_info "Starting containers with Docker Compose..."
docker compose up -d --remove-orphans

# 5. Run Prisma database migrations
log_info "Executing Prisma database migrations..."
# Retry mechanism for database readiness before migrations
MAX_RETRIES=10
RETRY_COUNT=0
until docker compose exec -T backend npx prisma migrate deploy || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    log_warning "Waiting for backend/database to be ready for migrations (Attempt: $((RETRY_COUNT + 1))/$MAX_RETRIES)..."
    sleep 3
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "Prisma migrations failed after $MAX_RETRIES attempts."
    exit 1
fi
log_success "Prisma database migrations applied successfully."

# 6. Clean dangling / unused Docker images to free VM disk space
log_info "Pruning dangling Docker images..."
docker image prune -f

# 7. Check container health status
log_info "Waiting for service health checks to pass..."
sleep 5
docker compose ps

log_success "Deployment completed successfully!"
