#!/usr/bin/env bash
# ============================================================
# Install alias 'simarsel-update' system-wide.
# Sekali install, lalu cukup ketik:
#
#   simarsel-update
#
# Dari mana saja di VPS — auto pull + build + reload nginx.
#
# Cara install (1x saja):
#   sudo bash /opt/simarsel/deploy/install-alias.sh
# ============================================================

set -e

if [[ $EUID -ne 0 ]]; then
  echo "Jalankan dengan sudo." >&2
  exit 1
fi

TARGET=/usr/local/bin/simarsel-update

cat > "$TARGET" <<'EOF'
#!/usr/bin/env bash
exec sudo bash /opt/simarsel/deploy/update.sh "$@"
EOF

chmod +x "$TARGET"

echo "✅ Alias terpasang: simarsel-update"
echo "Coba: simarsel-update"
