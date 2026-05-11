#!/usr/bin/env bash
# ============================================================
# SiMarsel — Deploy Supabase self-hosted
#
# Sumber: https://github.com/supabase/supabase/tree/master/docker
#
# Yang dilakukan:
#   1. Sparse-clone supabase/supabase ke /opt/supabase-src
#   2. Copy folder docker/ ke /opt/supabase
#   3. Generate kredensial: JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
#      POSTGRES_PASSWORD, dashboard credentials
#   4. Tulis .env dengan domain produksi
#   5. docker compose up -d
#   6. Tunggu sampai healthy
#   7. Apply schema SiMarsel (../supabase/schema.sql)
#
# Idempotent: aman dijalankan ulang.
# ============================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Jalankan dengan sudo." >&2
  exit 1
fi

# ---------- Konfigurasi ----------
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
SUPABASE_SRC="${SUPABASE_SRC:-/opt/supabase-src}"
DOMAIN="${DOMAIN:-marsel-base.online}"
APP_HOST="app.${DOMAIN}"
API_HOST="api.${DOMAIN}"
STUDIO_HOST="studio.${DOMAIN}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA_FILE="${REPO_ROOT}/supabase/schema.sql"

# ---------- Helpers ----------
gen_b64() { openssl rand -base64 "$1" | tr -d '\n=+/' | head -c "$1"; }
gen_pass() { openssl rand -base64 32 | tr -d '\n=+/' | head -c 24; }

# JWT HS256 generator: $1=role, $2=secret. Output: signed JWT string.
gen_jwt() {
  local role="$1" secret="$2"
  local header payload header_b64 payload_b64 sig
  local now exp
  now=$(date +%s)
  # Token valid 10 tahun (Supabase default).
  exp=$((now + 60 * 60 * 24 * 365 * 10))
  header='{"alg":"HS256","typ":"JWT"}'
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%d,"exp":%d}' "$role" "$now" "$exp")
  header_b64=$(printf '%s' "$header" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  payload_b64=$(printf '%s' "$payload" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  sig=$(printf '%s.%s' "$header_b64" "$payload_b64" \
    | openssl dgst -binary -sha256 -hmac "$secret" \
    | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  printf '%s.%s.%s' "$header_b64" "$payload_b64" "$sig"
}

# ---------- 1. Clone supabase repo (sparse: hanya folder docker) ----------
echo "==> [1/7] Clone supabase/supabase (sparse)"
if [[ ! -d "$SUPABASE_SRC/.git" ]]; then
  git clone --filter=blob:none --no-checkout --depth=1 \
    https://github.com/supabase/supabase.git "$SUPABASE_SRC"
  pushd "$SUPABASE_SRC" >/dev/null
  git sparse-checkout init --cone
  git sparse-checkout set docker
  git checkout
  popd >/dev/null
else
  echo "  Repo Supabase sudah di-clone, skip."
fi

# ---------- 2. Copy docker/ ke /opt/supabase ----------
echo "==> [2/7] Copy folder docker/ ke ${SUPABASE_DIR}"
mkdir -p "$SUPABASE_DIR"
# rsync biar idempotent (tidak overwrite .env existing)
rsync -a --exclude='.env' "${SUPABASE_SRC}/docker/" "${SUPABASE_DIR}/"

# ---------- 3. Generate kredensial (kalau belum ada .env) ----------
ENV_FILE="${SUPABASE_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "==> [3/7] .env sudah ada, baca kredensial existing."
  # shellcheck disable=SC1090
  source "$ENV_FILE"
else
  echo "==> [3/7] Generate kredensial baru"
  POSTGRES_PASSWORD=$(gen_pass)
  JWT_SECRET=$(gen_b64 48)
  ANON_KEY=$(gen_jwt "anon" "$JWT_SECRET")
  SERVICE_ROLE_KEY=$(gen_jwt "service_role" "$JWT_SECRET")
  DASHBOARD_USERNAME="admin"
  DASHBOARD_PASSWORD=$(gen_pass)
  SECRET_KEY_BASE=$(gen_b64 64)
  VAULT_ENC_KEY=$(gen_b64 32)
  POOLER_TENANT_ID="${POOLER_TENANT_ID:-simarsel}"
  LOGFLARE_API_KEY=$(gen_b64 32)

  cat > "$ENV_FILE" <<ENV_EOF
############
# Supabase self-hosted — generated $(date -Iseconds)
# Domain: ${DOMAIN}
############

POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
DASHBOARD_USERNAME=${DASHBOARD_USERNAME}
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
SECRET_KEY_BASE=${SECRET_KEY_BASE}
VAULT_ENC_KEY=${VAULT_ENC_KEY}
LOGFLARE_API_KEY=${LOGFLARE_API_KEY}

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# Pooler (Supavisor)
############
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=${POOLER_TENANT_ID}
POOLER_DB_POOL_SIZE=5

############
# API gateway (Kong)
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# Public URLs (di-expose lewat nginx reverse proxy)
############
SUPABASE_PUBLIC_URL=https://${API_HOST}
API_EXTERNAL_URL=https://${API_HOST}
SITE_URL=https://${APP_HOST}
ADDITIONAL_REDIRECT_URLS=https://${APP_HOST}/**

############
# Auth
############
DISABLE_SIGNUP=false
JWT_EXPIRY=3600
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
MAILER_AUTOCONFIRM=true
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

############
# SMTP — disabled (skip email confirmation di atas)
# Isi kalau mau aktifkan email confirmation
############
SMTP_ADMIN_EMAIL=admin@${DOMAIN}
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=SiMarsel

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=SiMarsel
STUDIO_DEFAULT_PROJECT=Default
STUDIO_PORT=3000
SUPABASE_PUBLIC_DASHBOARD_URL=https://${STUDIO_HOST}

############
# Storage / Functions / Realtime
############
DOCKER_SOCKET_LOCATION=/var/run/docker.sock

############
# Logflare (analytics, optional)
############
LOGFLARE_LOGGER_BACKEND_API_KEY=${LOGFLARE_API_KEY}

############
# Tools — Imgproxy / Functions
############
IMGPROXY_ENABLE_WEBP_DETECTION=true
FUNCTIONS_VERIFY_JWT=false
ENV_EOF

  chmod 600 "$ENV_FILE"
fi

# ---------- 4. Patch listen address Kong + Studio ke localhost ----------
# Default Supabase docker bind ke 0.0.0.0:8000 (Kong) dan 0.0.0.0:3000
# (Studio). Karena kita pakai nginx reverse proxy di host, lebih aman bind
# ke 127.0.0.1 saja supaya port tidak ter-expose ke public.
echo "==> [4/7] Patch port binding ke 127.0.0.1 (kalau perlu)"
COMPOSE_FILE="${SUPABASE_DIR}/docker-compose.yml"
# Kong & Studio binding patch — dilakukan via override file biar aman dari
# overwrite saat update Supabase repo.
OVERRIDE_FILE="${SUPABASE_DIR}/docker-compose.override.yml"
if [[ ! -f "$OVERRIDE_FILE" ]]; then
  cat > "$OVERRIDE_FILE" <<'OVR_EOF'
# Override: bind Kong & Studio ke 127.0.0.1 saja.
# Akses publik lewat nginx reverse proxy + SSL.
services:
  kong:
    ports:
      - "127.0.0.1:8000:8000/tcp"
      - "127.0.0.1:8443:8443/tcp"
  studio:
    ports:
      - "127.0.0.1:3000:3000/tcp"
OVR_EOF
fi

# ---------- 5. docker compose up ----------
echo "==> [5/7] docker compose pull + up -d"
cd "$SUPABASE_DIR"
docker compose pull
docker compose up -d

# ---------- 6. Wait for healthy ----------
echo "==> [6/7] Tunggu container 'db' + 'kong' healthy (max 5 menit)"
WAIT_SEC=300
INTERVAL=5
elapsed=0
while (( elapsed < WAIT_SEC )); do
  db_state=$(docker inspect -f '{{.State.Health.Status}}' supabase-db 2>/dev/null || echo "missing")
  kong_state=$(docker inspect -f '{{.State.Health.Status}}' supabase-kong 2>/dev/null || echo "missing")
  if [[ "$db_state" == "healthy" && "$kong_state" == "healthy" ]]; then
    echo "  db: healthy, kong: healthy"
    break
  fi
  echo "  [${elapsed}s] db=${db_state} kong=${kong_state} — tunggu…"
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

# ---------- 7. Apply schema SiMarsel ----------
echo "==> [7/7] Apply schema SiMarsel"
if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "  schema.sql tidak ditemukan di ${SCHEMA_FILE}, skip."
  echo "  Apply manual nanti dengan:"
  echo "    cat ${SCHEMA_FILE} | docker exec -i supabase-db psql -U postgres -d postgres"
else
  cat "$SCHEMA_FILE" | docker exec -i supabase-db psql -U postgres -d postgres
fi

# ---------- Print summary ----------
# shellcheck disable=SC1090
source "$ENV_FILE"

echo
echo "=========================================="
echo " Supabase deploy SUKSES"
echo "=========================================="
echo " Domain:            ${DOMAIN}"
echo " API URL:           https://${API_HOST}"
echo " Studio URL:        https://${STUDIO_HOST}"
echo
echo " ANON_KEY (untuk frontend .env.production):"
echo "   ${ANON_KEY}"
echo
echo " SERVICE_ROLE_KEY (rahasia! untuk admin script + n8n):"
echo "   ${SERVICE_ROLE_KEY}"
echo
echo " POSTGRES_PASSWORD (untuk n8n connect ke db):"
echo "   ${POSTGRES_PASSWORD}"
echo
echo " Studio admin (di Studio dashboard login screen Supabase):"
echo "   user: ${DASHBOARD_USERNAME}"
echo "   pass: ${DASHBOARD_PASSWORD}"
echo
echo " Semua kredensial di file: ${ENV_FILE}"
echo " (chmod 600, hanya root yang bisa baca)"
echo "=========================================="
echo " Langkah berikut:"
echo "   sudo bash 03-n8n-deploy.sh       # deploy n8n"
echo "   sudo bash 04-frontend-deploy.sh  # build + deploy frontend"
echo "=========================================="
