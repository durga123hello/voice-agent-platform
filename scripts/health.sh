#!/usr/bin/env bash
# ==============================================================================
# Comprehensive Health & Diagnostics Probe
# Voice Orchestration Platform
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo " Voice Orchestration Platform Health Status Check"
echo "========================================================"

# Check container status
echo -e "\n[1/3] Docker Containers Status:"
docker compose ps

# Check Backend API Health
echo -e "\n[2/3] Backend API & Database Connectivity:"
if BACKEND_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}" http://localhost:3000/api/health); then
    HTTP_CODE=$(echo "$BACKEND_RES" | grep "HTTP_STATUS" | cut -d: -f2)
    BODY=$(echo "$BACKEND_RES" | grep -v "HTTP_STATUS")
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "✅ Backend OK (HTTP 200): $BODY"
    else
        echo "❌ Backend Returned Error (HTTP $HTTP_CODE): $BODY"
        exit 1
    fi
else
    echo "❌ Backend Unreachable on http://localhost:3000/api/health"
    exit 1
fi

# Check Redis Connectivity
echo -e "\n[3/3] Redis Memory & Ping:"
if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
    USED_MEM=$(docker compose exec -T redis redis-cli info memory | grep "used_memory_human" | tr -d '\r')
    echo "✅ Redis Connected ($USED_MEM)"
else
    echo "❌ Redis Service Unhealthy"
    exit 1
fi

echo -e "\n========================================================"
