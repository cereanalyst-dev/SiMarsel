# SiMarsel — Self-Hosted Deployment Guide

Panduan deploy SiMarsel ke VPS Hostinger KVM 2 (atau VPS Ubuntu lain dengan
≥4 GB RAM). Stack:

- **Supabase** (PostgreSQL + Auth + REST + Realtime + Storage + Studio)
- **n8n** (workflow automation, untuk insert data dari sumber lain)
- **SiMarsel frontend** (static SPA, build dari Vite)
- **Nginx** (reverse proxy + Let's Encrypt SSL)

Domain target: `marsel-base.online` dengan 4 subdomain:

| Subdomain                          | Tujuan                       |
|-----------------------------------|------------------------------|
| `app.marsel-base.online`          | Frontend SiMarsel            |
| `api.marsel-base.online`          | Supabase API gateway (Kong)  |
| `studio.marsel-base.online`       | Supabase Studio (admin UI)   |
| `n8n.marsel-base.online`          | n8n editor                   |

Total proses sekitar **30-60 menit** kalau pertama kali. Sebagian besar
script sudah otomatis; hanya beberapa langkah manual (DNS, SSL, env vars).

---

## Prasyarat

1. **VPS Hostinger KVM 2** sudah aktif (atau VPS lain dengan ≥4 GB RAM, Ubuntu 22.04/24.04 LTS).
2. **Domain** `marsel-base.online` sudah dimiliki dan bisa atur DNS.
3. **SSH access** ke VPS sebagai root atau user dengan sudo.
4. **Laptop lokal** dengan akses ke repo SiMarsel ini (perlu untuk build frontend).

---

## Step 0 — Setup DNS

Sebelum semua, tambahkan 4 A record di DNS provider (cPanel Hostinger, Cloudflare, dll):

```
Type   Name      Value (IP VPS)        TTL
A      app       <IP_PUBLIK_VPS>       Auto
A      api       <IP_PUBLIK_VPS>       Auto
A      studio    <IP_PUBLIK_VPS>       Auto
A      n8n       <IP_PUBLIK_VPS>       Auto
```

Tunggu propagasi (biasanya 1-15 menit). Cek dengan:

```bash
dig +short app.marsel-base.online
dig +short api.marsel-base.online
# Harus return IP VPS Anda.
```

> **Tip**: Kalau pakai Cloudflare, set proxy status ke **DNS only** (icon abu-abu, bukan oranye) dulu. Setelah Let's Encrypt sukses, baru bisa diaktifkan proxy.

---

## Step 1 — SSH ke VPS dan Clone Deploy Files

```bash
# Dari laptop lokal
ssh root@<IP_VPS>

# Sekali masuk:
apt update
apt install -y git
git clone https://github.com/cereanalyst-dev/simarsel.git /opt/simarsel
cd /opt/simarsel/deploy
```

> **Branch** untuk deploy ini: `claude/debug-code-review-KpQ26` (atau `main` setelah di-merge). Kalau deploy dari branch:
> `git -C /opt/simarsel checkout claude/debug-code-review-KpQ26`

---

## Step 2 — VPS Setup (1x saja)

Script ini melakukan: update OS, buat user `deploy` (sudo), setup SSH key (kalau Anda punya), enable swap 4 GB, install Docker + Docker Compose plugin, install Nginx + certbot, set firewall (ufw allow 22/80/443), install fail2ban.

```bash
cd /opt/simarsel/deploy
bash 01-setup-vps.sh
```

Setelah selesai, **logout dan login ulang** sebagai user `deploy` yang baru dibuat (bukan root):

```bash
exit
ssh deploy@<IP_VPS>
```

Selanjutnya semua command dijalankan sebagai user `deploy`. Cek Docker jalan:

```bash
docker ps          # Harus tidak error
docker compose version
```

---

## Step 3 — Deploy Supabase

```bash
cd /opt/simarsel/deploy
sudo bash 02-supabase-deploy.sh
```

Script ini:
1. Clone repo `supabase/supabase` ke `/opt/supabase-src` (sparse, hanya folder docker)
2. Copy ke `/opt/supabase`
3. Generate kunci: `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, dashboard credentials
4. Tulis `.env` dengan domain `api.marsel-base.online`, `studio.marsel-base.online`
5. Set `ENABLE_EMAIL_AUTOCONFIRM=true` (skip email confirmation)
6. `docker compose up -d`
7. Tunggu sampai semua container `(healthy)`, lalu apply `supabase/schema.sql` SiMarsel

Setelah selesai, script print **`ANON_KEY`** dan **`SERVICE_ROLE_KEY`** — **simpan baik-baik**, dipakai untuk:
- `ANON_KEY` → `.env.production` frontend (Step 5)
- `SERVICE_ROLE_KEY` → n8n + script-script admin (jangan pernah expose ke browser)

> **Penting**: kunci-kunci ini juga tersimpan di `/opt/supabase/.env` (akses root only).

Cek Supabase jalan:

```bash
docker compose -f /opt/supabase/docker-compose.yml ps
# Semua harus state "Up" + health "(healthy)" untuk db, kong, auth, rest, realtime, storage
```

---

## Step 4 — Deploy n8n

```bash
cd /opt/simarsel/deploy
sudo bash 03-n8n-deploy.sh
```

Script ini:
1. Buat `/opt/n8n/docker-compose.yml` (n8n attach ke network Supabase via external)
2. Generate password admin n8n random
3. `docker compose up -d`

Setelah jalan, n8n akan listen di `localhost:5678`. Akses lewat `n8n.marsel-base.online` setelah Step 6 (nginx + SSL).

Connection string n8n → Supabase Postgres (untuk node Postgres di workflow):
```
Host: supabase-db
Port: 5432
Database: postgres
User: postgres
Password: <POSTGRES_PASSWORD dari /opt/supabase/.env>
SSL: disable (internal docker network)
```

---

## Step 5 — Build & Deploy Frontend

Frontend (Vite SPA) **harus di-build dengan env vars production di-bake**. Build bisa di laptop lokal atau di VPS.

### Opsi A: Build di VPS (lebih simple, butuh Node.js)

```bash
cd /opt/simarsel/deploy
sudo bash 04-frontend-deploy.sh
```

Script akan:
1. Install Node.js 20 LTS kalau belum ada
2. `cd /opt/simarsel && npm ci`
3. Tanya VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY (atau baca dari `/opt/supabase/.env`)
4. `npm run build`
5. Copy `dist/` ke `/var/www/simarsel/`
6. Set permission `www-data:www-data`

### Opsi B: Build di laptop lokal, upload via rsync

```bash
# Di laptop lokal:
cd /path/ke/SiMarsel
cat > .env.production <<EOF
VITE_SUPABASE_URL=https://api.marsel-base.online
VITE_SUPABASE_ANON_KEY=<ANON_KEY dari Step 3>
EOF

npm run build

rsync -avz --delete dist/ deploy@<IP_VPS>:/var/www/simarsel/
```

---

## Step 6 — Setup Nginx + SSL

```bash
cd /opt/simarsel/deploy
sudo bash 05-nginx-setup.sh
```

Script ini:
1. Copy template `nginx/*.conf` ke `/etc/nginx/sites-available/`, ganti placeholder `__DOMAIN__` ke `marsel-base.online`
2. `ln -s` ke `sites-enabled`
3. `nginx -t`
4. `certbot --nginx -d app.marsel-base.online -d api.marsel-base.online -d studio.marsel-base.online -d n8n.marsel-base.online --email anda@email.com --agree-tos --non-interactive`
5. `systemctl reload nginx`

**Studio dilindungi Basic Auth.** Script akan tanya username/password Studio. Simpan baik-baik.

Setelah selesai, semua subdomain bisa diakses lewat HTTPS:

- `https://app.marsel-base.online` → SiMarsel
- `https://api.marsel-base.online/rest/v1/` → Supabase REST API
- `https://studio.marsel-base.online` → Studio (login basic auth, lalu dashboard credentials Supabase)
- `https://n8n.marsel-base.online` → n8n (login first run)

Certbot auto-renew sudah dijadwalkan via systemd timer (cek: `systemctl list-timers | grep certbot`).

---

## Step 7 — Migrasi Data dari Supabase Cloud (kalau ada)

Lihat **`MIGRATION.md`** untuk panduan detail. Ringkasnya:

1. Dump dari Supabase Cloud:
   ```bash
   pg_dump "postgresql://postgres:<PWD>@db.<projectref>.supabase.co:5432/postgres" \
     --no-owner --no-acl --clean --if-exists \
     -F c -f cloud-backup.dump
   ```

2. Upload ke VPS:
   ```bash
   scp cloud-backup.dump deploy@<IP_VPS>:/tmp/
   ```

3. Restore di VPS (di dalam container Postgres Supabase):
   ```bash
   docker cp /tmp/cloud-backup.dump supabase-db:/tmp/
   docker exec -it supabase-db pg_restore \
     -U postgres -d postgres \
     --no-owner --no-acl --clean --if-exists \
     /tmp/cloud-backup.dump
   ```

> **Auth users**: schema `auth` punya struktur khusus. Kalau ingin migrasi user lengkap (sehingga user lama bisa langsung login), ada langkah ekstra di `MIGRATION.md`. Kalau cuma migrate data saja (user signup ulang), skip auth schema saat dump.

---

## Step 8 — Setup Backup Harian

```bash
cd /opt/simarsel/deploy
sudo cp backup.sh /usr/local/bin/simarsel-backup
sudo chmod +x /usr/local/bin/simarsel-backup
sudo crontab -e
```

Tambahkan baris:
```
0 2 * * * /usr/local/bin/simarsel-backup >> /var/log/simarsel-backup.log 2>&1
```

Backup akan jalan jam 02:00 setiap hari, simpan ke `/var/backups/postgres/` (retention 14 hari, gzip). Lihat `backup.sh` untuk customize retention/storage.

> **Strongly recommended**: copy backup ke storage lain (S3/Backblaze/rsync ke laptop). VPS yang sama = single point of failure.

---

## Operasi Sehari-hari

### Update Frontend (setelah merge ke main / fitur baru)

```bash
ssh deploy@<IP_VPS>
cd /opt/simarsel
git pull
sudo bash deploy/04-frontend-deploy.sh
```

### Update Supabase ke versi terbaru

```bash
cd /opt/supabase
sudo docker compose pull
sudo docker compose up -d
# Cek release notes Supabase untuk breaking changes:
# https://github.com/supabase/supabase/releases
```

### Cek logs

```bash
# Supabase
sudo docker compose -f /opt/supabase/docker-compose.yml logs -f --tail=100

# n8n
sudo docker compose -f /opt/n8n/docker-compose.yml logs -f --tail=100

# Nginx access/error
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart layanan

```bash
sudo docker compose -f /opt/supabase/docker-compose.yml restart
sudo docker compose -f /opt/n8n/docker-compose.yml restart
sudo systemctl reload nginx
```

### Resource monitoring

```bash
# Quick check
docker stats --no-stream
free -h
df -h

# Atau install monitoring sederhana (opsional):
# - Uptime Kuma di port 3001 untuk uptime check
# - Glances / htop untuk live monitoring
```

---

## Troubleshooting

### Nginx 502 Bad Gateway untuk api.marsel-base.online

Supabase Kong belum siap. Cek:
```bash
sudo docker compose -f /opt/supabase/docker-compose.yml ps
# Pastikan supabase-kong status "Up" + healthy
sudo docker compose -f /opt/supabase/docker-compose.yml logs supabase-kong
```

### Supabase Auth: "User already registered" tapi user mau signup ulang

Database email_change_confirm mode masih old. Connect ke Studio, hapus dari `auth.users` table (atau pakai SQL Editor):
```sql
delete from auth.users where email = 'user@example.com';
```

### Frontend: "Failed to fetch" / CORS error

Cek `VITE_SUPABASE_URL` di build sesuai `https://api.marsel-base.online`. Lalu cek di Studio: Authentication → URL Configuration → set Site URL ke `https://app.marsel-base.online`.

### RAM penuh / OOM

```bash
free -h          # Cek penggunaan
docker stats     # Container mana yang paling boros
```

Solusi:
- Pastikan swap aktif: `swapon --show`
- Tune Postgres `shared_buffers` di Supabase (default 128 MB OK untuk 8 GB)
- Stop n8n sementara kalau tidak dipakai aktif: `sudo docker compose -f /opt/n8n/docker-compose.yml down`

### Certbot gagal: "DNS problem"

DNS belum propagate atau Cloudflare proxy nyala. Pastikan dig ke 4 subdomain return IP VPS, dan Cloudflare proxy off (DNS only).

---

## Daftar File di Folder ini

```
deploy/
├── README.md                    # File ini
├── 01-setup-vps.sh              # VPS hardening (1x jalan)
├── 02-supabase-deploy.sh        # Deploy Supabase + apply schema
├── 03-n8n-deploy.sh             # Deploy n8n
├── 04-frontend-deploy.sh        # Build frontend + deploy ke /var/www
├── 05-nginx-setup.sh            # Nginx vhosts + Let's Encrypt
├── backup.sh                    # Daily pg_dump cron
├── n8n-compose.yml              # Docker compose untuk n8n
├── nginx/
│   ├── app.conf.template        # Vhost frontend
│   ├── api.conf.template        # Vhost Supabase API
│   ├── studio.conf.template     # Vhost Supabase Studio + basic auth
│   └── n8n.conf.template        # Vhost n8n
└── MIGRATION.md                 # Panduan migrasi data dari Supabase Cloud
```

---

## Checklist Setelah Deploy

- [ ] DNS 4 subdomain resolve ke IP VPS
- [ ] `https://app.marsel-base.online` buka SiMarsel
- [ ] Bisa signup user baru, langsung bisa login (email auto-confirm)
- [ ] Buka Studio (`https://studio.marsel-base.online`), table `transactions`/`apps_snapshot`/dll sudah ada
- [ ] n8n login berhasil, bisa konek ke Postgres `supabase-db:5432`
- [ ] Cron backup di-schedule, tes manual: `sudo /usr/local/bin/simarsel-backup`
- [ ] Catat `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, Studio user/pass, n8n user/pass di password manager
- [ ] (Opsional) Setup monitoring: Uptime Kuma atau healthcheck cron

---

## Bantuan & Referensi

- Supabase self-hosting docs: https://supabase.com/docs/guides/self-hosting/docker
- n8n docs: https://docs.n8n.io/hosting/
- Let's Encrypt + Nginx: https://certbot.eff.org/instructions

Kalau stuck, copy error message + step yang sedang dijalankan, paste ke Claude/issue.
