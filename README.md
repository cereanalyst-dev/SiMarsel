# SiMarsel — Marketing & Sales Dashboard

Dashboard analitik yang ditulis ulang untuk menggabungkan performa transaksi
dan downloader lintas aplikasi (JADIASN, JADIBUMN, JADIPOLRI, dst), dengan
modul target operasional, saran harga, kalender paket, dan analisis konten
sosial media.

![bundle report](https://img.shields.io/badge/main%20bundle-28kb-green)

## Tech Stack

- **React 19** + **TypeScript** (lazy-loaded feature chunks via Vite)
- **Tailwind CSS 4** untuk styling
- **Recharts** untuk visualisasi
- **motion/react** untuk animasi
- **xlsx** untuk parsing Excel
- **Supabase** untuk auth + persistence data & snapshot target operasional
- **Vitest** untuk unit test lib

## Customize dalam 60 Detik

Semua yang sering ingin diganti sudah dikumpulkan di **[`src/config/app.config.ts`](src/config/app.config.ts)**. Buka file itu, ganti sesuai kebutuhan, save — selesai. Contoh hal yang bisa diganti:

| Ingin ganti… | Ubah di file `app.config.ts` |
|---|---|
| Nama app (mis. "SiMarsel" → brand Anda) | `APP_NAME` |
| Nama perusahaan di sidebar | `COMPANY_NAME` |
| Tagline di footer | `COMPANY_TAGLINE` |
| Logo (taruh file di `public/`) | `LOGO_PATH` |
| Mapping nama panjang → pendek (JADIASN → ASN) | `APP_SHORT_NAMES` |
| Warna chart | `CHART_COLORS` |
| Tab di sidebar (tambah/hapus/urutan) | `MENU_ITEMS` |
| Tab default saat buka dashboard | `DEFAULT_TAB` |
| Format angka/mata uang | `LOCALE`, `CURRENCY` |
| Email support di halaman error | `SUPPORT_EMAIL` |
| Limit baris dari Supabase | `MAX_ROWS_PER_QUERY` |

Untuk logo, letakkan file (JPG/PNG/SVG) di folder `public/` lalu set `LOGO_PATH = '/nama-file.ext'`.

Secret seperti URL/key Supabase **tidak** di file ini — pakai `.env.local` (lihat bawah).

## Setup Lokal

Prasyarat: Node.js 20+.

```bash
git clone <repo>
cd SiMarsel
npm install
cp .env.example .env.local
# isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY (lihat bawah)
npm run dev
```

Perintah lain:

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest
npm run lint        # tsc + eslint
npm run build       # vite build
npm run preview     # serve dist/
```

## Konfigurasi Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Di **SQL editor**, jalankan file [`supabase/schema.sql`](supabase/schema.sql)
   untuk membuat tabel `apps_snapshot`, `transactions`, `downloaders` beserta
   RLS policy dan trigger.
3. Di **Auth → Providers**, aktifkan **Email** (ditambah provider lain sesuai
   kebutuhan). Jika ingin disabled email confirmation, matikan "Confirm email".
4. Dari **Project Settings → API**, salin:
   - Project URL → `VITE_SUPABASE_URL`
   - anon public key → `VITE_SUPABASE_ANON_KEY`
5. Simpan di `.env.local`.

Skema RLS saat ini mengizinkan semua user yang sudah auth untuk
membaca/menulis transaksi dan downloader (single-org). Snapshot target
operasional (`apps_snapshot`) dibatasi per-user.

## Mode Penggunaan

- **Cloud mode** (Supabase terkonfigurasi): login via email, data target
  disinkronkan ke Supabase, transaksi & downloader dibaca dari Supabase,
  upload Excel baru akan melakukan upsert ke Supabase.
- **Local mode** (tanpa Supabase): aplikasi masih jalan, data operasional
  disimpan di `localStorage`, transaksi harus di-upload manual setiap sesi.

## Struktur Folder

```
src/
├── App.tsx                   # orchestrator tipis (~450 baris)
├── main.tsx
├── types.ts                  # interface utama (Transaction, DailyData, dsb.)
├── vite-env.d.ts
├── index.css
├── components/               # komponen lintas-fitur
│   ├── CustomTooltip.tsx
│   ├── DrillDownModal.tsx
│   ├── ErrorBoundary.tsx
│   ├── FilterSection.tsx
│   ├── FlexibleChart.tsx
│   ├── LoginScreen.tsx
│   └── StatCard.tsx
├── layout/
│   ├── Sidebar.tsx
│   └── TopBar.tsx
├── features/
│   ├── overview/Overview.tsx
│   ├── packages/Packages.tsx
│   ├── pricing/PriceSuggestion.tsx
│   ├── pricing/PricingComparison.tsx
│   ├── target/TargetSection.tsx
│   ├── target/SocialMediaModal.tsx
│   ├── calendar/PackageCalendar.tsx
│   ├── social/SocialMediaAnalysis.tsx
│   └── settings/SettingsSection.tsx
├── lib/
│   ├── constants.ts
│   ├── dailyInsight.ts
│   ├── dataAccess.ts         # Supabase + localStorage persistence
│   ├── dataProcessing.ts
│   ├── excel.ts
│   ├── excelDate.ts
│   ├── formatters.ts
│   ├── supabase.ts
│   └── utils.ts
└── test/setup.ts

supabase/
└── schema.sql                # skema & RLS policy
```

## Cara Import Data Pertama Kali

1. Siapkan file Excel dengan 2 sheet: `TRANSAKSI` dan `DOWNLOADER` (nama
   fleksibel — parser mengenali alias: `trx`, `paid`, `download`).
2. Kolom minimum di sheet TRANSAKSI: `trx_id`, `source_app`, `revenue`,
   `payment_date`, `content_name`, `methode_name`, `email`, `phone`.
3. Sheet DOWNLOADER berbentuk *wide*: kolom pertama `Tanggal`, sisanya 1 kolom
   per source app dengan nilai jumlah download.
4. Masuk ke tab **Settings** → pilih mode **Ganti Data Total** atau
   **Tambah Data** → drop file `.xlsx`. Jika Supabase aktif, datanya akan
   langsung terupload.

## Testing

Unit test untuk lib pure-function ada di `src/lib/*.test.ts`. Jalankan:

```bash
npm run test
```
