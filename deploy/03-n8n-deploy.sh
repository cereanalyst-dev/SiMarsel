#!/usr/bin/env bash
# ============================================================
# SiMarsel — Deploy n8n
#
# Yang dilakukan:
#   1. Buat /opt/n8n/data (persistent volume)
#   2. Generate kredensial: N8N_USER, N8N_PASSWORD, N8N_ENCRYPTION_KEY
#   3. Tulis /opt/n8n/.env + copy n8n-compose.yml
#   4. docker compose up -d
#
# Network: n8n attach ke supabase_default (external) supaya bisa konek
# ke supabase-db langsung tanpa lewat public API.
#
# Idempotent: aman dijalankan ulang.
# ============================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Jalankan dengan sudo." >&2
  exit 1
fi

N8N_DIR="${N8N_DIR:-/opt/n8n}"
DOMAIN="${DOMAIN:-marsel-base.online}"
N8N_HOST_FQDN="n8n.${DOMAIN}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_SRC="${REPO_ROOT}/deploy/n8n-compose.yml"

gen_pass() { openssl rand -base64 32 | tr -d '\n=+/' | head -c 24; }

echo "==> [1/4] Buat folder ${N8N_DIR}/data"
mkdir -p "${N8N_DIR}/data"
# n8n container jalan sebagai user "node" (UID 1000). Set ownership.
chown -R 1000:1000 "${N8N_DIR}/data"

# ---------- Cek network Supabase sudah ada ----------
if ! docker network inspect supabase_default >/dev/null 2>&1; then
  echo "ERROR: network 'supabase_default' belum ada." >&2
  echo "  Jalankan dulu: sudo bash 02-supabase-deploy.sh" >&2
  exit 1
fi

# ---------- 2. Generate credentials kalau belum ada ----------
ENV_FILE="${N8N_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "==> [2/4] .env n8n sudah ada, baca existing."
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "==> [2/4] Generate kredensial n8n"
  N8N_USER="admin"
  N8N_PASSWORD=$(gen_pass)
  N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)

  cat > "$ENV_FILE" <<ENV_EOF
# n8n credentials — generated $(date -Iseconds)
N8N_USER=${N8N_USER}
N8N_PASSWORD=${N8N_PASSWORD}
N8N_HOST=${N8N_HOST_FQDN}
N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
ENV_EOF
  chmod 600 "$ENV_FILE"
fi

# ---------- 3. Copy compose file ----------
echo "==> [3/4] Copy docker-compose.yml ke ${N8N_DIR}"
cp "$COMPOSE_SRC" "${N8N_DIR}/docker-compose.yml"

# ---------- 4. up ----------
echo "==> [4/4] docker compose up -d"
cd "$N8N_DIR"
docker compose pull
docker compose up -d

# ---------- Print summary ----------
# shellcheck disable=SC1090
source "$ENV_FILE"

echo
echo "=========================================="
echo " n8n deploy SUKSES"
echo "=========================================="
echo " URL (setelah nginx + SSL aktif):"
echo "   https://${N8N_HOST_FQDN}"
echo
echo " Login n8n:"
echo "   user: ${N8N_USER}"
echo "   pass: ${N8N_PASSWORD}"
echo
echo " Connection string ke Supabase Postgres (untuk node Postgres):"
echo "   Host:     supabase-db"
echo "   Port:     5432"
echo "   Database: postgres"
echo "   User:     postgres"
echo "   Password: <POSTGRES_PASSWORD dari /opt/supabase/.env>"
echo "   SSL:      disable"
echo
echo " Kredensial tersimpan di: ${ENV_FILE} (root only)"
echo "=========================================="
echo " Langkah berikut:"
echo "   sudo bash 04-frontend-deploy.sh"
echo "=========================================="
