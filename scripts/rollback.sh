#!/usr/bin/env bash
# ==============================================================================
# Automated Rollback Script
# Voice Orchestration Platform
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "[INFO] Initiating emergency rollback..."

# 1. Revert to previous Git commit
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    PREV_COMMIT=$(git rev-parse HEAD~1)
    echo "[INFO] Checking out previous commit: ${PREV_COMMIT}"
    git checkout "${PREV_COMMIT}"
else
    echo "[ERROR] Not a git repository. Cannot determine previous commit."
    exit 1
fi

# 2. Rebuild images from previous state
echo "[INFO] Rebuilding images from rollback commit..."
docker compose build

# 3. Restart containers
echo "[INFO] Redeploying previous container configuration..."
docker compose up -d --remove-orphans

# 4. Verify health
echo "[INFO] Verifying platform health status post-rollback..."
sleep 5
./scripts/health.sh

echo "[SUCCESS] Rollback completed successfully."
