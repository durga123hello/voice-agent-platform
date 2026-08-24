#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "[INFO] Starting rollback..."

echo "[INFO] Current containers:"
docker compose ps

echo "[INFO] Backend logs:"
docker compose logs --tail=100 backend

echo "[WARNING] Automatic rollback is not configured yet."
echo "[WARNING] Please redeploy the previous known-good image/tag."

exit 1
