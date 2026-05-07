#!/usr/bin/env bash
# ============================================================
# SiMarsel — Daily backup
#
# Backup:
#   - Postgres dump (pg_dump -Fc, gzip) → /var/backups/postgres/
#   - n8n data (workflow + credentials) → /var/backups/n8n/
#
# Retention: 14 hari (lebih lama akan dihapus auto).
#
# Cron suggestion (root crontab):
#   0 2 * * * /usr/local/bin/simarsel-backup >> /var/log/simarsel-backup.log 2>&1
# ============================================================
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups}"
PG_DIR="${BACKUP_ROOT}/postgres"
N8N_DIR_SRC="${N8N_DIR_SRC:-/opt/n8n/data}"
N8N_DIR_DST="${BACKUP_ROOT}/n8n"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$PG_DIR" "$N8N_DIR_DST"

# ---------- Postgres ----------
echo "[$(date -Iseconds)] Postgres dump…"
PG_FILE="${PG_DIR}/supabase-${TIMESTAMP}.sql.gz"
docker exec supabase-db pg_dump -U postgres -d postgres -Fc \
  | gzip > "$PG_FILE"

# Cek size — pg_dump kecil banget = mungkin kosong/error
PG_SIZE=$(stat -c %s "$PG_FILE")
if (( PG_SIZE < 1024 )); then
  echo "  WARNING: backup hanya ${PG_SIZE} bytes, kemungkinan error."
fi
echo "  Postgres backup: ${PG_FILE} (${PG_SIZE} bytes)"

# ---------- n8n data ----------
if [[ -d "$N8N_DIR_SRC" ]]; then
  echo "[$(date -Iseconds)] n8n data tar…"
  N8N_FILE="${N8N_DIR_DST}/n8n-${TIMESTAMP}.tar.gz"
  tar -czf "$N8N_FILE" -C "$(dirname "$N8N_DIR_SRC")" "$(basename "$N8N_DIR_SRC")"
  echo "  n8n backup: ${N8N_FILE} ($(stat -c %s "$N8N_FILE") bytes)"
fi

# ---------- Retention ----------
echo "[$(date -Iseconds)] Cleanup backup > ${RETENTION_DAYS} hari…"
find "$PG_DIR" -name "supabase-*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
find "$N8N_DIR_DST" -name "n8n-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "[$(date -Iseconds)] Backup selesai."
echo

# ---------- (Opsional) Sync ke remote ----------
# Uncomment kalau punya storage remote:
#
# rsync -av --delete "$BACKUP_ROOT/" user@backup-host:/path/
#
# Atau ke S3/Backblaze pakai rclone:
# rclone sync "$BACKUP_ROOT" remote:simarsel-backup/$(hostname)/
