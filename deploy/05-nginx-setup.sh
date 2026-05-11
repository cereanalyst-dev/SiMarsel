#!/usr/bin/env bash
# ============================================================
# SiMarsel — Setup Nginx vhosts + Let's Encrypt SSL
#
# Yang dilakukan:
#   1. Render template *.conf.template → /etc/nginx/sites-available/
#      dengan domain replacement
#   2. Symlink ke sites-enabled/, disable default
#   3. Generate basic auth file untuk Studio
#   4. nginx -t, reload
#   5. certbot --nginx untuk 4 subdomain (Let's Encrypt)
#   6. Final reload
#
# Idempotent: aman dijalankan ulang.
# ============================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Jalankan dengan sudo." >&2
  exit 1
fi

DOMAIN="${DOMAIN:-marsel-base.online}"
APP_HOST="app.${DOMAIN}"
API_HOST="api.${DOMAIN}"
STUDIO_HOST="studio.${DOMAIN}"
N8N_HOST="n8n.${DOMAIN}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_DIR="${REPO_ROOT}/deploy/nginx"

# ---------- Email untuk Let's Encrypt ----------
LE_EMAIL="${LE_EMAIL:-}"
if [[ -z "$LE_EMAIL" ]]; then
  read -rp "Email untuk Let's Encrypt notifications: " LE_EMAIL
fi

# ---------- 1. Render templates → sites-available ----------
echo "==> [1/6] Render nginx vhost"
for name in app api studio n8n; do
  src="${TEMPLATE_DIR}/${name}.conf.template"
  dst="/etc/nginx/sites-available/${name}.${DOMAIN}.conf"
  if [[ ! -f "$src" ]]; then
    echo "  Template ${src} tidak ada, skip." >&2
    continue
  fi
  sed "s/__DOMAIN__/${DOMAIN}/g" "$src" > "$dst"
  echo "  ${dst}"
done

# ---------- Sebelum certbot, comment dulu block 443 ----------
# certbot --nginx butuh nginx aktif via HTTP. Kita render template dengan
# block 443 utuh, tapi sebelum cert ada, comment block tersebut supaya
# nginx tidak error "no SSL cert".
echo "==> [1b/6] Comment block 443 sementara (sebelum cert tersedia)"
for name in app api studio n8n; do
  conf="/etc/nginx/sites-available/${name}.${DOMAIN}.conf"
  [[ -f "$conf" ]] || continue
  # Hanya comment kalau cert belum ada
  cert_path="/etc/letsencrypt/live/${name}.${DOMAIN}/fullchain.pem"
  if [[ ! -f "$cert_path" ]]; then
    # Wrap block "listen 443" sampai matching `}` jadi comment-out.
    # Cara aman: kita biarkan, tapi tambah `# pre-cert: 443 disabled`
    # comment marker. Block 443 di template kita sudah tidak ada
    # ssl_certificate, jadi nginx -t akan fail. Solusi: temporary
    # rewrite — letakkan sebelum cert ada, hapus block 443 dgn awk.
    awk '
      /^server \{/ { in_server = 1; block = $0 "\n"; has443 = 0; next }
      in_server { block = block $0 "\n"; if ($0 ~ /listen 443/) has443 = 1 }
      /^\}/ && in_server {
        if (!has443) printf "%s", block;
        in_server = 0; block = ""; has443 = 0;
        next
      }
      !in_server { print }
    ' "$conf" > "${conf}.tmp"
    mv "${conf}.tmp" "$conf"
  fi
done

# ---------- 2. Symlink ke sites-enabled ----------
echo "==> [2/6] Symlink → sites-enabled, disable default"
rm -f /etc/nginx/sites-enabled/default
for name in app api studio n8n; do
  src="/etc/nginx/sites-available/${name}.${DOMAIN}.conf"
  dst="/etc/nginx/sites-enabled/${name}.${DOMAIN}.conf"
  [[ -f "$src" ]] || continue
  ln -sf "$src" "$dst"
done

# ---------- 3. Studio basic auth ----------
HTPASSWD_FILE="/etc/nginx/.htpasswd-studio"
if [[ ! -f "$HTPASSWD_FILE" ]]; then
  echo "==> [3/6] Generate basic auth credentials untuk Studio"
  # Pastikan apache2-utils ter-install
  if ! command -v htpasswd >/dev/null 2>&1; then
    apt-get install -y apache2-utils
  fi
  read -rp "  Username Studio: " STUDIO_USER
  read -rsp "  Password Studio: " STUDIO_PASS
  echo
  htpasswd -bc "$HTPASSWD_FILE" "$STUDIO_USER" "$STUDIO_PASS"
  chmod 640 "$HTPASSWD_FILE"
  chown root:www-data "$HTPASSWD_FILE"
else
  echo "==> [3/6] Studio basic auth sudah ada, skip."
  echo "  Untuk update: sudo htpasswd ${HTPASSWD_FILE} <user>"
fi

# ---------- 4. nginx -t + reload ----------
echo "==> [4/6] nginx -t + reload"
nginx -t
systemctl reload nginx

# ---------- 5. Let's Encrypt ----------
echo "==> [5/6] certbot untuk 4 subdomain"
echo "  (DNS harus sudah propagate ke IP VPS dulu)"
read -rp "  Lanjut certbot? [y/N] " CONFIRM
if [[ "$CONFIRM" =~ ^[yY]$ ]]; then
  certbot --nginx \
    -d "$APP_HOST" \
    -d "$API_HOST" \
    -d "$STUDIO_HOST" \
    -d "$N8N_HOST" \
    --email "$LE_EMAIL" \
    --agree-tos \
    --redirect \
    --non-interactive
else
  echo "  Skip certbot. Jalankan manual nanti:"
  echo "  sudo certbot --nginx -d ${APP_HOST} -d ${API_HOST} -d ${STUDIO_HOST} -d ${N8N_HOST} --email ${LE_EMAIL} --agree-tos --redirect"
fi

# Setelah cert ada, re-render template lengkap (block 443 utuh)
echo "==> [5b/6] Re-render config dengan block 443 lengkap"
for name in app api studio n8n; do
  src="${TEMPLATE_DIR}/${name}.conf.template"
  dst="/etc/nginx/sites-available/${name}.${DOMAIN}.conf"
  cert_path="/etc/letsencrypt/live/${name}.${DOMAIN}/fullchain.pem"
  if [[ -f "$cert_path" ]]; then
    sed "s/__DOMAIN__/${DOMAIN}/g" "$src" > "$dst"
    # Inject ssl_certificate refs
    sed -i "s|# ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;|ssl_certificate /etc/letsencrypt/live/${name}.${DOMAIN}/fullchain.pem;|" "$dst"
    sed -i "s|# ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;|ssl_certificate_key /etc/letsencrypt/live/${name}.${DOMAIN}/privkey.pem;|" "$dst"
    sed -i "s|# include /etc/letsencrypt/options-ssl-nginx.conf;|include /etc/letsencrypt/options-ssl-nginx.conf;|" "$dst"
    sed -i "s|# ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;|ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;|" "$dst"
  fi
done

# ---------- 6. Final reload ----------
echo "==> [6/6] Final nginx -t + reload"
nginx -t
systemctl reload nginx

echo
echo "=========================================="
echo " Nginx + SSL deploy SUKSES"
echo "=========================================="
echo " Sekarang seharusnya bisa diakses:"
echo "   https://${APP_HOST}        — SiMarsel"
echo "   https://${API_HOST}        — Supabase API"
echo "   https://${STUDIO_HOST}     — Studio (basic auth)"
echo "   https://${N8N_HOST}        — n8n"
echo
echo " Auto-renew certbot:"
echo "   systemctl list-timers | grep certbot"
echo "=========================================="
