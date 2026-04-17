# SiMarsel

Sales & marketing analytics dashboard for PT. Cerebrum Edukanesia, covering
JADIASN, JADIBUMN, JADIPOLRI, JADIPPPK, JADITNI, JADICPNS, and CEREBRUM.

Frontend: React 19 + Vite + Tailwind + Recharts.
Backend: Supabase (PostgreSQL + Auth + Storage) with row-level security.

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at https://supabase.com.
2. In the SQL editor, run every file in `supabase/migrations/` in order
   (`0001_extensions.sql` → `0012_rls_policies.sql`). A consolidated copy is
   at `docs/schema.sql`.
3. Grab `Project URL` and `anon public` key from Project Settings → API.

### 3. Configure env vars

```bash
cp .env.example .env.local
# then edit .env.local and fill in:
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...
```

The anon key is safe to ship to the browser; RLS policies gate every table.
Never put the `service_role` key in a `VITE_*` variable.

### 4. Run

```bash
npm run dev
```

Sign up, then promote yourself to admin from the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Roles

| Role | Read | Can import Excel / write transactions | Edit daily ops | Admin tab |
|---|---|---|---|---|
| admin | all tables | yes | yes | yes |
| marketing | all tables | yes | yes | no |
| sales | all tables | no (read-only for transactions/downloaders) | yes | no |

## Data flow

- **Excel import** — Settings → upload. `src/services/excelImport.ts`
  parses the workbook in the browser, validates with Zod, and chunk-upserts
  into `transactions` and `downloaders`. Idempotent: re-uploading the same
  file produces no duplicates thanks to the `(trx_id, source_app)` and
  `(date, source_app)` unique constraints.
- **Targets & daily ops** — Edited in the Strategy & Target tab. The in-memory
  `apps` state is hydrated from `apps` + `target_configs` + `daily_data` +
  `social_media_contents` on load (`useAppsSync.loadAppsFromSupabase`) and
  delta-synced back on a 1.5-second debounce (`useAppsSync`).
- **Audit log** — Every INSERT/UPDATE/DELETE on `target_configs`, `daily_data`,
  `social_media_contents`, and `apps` is captured by the
  `audit_trigger_function` Postgres trigger. Admins view it at the Audit Log
  tab.

## Project layout

```
src/
├── App.tsx                      # Router + auth + query client
├── main.tsx
├── index.css
├── vite-env.d.ts
├── lib/
│   ├── supabase.ts              # Supabase client singleton
│   ├── format.ts                # currency/date helpers
│   ├── constants.ts             # CHART_COLORS, APP_SHORT_NAMES
│   └── utils.ts
├── types/
│   ├── database.ts              # Hand-written Supabase types
│   └── domain.ts                # UI-facing shapes
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useApps.ts
│   ├── useTransactions.ts
│   ├── useDownloaders.ts
│   ├── useTargetConfig.ts
│   ├── useDailyData.ts
│   ├── useSocialMedia.ts
│   ├── useAuditLog.ts
│   └── useAppsSync.ts           # Hydrate + debounced auto-save
├── services/
│   └── excelImport.ts
├── components/
│   ├── auth/                    # LoginPage, SignupPage, ProtectedRoute
│   └── tabs/
│       └── AuditLogTab.tsx
└── pages/
    └── Dashboard.tsx            # Main application (legacy monolith)
```

Dashboard.tsx still holds most tabs (Overview, Optimasi, Target, Packages,
Calendar, Social). Splitting those into `components/tabs/*` is a future
iteration; the data layer is already isolated in `hooks/` and `services/`.

## Regenerate database types

If you change SQL migrations, regenerate TypeScript types against your
linked project:

```bash
npx supabase login
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
```

## Deploy

Any static host (Vercel / Netlify / Cloudflare Pages). Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting dashboard.

```bash
npm run build     # produces dist/
npm run preview   # test the production build locally
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Vite production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | `tsc --noEmit` typecheck |
| `npm run clean` | Remove `dist/` |
