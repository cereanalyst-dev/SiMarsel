# BRIEF: Deploy SiMarsel End-to-End ke Production

## Konteks
**SiMarsel** = dashboard analitik sales & marketing untuk PT. Cerebrum Edukanesia. Stack: React 19 + Vite + Tailwind + Recharts (frontend), Supabase Postgres + Auth + RLS (backend). Repo GitHub: `cereanalyst-dev/simarsel`. Branch kerja: `claude/review-code-explanation-O40zY`.

## Tujuan
Otomatiskan full-publish: konfigurasi Supabase, jalankan migrasi, set env Vercel, push, dan verifikasi build live. Selesai = URL Vercel bisa login & menampilkan dashboard tanpa error.

## Prasyarat (user harus siapkan & berikan ke agent)
1. **Supabase project** sudah dibuat di https://supabase.com (atau minta agent buatkan via Supabase Management API jika ada `SUPABASE_ACCESS_TOKEN`).
   - Project URL (`VITE_SUPABASE_URL`)
   - `anon public` key (`VITE_SUPABASE_ANON_KEY`)
   - Project ID (untuk `supabase gen types`)
   - `service_role` key (HANYA untuk seeding admin, JANGAN commit & JANGAN expose ke Vite env)
2. **Vercel access**:
   - `VERCEL_TOKEN` (dari https://vercel.com/account/tokens)
   - `VERCEL_ORG_ID` = `cereanalyst-devs-projects`
   - `VERCEL_PROJECT_ID` = ID project `si-marsel`
3. **Email admin pertama** (akun yang akan di-promote ke `role = 'admin'`).
4. **Domain custom** (opsional): kalau ada, sertakan agar agent set di Vercel + Supabase Auth Redirect URLs.

## Tugas agent (langkah berurutan)

### 1. Sanity check repo
- `git status` bersih, di branch `claude/review-code-explanation-O40zY`
- `npm install`
- `npm run lint` (= `tsc --noEmit`) harus pass
- `npm run build` harus pass dan menghasilkan `dist/`

### 2. Tambahkan `vercel.json` untuk SPA rewrites
React Router perlu rewrite agar refresh di sub-route tidak 404. Tulis file di root repo:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Commit dengan message: `chore: add vercel SPA rewrites`.

### 3. Supabase: jalankan semua migrasi
Urutan WAJIB (dependensi antar tabel):
```
supabase/migrations/0001_extensions.sql
supabase/migrations/0002_profiles_and_roles.sql
supabase/migrations/0003_apps.sql
supabase/migrations/0004_transactions.sql
supabase/migrations/0005_downloaders.sql
supabase/migrations/0006_target_configs.sql
supabase/migrations/0007_daily_data.sql
supabase/migrations/0008_social_media_contents.sql
supabase/migrations/0009_audit_log.sql
supabase/migrations/0010_audit_triggers.sql
supabase/migrations/0011_updated_at_triggers.sql
supabase/migrations/0012_rls_policies.sql
```
Cara jalankan (pilih satu):
- **Supabase CLI** (preferred):
  ```bash
  npx supabase login
  npx supabase link --project-ref <PROJECT_ID>
  npx supabase db push
  ```
- **Manual SQL editor**: copy-paste tiap file urut.

### 4. Seed app rows
Insert 7 baris `apps` (nama harus match konstanta yang dipakai dashboard):
```sql
insert into public.apps (name) values
  ('JADIASN'), ('JADIBUMN'), ('JADIPOLRI'),
  ('JADIPPPK'), ('JADITNI'),  ('JADICPNS'),
  ('CEREBRUM')
on conflict (name) do nothing;
```

### 5. Regenerate types (opsional tapi disarankan)
```bash
npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
git diff src/types/database.ts
```
Jika ada perubahan, commit: `chore: regenerate supabase types`.

### 6. Konfigurasi Vercel
Pakai Vercel CLI dengan `VERCEL_TOKEN`:
```bash
npm i -g vercel
vercel link --yes --project si-marsel --scope cereanalyst-devs-projects --token $VERCEL_TOKEN

# Set env (production)
vercel env add VITE_SUPABASE_URL production --token $VERCEL_TOKEN     # paste URL
vercel env add VITE_SUPABASE_ANON_KEY production --token $VERCEL_TOKEN # paste anon key
# Ulangi untuk preview & development environment kalau perlu
```
Pastikan **Build Command** = `npm run build`, **Output Directory** = `dist`, **Framework** = Vite (auto-detect dari `vite.config.ts`).

### 7. Konfigurasi Supabase Auth URLs
Di Supabase dashboard → Authentication → URL Configuration:
- **Site URL** = `https://<vercel-prod-domain>` (mis. `https://si-marsel.vercel.app`)
- **Redirect URLs** = tambahkan:
  - `https://<vercel-prod-domain>/**`
  - `https://*.vercel.app/**` (untuk preview deployments)
  - `http://localhost:3000/**` (dev lokal)

### 8. Push & deploy
```bash
git push -u origin claude/review-code-explanation-O40zY
```
Vercel auto-build dari push. Jika ingin merge ke `main` dulu untuk production deploy, buat PR (TANYA user dulu sebelum membuka PR — repo policy).

Atau force trigger production deploy:
```bash
vercel --prod --token $VERCEL_TOKEN
```

### 9. Promote admin pertama
Setelah user signup via UI di domain Vercel, jalankan di Supabase SQL editor:
```sql
update public.profiles
set role = 'admin'
where email = '<EMAIL_ADMIN>';
```

### 10. Smoke test live
Buka URL produksi, lalu cek:
- [ ] Halaman `/login` render, tidak ada warning `[supabase] VITE_SUPABASE_URL ... missing` di console
- [ ] Signup → cek email confirmation (kalau enabled di Supabase)
- [ ] Login → redirect ke Dashboard tanpa loop
- [ ] Tab **Strategy & Target** load app list (7 app)
- [ ] Tab **Settings** → upload Excel sample → tabel `transactions` & `downloaders` terisi
- [ ] Tab **Audit Log** (admin only) tampil, berisi entry dari edit barusan
- [ ] Refresh `/dashboard` tidak 404 (verifikasi `vercel.json` aktif)

### 11. Lapor ke user
Kirim ringkasan:
- URL production
- Commit SHA terakhir
- Screenshot/curl `200 OK` halaman utama
- Daftar item smoke test yang lulus / gagal
- Kalau gagal: error log + langkah perbaikan yang diusulkan

## Aturan & Guardrail
- **JANGAN** commit `service_role` key, `.env.local`, atau credentials apapun.
- **JANGAN** push ke branch lain selain `claude/review-code-explanation-O40zY`. Untuk merge ke `main`, minta izin user.
- **JANGAN** buka PR tanpa diminta eksplisit.
- **JANGAN** pakai `--force` push.
- Jika hook/CI gagal, fix root cause — jangan `--no-verify`.
- Kalau ada langkah yang butuh keputusan (mis. domain custom, auth provider tambahan, RLS policy change), **stop & tanya user**.

## Definition of Done
URL produksi Vercel: bisa diakses publik, login + signup berfungsi, hydration data dari Supabase sukses, tidak ada error 4xx/5xx di Network tab pada golden path, dan smoke test step 10 semuanya tercentang.
