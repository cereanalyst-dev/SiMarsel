// =============================================================
// Helper formatters + Jakarta TZ utilities.
// SEMUA tanggal di app ini di-evaluasi di Asia/Jakarta supaya konsisten
// dengan ops harian (transaksi yang masuk dianggap di TZ lokal).
// =============================================================

const RP = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export const formatIDR = (v: number | null | undefined): string => {
  if (v == null || isNaN(v)) return 'Rp 0';
  return `Rp ${RP.format(Math.round(v))}`;
};

export const formatCompactIDR = (v: number | null | undefined): string => {
  if (v == null || isNaN(v)) return 'Rp 0';
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)} Jt`;
  if (abs >= 1_000)         return `Rp ${Math.round(v / 1_000)} Rb`;
  return `Rp ${Math.round(v)}`;
};

export const formatNumber = (v: number | null | undefined): string => {
  if (v == null || isNaN(v)) return '0';
  return RP.format(Math.round(v));
};

export const formatPercent = (v: number | null | undefined, digits = 1): string => {
  if (v == null || isNaN(v)) return '0%';
  return `${v.toFixed(digits)}%`;
};

export const normalizeApp = (s: string | null | undefined): string =>
  (s ?? '').trim().toUpperCase();

export const titleCase = (s: string): string =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

// =============================================================
// Jakarta timezone helpers
// =============================================================

const TZ = 'Asia/Jakarta';

export interface JakartaParts {
  year: number;
  month: number;   // 1-12
  day: number;     // 1-31
  hour: number;
  minute: number;
  second: number;
}

export const jakartaParts = (date: Date | string | number = new Date()): JakartaParts => {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
};

export const jakartaDateOnly = (date: Date | string | number = new Date()): string => {
  const p = jakartaParts(date);
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
};

export const jakartaDay = (date: Date | string | number = new Date()): number =>
  jakartaParts(date).day;

export const jakartaLastDayOfMonth = (date: Date | string | number = new Date()): number => {
  const p = jakartaParts(date);
  return new Date(p.year, p.month, 0).getDate();
};

export const startOfMonthJakarta = (year: number, month: number): Date => {
  return new Date(Date.UTC(year, month - 1, 1, -7, 0, 0));
};

export const monthRangeJakarta = (year: number, month: number): {
  start: Date;
  end: Date;
  lastDay: number;
} => {
  const start = startOfMonthJakarta(year, month);
  const lastDay = new Date(year, month, 0).getDate();
  const end = startOfMonthJakarta(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  return { start, end, lastDay };
};

export const parsePeriodParam = (raw?: string | null): { year: number; month: number } => {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number);
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
      return { year: y, month: m };
    }
  }
  const now = jakartaParts();
  return { year: now.year, month: now.month };
};

// trx_id format "jadiasn-494485" → "jadiasn"
export const appFromTrxId = (trxId: string | null | undefined): string => {
  if (!trxId) return '';
  return trxId.split('-')[0].toLowerCase();
};

// promo_code raw → array of codes
// Robust parser: handles null / "" / "[]" / "null" / "[\"X\",\"Y\"]" / "X" / array
export const parsePromoCodes = (raw: unknown): string[] => {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === '[]') return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    } catch {
      // fall through
    }
  }
  return [trimmed];
};

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const monthNameID = (month: number): string => MONTH_NAMES_ID[clamp(month, 1, 12) - 1];
