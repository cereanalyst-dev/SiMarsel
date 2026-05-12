# Live Marsel

Realtime analytics dashboard untuk display TV — Next.js 16 + Supabase Realtime + neubrutalism design.

Connect ke Supabase backend yang sama dengan SiMarsel (data source: `transactions`, `downloaders`, `target_config`).

## Setup

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local: isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Buka `http://localhost:3000`.

## Migrasi DB (sekali, di Supabase Studio)

Jalankan SQL di `supabase/migrations/20260518_dashboard_year_totals_rpc.sql` untuk bikin RPC `dashboard_year_totals(year_param)`.

## URL Pattern

- `/` — dashboard untuk bulan & tahun saat ini
- `/?period=2026-05` — dashboard untuk Mei 2026 (bookmarkable)
- `/login` — login Supabase
- `/settings/periode` — pilih periode (auth required)

## Deploy ke Vercel

1. Push ke GitHub (sudah)
2. Import repo di vercel.com
3. Set env vars: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy
