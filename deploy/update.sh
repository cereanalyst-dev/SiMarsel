#!/usr/bin/env bash
# ============================================================
# SiMarsel — one-command update script.
#
# Cara pakai (1 command, idempotent, auto-heal):
#
#   sudo bash /opt/simarsel/deploy/update.sh
#
# Atau setelah install alias (lihat installer di bawah):
#
#   simarsel-update
#
# Yang dilakukan:
#   1. Kalau /opt/simarsel tidak ada → clone dari GitHub
#   2. Kalau ada → git fetch + checkout main + pull
#   3. Run frontend deploy script (build + copy ke /var/www/simarsel)
#   4. Reload nginx
#
# Aman dijalankan berapa kali pun. Tidak ada step manual.
# ============================================================

set -e

REPO_URL="${REPO_URL:-https://github.com/cereanalyst-dev/SiMarsel.git}"
REPO_DIR="${REPO_DIR:-/opt/simarsel}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
BRANCH="${BRANCH:-main}"

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}Jalankan dengan sudo.${NC}" >&2
  exit 1
fi

cd /

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SiMarsel — One-Command Update          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo

# 1. Clone or pull
if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo -e "${YELLOW}→ Repo belum ada. Cloning fresh ke $REPO_DIR${NC}"
  rm -rf "$REPO_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REPO_DIR"
  echo -e "${GREEN}✔ Cloned${NC}"
else
  echo -e "${YELLOW}→ Repo ada. Pull update dari origin/$BRANCH${NC}"
  cd "$REPO_DIR"
  sudo -u "$DEPLOY_USER" git fetch origin "$BRANCH"
  sudo -u "$DEPLOY_USER" git checkout "$BRANCH"
  sudo -u "$DEPLOY_USER" git reset --hard "origin/$BRANCH"
  echo -e "${GREEN}✔ Pulled latest$(cd "$REPO_DIR" && sudo -u "$DEPLOY_USER" git log --oneline -1 | sed 's/^/ — /')${NC}"
fi
echo

# 2. Run frontend deploy
echo -e "${YELLOW}→ Build & deploy frontend${NC}"
bash "$REPO_DIR/deploy/04-frontend-deploy.sh"
echo -e "${GREEN}✔ Frontend deployed${NC}"
echo

# 3. Reload nginx (defensive — kalau config berubah)
echo -e "${YELLOW}→ Reload nginx${NC}"
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo -e "${GREEN}✔ Nginx reloaded${NC}"
else
  echo -e "${RED}✖ Nginx config error — skip reload${NC}"
  nginx -t
fi
echo

echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Update selesai                       ║${NC}"
echo -e "${GREEN}║   Buka browser → hard reload Ctrl+Shift+R║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
