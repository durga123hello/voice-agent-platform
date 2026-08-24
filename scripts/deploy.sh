#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

log_info "Starting deployment in ${PROJECT_ROOT}..."

# 1. Verify backend environment
if [ ! -f "backend/.env" ]; then
    log_error "backend/.env not found!"
    exit 1
fi

# 2. Update repository
log_info "Fetching latest code..."

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

    if [ "${CURRENT_BRANCH}" = "HEAD" ]; then
        log_error "Repository is in detached HEAD state."
        exit 1
    fi

    git fetch origin
    git reset --hard "origin/${CURRENT_BRANCH}"
else
    log_error "Not a git repository."
    exit 1
fi

# 3. Pull latest images
log_info "Pulling Docker images..."
docker compose pull

# 4. Start/recreate containers
log_info "Starting containers..."
docker compose up -d --remove-orphans

# 5. Wait for backend health
log_info "Waiting for backend to become healthy..."

MAX_RETRIES=30
RETRY_COUNT=0

until curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; do

    if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
        log_error "Backend failed health check."

        docker compose ps
        docker compose logs --tail=100 backend

        exit 1
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))

    log_warning "Backend not ready. Attempt ${RETRY_COUNT}/${MAX_RETRIES}"

    sleep 5
done

log_success "Backend is healthy."

# 6. Remove dangling images
log_info "Cleaning unused Docker images..."
docker image prune -f

# 7. Final status
log_info "Final container status..."
docker compose ps

log_success "Deployment completed successfully!"
