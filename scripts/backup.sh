#!/usr/bin/env bash
# ==============================================================================
# Enterprise PostgreSQL Automated Backup & Cloud Offsite Archival
# Voice Orchestration Platform
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
GCS_BUCKET="${GCS_BACKUP_BUCKET:-}" # e.g. gs://your-voice-platform-backups

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/voice_platform_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"
cd "${PROJECT_ROOT}"

echo "[$(date)] Starting PostgreSQL database backup..."

# Extract credentials or fallback
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-voice_orchestration}"

# Perform atomic pg_dump
if docker compose exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip -9 > "${BACKUP_FILE}"; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[SUCCESS] Local backup generated: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    echo "[ERROR] Database backup failed!"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Optional GCS Offsite Synchronization
if [ -n "${GCS_BUCKET}" ]; then
    if command -v gcloud >/dev/null 2>&1 || command -v gsutil >/dev/null 2>&1; then
        echo "[INFO] Uploading backup to Google Cloud Storage: ${GCS_BUCKET}..."
        gcloud storage cp "${BACKUP_FILE}" "${GCS_BUCKET}/database/${TIMESTAMP}.sql.gz" || \
        gsutil cp "${BACKUP_FILE}" "${GCS_BUCKET}/database/${TIMESTAMP}.sql.gz"
        echo "[SUCCESS] Offsite GCS upload complete."
    else
        echo "[WARNING] gcloud/gsutil CLI not found. Skipping offsite GCS upload."
    fi
fi

# Prune local backups older than RETENTION_DAYS
echo "[INFO] Cleaning local backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "voice_platform_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
echo "[SUCCESS] Local backup rotation complete."
