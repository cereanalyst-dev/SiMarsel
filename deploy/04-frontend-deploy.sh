#!/usr/bin/env bash
# ============================================================
# SiMarsel — Build & deploy frontend
#
# Yang dilakukan:
#   1. Install Node.js 20 LTS (kalau belum ada)
#   2. npm ci di /opt/simarsel
#   3. Tulis .env.production (baca ANON_KEY dari /opt/supabase/.env)
#   4. npm run build
#   5. Copy dist/ ke /var/www/simarsel/
#   6. Set ownership www-data:www-data
#
# Idempotent: aman dijalankan ulang setiap kali ada update kode.
# ============================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Jalankan dengan sudo." >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-/opt/simarsel}"
WEB_ROOT="${WEB_ROOT:-/var/www/simarsel}"
DOMAIN="${DOMAIN:-marsel-base.online}"
SUPABASE_ENV="${SUPABASE_ENV:-/opt/supabase/.env}"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "ERROR: ${REPO_DIR} belum ada. Clone dulu: git clone … ${REPO_DIR}" >&2
  exit 1
fi

# ---------- 1. Node.js 20 LTS ----------
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
  echo "==> [1/6] Install Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "==> [1/6] Node.js sudah versi $(node -v), skip install."
fi

# ---------- 2. npm ci ----------
echo "==> [2/6] npm ci di ${REPO_DIR}"
cd "$REPO_DIR"
# Pastikan deploy user yang punya repo (kalau di-clone sebagai root)
if [[ -d "${REPO_DIR}/.git" ]]; then
  chown -R "${SUDO_USER:-deploy}:${SUDO_USER:-deploy}" "$REPO_DIR" 2>/dev/null || true
fi
sudo -u "${SUDO_USER:-deploy}" npm ci

# ---------- 3. .env.production ----------
echo "==> [3/6] Buat .env.production"
ANON_KEY=""
if [[ -f "$SUPABASE_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$SUPABASE_ENV"
  echo "  ANON_KEY dibaca dari ${SUPABASE_ENV}"
else
  echo "  ${SUPABASE_ENV} tidak ada."
  read -rp "  Masukkan ANON_KEY: " ANON_KEY
fi

cat > "${REPO_DIR}/.env.production" <<ENV_EOF
VITE_SUPABASE_URL=https://api.${DOMAIN}
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
ENV_EOF

# ---------- 4. npm run build ----------
echo "==> [4/6] npm run build"
sudo -u "${SUDO_USER:-deploy}" npm run build

# ---------- 5. Copy dist/ ke web root ----------
echo "==> [5/6] Sync ke ${WEB_ROOT}"
mkdir -p "$WEB_ROOT"
rsync -a --delete "${REPO_DIR}/dist/" "${WEB_ROOT}/"

# ---------- 6. Permission ----------
echo "==> [6/6] chown www-data:www-data"
chown -R www-data:www-data "$WEB_ROOT"

echo
echo "=========================================="
echo " Frontend deploy SUKSES"
echo "=========================================="
echo " Web root: ${WEB_ROOT}"
echo " Akses (setelah nginx + SSL aktif):"
echo "   https://app.${DOMAIN}"
echo "=========================================="
echo " Langkah berikut:"
echo "   sudo bash 05-nginx-setup.sh    # nginx vhost + SSL"
echo "=========================================="
