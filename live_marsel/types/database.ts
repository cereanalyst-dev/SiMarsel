// =============================================================
// Database row types — match dengan tabel Supabase di SiMarsel.
// =============================================================

export interface Transaction {
  trx_id: string;
  transaction_date: string | null;   // ISO date
  payment_date: string | null;       // ISO date
  source_app: string;                // lowercase (kadang campur)
  methode_name: string | null;
  revenue: number;
  promo_code: string | null;         // raw — bisa "[]" / null / "[\"X\"]"
  content_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  payment_status: string | null;
  created_at: string;
}

export interface Download {
  id?: number;
  source_app: string;
  date: string;
  count: number;
}

// Targets — di SiMarsel namanya target_config (per app+year_month).
// Untuk live dashboard kita query target_config + filter year_month sesuai
// period URL. Schema di FE digunakan flat 1 row/app.
export interface Target {
  source_app: string;
  sales_target: number;
  downloader_target: number;
  premium_user_target: number;
  conversion_target: number;        // persen 0-100
  avg_price_target: number;
}

// Hasil RPC dashboard_year_totals
export interface YearTotals {
  total_sales: number;
  total_trx: number;
  total_premium: number;
  total_downloader: number;
}

// Computed/aggregate types
export interface AppAggregate {
  app: string;                       // normalized UPPERCASE
  sales: number;
  trxCount: number;
  downloaders: number;
  premium: number;
  conversion: number;
  target: Target | null;
}

export interface DailyPoint {
  day: number;                       // 1..31
  date: string;                      // YYYY-MM-DD
  sales: number;
  trxCount: number;
  downloaders: number;
  premium: number;
  conversion: number;
}

export type MetricKey = 'sales' | 'downloaders' | 'premium' | 'conversion';

export interface MetricBlock {
  key: MetricKey;
  label: string;
  total: number;
  target: number;
  unit: 'rp' | 'num' | 'pct';
  apps: Array<{
    app: string;
    value: number;
    target: number;
    pct: number;
  }>;
}
