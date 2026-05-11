# Migrasi Data: Supabase Cloud → Self-Hosted VPS

Panduan migrasi dataset eksisting dari Supabase Cloud ke instance self-hosted di VPS Hostinger.

## Skenario

Anda punya project di [supabase.com](https://supabase.com) (project ref misal `xyzabc.supabase.co`) dengan data production. Mau pindah ke VPS sendiri tanpa kehilangan data atau user.

## Yang akan di-migrate

- ✅ Schema (tabel, index, function, trigger, policy RLS)
- ✅ Data tabel (transactions, downloaders, kpi_*, dll)
- ⚠️ Auth users (perlu langkah ekstra; kalau skip, user signup ulang)
- ⚠️ Storage objects (file upload — kalau pakai Storage; copy via Storage API atau S3 sync)

---

## Step 1 — Dump dari Supabase Cloud (di laptop lokal)

### A. Dapatkan connection string

Login ke supabase.com → project Anda → **Settings → Database → Connection string**.

Format:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xyzabc.supabase.co:5432/postgres
```

> **Tip**: gunakan password DB yang ada di **Settings → Database → Database password** (klik "Reveal"). Ini beda dari password user dashboard supabase.com.

### B. Jalankan pg_dump (butuh PostgreSQL client lokal)

Install PostgreSQL client kalau belum:
```bash
# macOS
brew install postgresql@16
# Ubuntu
sudo apt install postgresql-client-16
# Windows: pakai pgAdmin atau WSL
```

Dump full database (skip schema yang dikelola Supabase internal):

```bash
pg_dump \
  "postgresql://postgres:YOUR-PWD@db.xyzabc.supabase.co:5432/postgres" \
  --no-owner --no-acl --clean --if-exists \
  --exclude-schema=storage \
  --exclude-schema=graphql \
  --exclude-schema=graphql_public \
  --exclude-schema=pgbouncer \
  --exclude-schema=realtime \
  --exclude-schema=supabase_functions \
  --exclude-schema=net \
  --exclude-schema=vault \
  --exclude-schema=pgsodium \
  --exclude-schema=pgsodium_masks \
  --exclude-schema=extensions \
  -F c \
  -f cloud-backup.dump
```

Penjelasan flag:
- `--no-owner --no-acl`: skip OWNER + GRANT statement (DB lokal punya user yang berbeda)
- `--clean --if-exists`: drop objects sebelum recreate (idempotent restore)
- `--exclude-schema=...`: skip schema yang Supabase manage internal (auto-created saat container start)
- `-F c`: format custom (compressed binary, lebih cepat dari plain SQL)

Output: `cloud-backup.dump` (~10-100 MB tergantung data).

> Kalau ada error "permission denied", coba juga `--exclude-schema=auth` lalu migrate auth terpisah (lihat Step 4).

### C. Optional: Dump auth.users saja (kalau mau migrate user)

```bash
pg_dump \
  "postgresql://postgres:YOUR-PWD@db.xyzabc.supabase.co:5432/postgres" \
  --no-owner --no-acl --data-only \
  --table=auth.users \
  --table=auth.identities \
  -F c \
  -f cloud-auth-users.dump
```

---

## Step 2 — Upload ke VPS

```bash
scp cloud-backup.dump deploy@<IP_VPS>:/tmp/
scp cloud-auth-users.dump deploy@<IP_VPS>:/tmp/   # kalau ada
```

---

## Step 3 — Restore ke Supabase self-hosted

Pastikan Supabase di VPS sudah jalan + schema SiMarsel sudah di-apply
(dari `02-supabase-deploy.sh`). Kalau sudah ada data dummy yang mau dibuang, OK
karena `--clean --if-exists` di dump akan drop dulu.

```bash
ssh deploy@<IP_VPS>

# Copy dump ke dalam container Postgres
docker cp /tmp/cloud-backup.dump supabase-db:/tmp/cloud-backup.dump

# Restore — restore akan jalan sebagai user 'postgres' (superuser)
docker exec -it supabase-db pg_restore \
  -U postgres \
  -d postgres \
  --no-owner --no-acl --clean --if-exists \
  /tmp/cloud-backup.dump
```

Akan ada beberapa **warning** (mis. "role X does not exist", "extension Y already exists") — bisa diabaikan kalau muncul karena schema-schema yang di-exclude. Yang penting tidak ada **error fatal**.

Cek hasilnya — buka Studio (`https://studio.marsel-base.online`), pilih
project Default, browse table:
- `transactions` — harus ada data
- `downloaders` — harus ada data
- `apps_snapshot` — kalau pakai
- `kpi_divisions/cards/metrics` — kalau pakai
- `promo_code_rules`, `insight_hasil` — schema baru, mungkin kosong

---

## Step 4 — Migrate Auth Users (Opsional)

Tabel `auth.users` di Supabase punya struktur khusus + trigger. Migrate harus
hati-hati karena ada relasi ke RLS policies di table public.

### Cara A: Restore data-only auth.users

```bash
docker cp /tmp/cloud-auth-users.dump supabase-db:/tmp/

# Disable trigger sementara (supaya restore tidak fail karena email confirm dll)
docker exec -it supabase-db psql -U postgres -d postgres -c "
ALTER TABLE auth.users DISABLE TRIGGER ALL;
ALTER TABLE auth.identities DISABLE TRIGGER ALL;
"

docker exec -it supabase-db pg_restore \
  -U postgres -d postgres \
  --no-owner --no-acl --data-only \
  /tmp/cloud-auth-users.dump

# Re-enable trigger
docker exec -it supabase-db psql -U postgres -d postgres -c "
ALTER TABLE auth.users ENABLE TRIGGER ALL;
ALTER TABLE auth.identities ENABLE TRIGGER ALL;
"
```

### Cara B: Buat ulang user satu-satu (lebih bersih untuk skala kecil)

Kalau cuma 5-10 user, lebih cepat suruh user signup ulang di
`https://app.marsel-base.online`. Karena `ENABLE_EMAIL_AUTOCONFIRM=true` di
self-hosted setup, mereka langsung bisa login tanpa konfirmasi email.

Setelah signup, kalau perlu link ke data lama (mis. `user_id` di tabel
`apps_snapshot` punya UUID lama), update manual via Studio:

```sql
update public.apps_snapshot
set user_id = '<UUID_BARU>'
where user_id = '<UUID_LAMA>';
```

(Ulang untuk setiap tabel yang punya `user_id`.)

---

## Step 5 — Migrate Storage Objects (kalau pakai)

Kalau Anda pakai Supabase Storage (file upload), object-nya disimpan di S3-compatible bucket. Self-hosted Storage default pakai filesystem container.

### Opsi 1: Copy via Storage API (untuk volume kecil)

Pakai script kecil yang download dari Cloud Storage API + upload ke self-hosted Storage API. Bisa pakai supabase-js atau curl. Ini di luar scope deploy script — buat custom kalau perlu.

### Opsi 2: Akses langsung S3 backing storage Cloud

Kalau Anda di paid plan, Supabase Cloud kasih akses S3 langsung. Pakai `aws s3 sync` atau `rclone copy` ke filesystem self-hosted (`/opt/supabase/volumes/storage/`).

---

## Step 6 — Update Frontend Config

Setelah data masuk di self-hosted DB, ganti env vars frontend ke arahkan ke API self-hosted:

`/opt/simarsel/.env.production`:
```
VITE_SUPABASE_URL=https://api.marsel-base.online
VITE_SUPABASE_ANON_KEY=<ANON_KEY dari /opt/supabase/.env>
```

Re-build + deploy:
```bash
sudo bash /opt/simarsel/deploy/04-frontend-deploy.sh
```

---

## Step 7 — Verifikasi

Buka `https://app.marsel-base.online`, login (signup ulang kalau auth users tidak di-migrate). Cek:

- [ ] Data transaksi muncul di Overview
- [ ] Apps di sidebar (Strategi & Target) muncul
- [ ] Data tahun-tahun lama bisa di-filter
- [ ] KPI card + metric bisa edit/save
- [ ] Promo code rules (kalau ada di lama) muncul

Kalau ada error 403 / 401 di console: kemungkinan RLS policy mengecek `auth.uid()` tapi user_id di data lama beda dari user yang sekarang login. Update user_id seperti di Cara B di atas.

---

## Step 8 — Cutover (kalau pernah live di Cloud)

Setelah self-hosted terbukti jalan benar dengan data live, point traffic dari
Cloud URL ke self-hosted:

1. Update DNS frontend (kalau frontend Anda di Vercel pointing ke Cloud
   Supabase URL): redeploy frontend ke arah self-hosted.
2. Pause project di Supabase Cloud (jangan delete dulu — biarin 1-2 minggu untuk safety).
3. Setelah yakin self-hosted stabil, baru delete project Cloud (dan stop billing).

---

## Rollback Plan

Kalau ada masalah serius pasca-cutover:

1. Self-hosted bermasalah? Frontend tinggal point balik ke `https://xyzabc.supabase.co` (env var `VITE_SUPABASE_URL`), re-build & deploy.
2. Data corruption di self-hosted? Restore dari backup (`/var/backups/postgres/supabase-*.sql.gz`).

```bash
# Restore dari backup harian
LATEST=$(ls -t /var/backups/postgres/supabase-*.sql.gz | head -1)
gunzip -c "$LATEST" | docker exec -i supabase-db pg_restore \
  -U postgres -d postgres \
  --no-owner --no-acl --clean --if-exists
```

---

## Tips & Gotchas

- **JWT_SECRET berbeda** antara Cloud dan self-hosted. Token yang sudah di-generate di Cloud TIDAK akan valid di self-hosted. User harus login ulang.
- **service_role_key** TIDAK boleh di-copy dari Cloud ke self-hosted. Sudah auto-generate baru di `02-supabase-deploy.sh`.
- **Realtime channel** subscription mungkin perlu re-subscribe setelah pindah karena WebSocket connection beda.
- **Edge Functions** (kalau pakai): tidak otomatis pindah. Self-hosted punya `supabase/functions` di compose. Deploy ulang manual via `supabase functions deploy`.
- **Backup dulu sebelum cutover**: jangan langsung delete project Cloud. Pastikan self-hosted stabil minimal 1 minggu.

Pertanyaan? Cek troubleshooting di `README.md` atau buka issue di repo.
