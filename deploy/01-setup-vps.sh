#!/usr/bin/env bash
# ============================================================
# SiMarsel — VPS initial setup (sekali jalan)
# Target: Ubuntu 22.04/24.04 LTS
#
# Yang dilakukan:
#   1. Update OS + install paket dasar
#   2. Buat user 'deploy' dengan sudo NOPASSWD (kalau belum ada)
#   3. Setup swap 4 GB (kalau belum ada)
#   4. Install Docker CE + compose plugin
#   5. Install Nginx + certbot
#   6. UFW firewall (allow OpenSSH, 80, 443)
#   7. fail2ban dengan jail SSH default
#
# Idempotent: aman dijalankan ulang.
# ============================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Jalankan sebagai root atau dengan sudo." >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SWAP_SIZE_GB="${SWAP_SIZE_GB:-4}"

echo "==> [1/7] Update OS + paket dasar"
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  ca-certificates curl gnupg lsb-release \
  git unzip jq htop ncdu rsync openssl \
  ufw fail2ban

echo "==> [2/7] User '${DEPLOY_USER}'"
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  echo "User ${DEPLOY_USER} dibuat. Set password atau pakai SSH key."
fi
usermod -aG sudo "$DEPLOY_USER"
# Sudo NOPASSWD untuk deploy automation
SUDOERS_FILE="/etc/sudoers.d/${DEPLOY_USER}"
if [[ ! -f "$SUDOERS_FILE" ]]; then
  echo "${DEPLOY_USER} ALL=(ALL) NOPASSWD:ALL" > "$SUDOERS_FILE"
  chmod 440 "$SUDOERS_FILE"
fi

# Copy authorized_keys dari root kalau ada (supaya SSH key tetap jalan)
if [[ -f /root/.ssh/authorized_keys ]]; then
  mkdir -p "/home/${DEPLOY_USER}/.ssh"
  cp /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
  chmod 700 "/home/${DEPLOY_USER}/.ssh"
  chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi

echo "==> [3/7] Swap ${SWAP_SIZE_GB} GB"
if [[ ! -f /swapfile ]]; then
  fallocate -l "${SWAP_SIZE_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
  echo "Swap aktif: $(free -h | awk '/Swap/{print $2}')"
else
  echo "Swap sudah ada, skip."
fi

# Tweak swappiness biar swap dipakai sesuai kebutuhan, bukan agresif
sysctl -w vm.swappiness=10 >/dev/null
grep -q "^vm.swappiness" /etc/sysctl.conf || echo "vm.swappiness=10" >> /etc/sysctl.conf

echo "==> [4/7] Docker CE + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"

echo "==> [5/7] Nginx + certbot"
apt-get install -y nginx
apt-get install -y certbot python3-certbot-nginx
systemctl enable --now nginx

echo "==> [6/7] UFW firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status

echo "==> [7/7] fail2ban"
systemctl enable --now fail2ban

echo
echo "=========================================="
echo " VPS setup selesai."
echo "=========================================="
echo " Langkah berikut:"
echo "  1) Logout (exit), lalu SSH ulang sebagai user '${DEPLOY_USER}':"
echo "       ssh ${DEPLOY_USER}@\$(hostname -I | awk '{print \$1}')"
echo "  2) cd /opt/simarsel/deploy"
echo "  3) sudo bash 02-supabase-deploy.sh"
echo "=========================================="
