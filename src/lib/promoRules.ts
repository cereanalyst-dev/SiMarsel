// ==============================================================
// Klasifikasi promo_code → kategori (Sales / Marketing / Aplikasi /
// Live / Artikel / Lainnya / Tanpa Kode).
// Dipakai oleh: TargetSection (Sebaran Kode Promo per tanggal),
//              PromoSection (Performa Kode Promo per kategori).
// ==============================================================

export type PromoCategory =
  | 'Sales'
  | 'Marketing'
  | 'Artikel'
  | 'Aplikasi'
  | 'Live'
  | 'Lainnya'
  | 'Tanpa Kode';

export const PROMO_CATEGORIES: PromoCategory[] = [
  'Sales', 'Marketing', 'Aplikasi', 'Live', 'Lainnya', 'Artikel', 'Tanpa Kode',
];

const PROMO_RULES: Record<string, Array<{ category: PromoCategory; pattern: RegExp }>> = {
  cerebrum: [
    { category: 'Sales',     pattern: /(ADMINCEREBRUM|LOLOSUTBK|MEMBERCEREBRUM|TELEGRAMCEREBRUM|PROMOCEREBRUM|DISKONCEREBRUM)/ },
    { category: 'Marketing', pattern: /(CEREBRUM|TIKTOKCEREBRUM)/ },
    { category: 'Artikel',   pattern: /(SIAPSNBT)/ },
    { category: 'Aplikasi',  pattern: /(DISKONAPK|TOCEREBRUM|POTONGAN 5\.000|POTONGAN 2\.000)/ },
    { category: 'Live',      pattern: /(KEBUTSNBT|GASSNBT|GOSNBT|TEMBUSSNBT|HEBATSNBT|PASTISNBT|TARGETSNBT|MANTAPSNBT)/ },
  ],
  jadiasn: [
    { category: 'Sales',     pattern: /(ADMINJADIASN|LOLOSASN|MEMBERASN|TELEGRAMASN|PROMOASN|DISKONASN|PROMOTELEGRAM|SIAPCPNS)/ },
    { category: 'Marketing', pattern: /(JADIASN|TIKTOKJADIASN)/ },
    { category: 'Artikel',   pattern: /(BIMBELCPNS)/ },
    { category: 'Aplikasi',  pattern: /(DISKONAPK|TOASN|POTONGAN 5\.000|POTONGAN 2\.000)/ },
    { category: 'Live',      pattern: /(KEBUTCPNS|GASCPNS|GOCPNS|TEMBUSCPNS|PASTICPNS)/ },
  ],
  jadibumn: [
    { category: 'Sales',     pattern: /(ADMINDINA|LOLOSBUMN|MEMBERBUMN|TELEGRAMBUMN|PROMOBUMN|DISKONBUMN|ADMINSOFI)/ },
    { category: 'Marketing', pattern: /(JADIBUMN|TIKTOKJADIBUMN)/ },
    { category: 'Artikel',   pattern: /(BIMBELBUMN)/ },
    { category: 'Aplikasi',  pattern: /(DISKONAPK|TOASN|POTONGAN 5\.000|POTONGAN 2\.000)/ },
    { category: 'Live',      pattern: /(PASTIBUMN|MANTAPBUMN)/ },
  ],
  jadipolisi: [
    { category: 'Sales',     pattern: /(ADMINJADIPOLISI|LOLOSPOLISI|MEMBERPOLISI|TELEGRAMPOLISI|PROMOPOLISI|DISKONPOLISI)/ },
    { category: 'Marketing', pattern: /(JADIPOLISI|TIKTOKJADIPOLISI)/ },
    { category: 'Artikel',   pattern: /(BIMBELPOLRI)/ },
    { category: 'Aplikasi',  pattern: /(DISKONAPK|TOPOLISI|POTONGAN 5\.000|POTONGAN 2\.000)/ },
    { category: 'Live',      pattern: /(PASTIPOLISI|MANTAPPOLISI)/ },
  ],
  jadiprajurit: [
    { category: 'Sales',     pattern: /(ADMINJADIPRAJURIT|LOLOSPRAJURIT|MEMBERPRAJURIT|TELEGRAMPRAJURIT|PROMOPRAJURIT|DISKONPRAJURIT)/ },
    { category: 'Marketing', pattern: /(JADIPRAJURIT|TIKTOKJADIPRAJURIT)/ },
    { category: 'Artikel',   pattern: /(BIMBELTNI)/ },
    { category: 'Aplikasi',  pattern: /(DISKONAPK|TOPRAJURIT|POTONGAN 5\.000|POTONGAN 2\.000)/ },
  ],
  jadisekdin: [
    { category: 'Sales',     pattern: /(ADMINJADISEKDIN|LOLOSSEKDIN|MEMBERSEKDIN|TELEGRAMSEKDIN|PROMOSEKDIN|DISKONSEKDIN)/ },
    { category: 'Marketing', pattern: /(JADISEKDIN|TIKTOKJADISEKDIN)/ },
    { category: 'Artikel',   pattern: /(BIMBELSEKDIN)/ },
    { category: 'Aplikasi',  pattern: /(DISKONAPK|TOSEKDIN|POTONGAN 5\.000|POTONGAN 2\.000)/ },
  ],
};

// ==============================================================
// Parse promo_code dari DB (yang mungkin berformat:
//   - "ADMINJADIASN"             single code
//   - "[ADMINJADIASN, RES12345]" array dengan 2 code (main + reseller)
//   - "[ADMINJADIASN]"           array 1 code
//   - "[]" / "" / null           tanpa kode
// ) menjadi objek terstruktur.
// ==============================================================

export interface ParsedPromo {
  raw: string | null;       // value asli (untuk display bila perlu)
  mainCode: string | null;  // kode utama (ke-1)
  resellerCode: string | null; // kode reseller (ke-2), kalau ada
  isEmpty: boolean;         // true kalau gak ada kode (null / [] / "")
}

export function parsePromoCode(rawCode: string | null | undefined): ParsedPromo {
  if (rawCode == null) return { raw: null, mainCode: null, resellerCode: null, isEmpty: true };
  const trimmed = String(rawCode).trim();
  if (!trimmed || trimmed === '[]' || /^null$/i.test(trimmed)) {
    return { raw: trimmed || null, mainCode: null, resellerCode: null, isEmpty: true };
  }

  // Strip brackets [ ] kalau format array
  const stripped = trimmed.replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!stripped) {
    return { raw: trimmed, mainCode: null, resellerCode: null, isEmpty: true };
  }

  // Split by comma
  const parts = stripped.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { raw: trimmed, mainCode: null, resellerCode: null, isEmpty: true };
  }

  return {
    raw: trimmed,
    mainCode: parts[0],
    resellerCode: parts.length > 1 ? parts[1] : null,
    isEmpty: false,
  };
}

// ==============================================================
// Klasifikasi 1 kode (string) → kategori, berdasar regex per platform.
// Order penting: Sales > Marketing > Artikel > Aplikasi > Live > Lainnya.
// First match wins (sesuai logic IFS di Sheets).
// ==============================================================

export function classifyPromo(
  rawCode: string | null | undefined,
  platformKey: string,
): PromoCategory {
  const parsed = parsePromoCode(rawCode);
  if (parsed.isEmpty) return 'Tanpa Kode';

  const platform = platformKey.toLowerCase();
  const rules = PROMO_RULES[platform];
  if (!rules) return 'Lainnya';

  // Klasifikasi berdasarkan kode utama (parts[0]).
  // Boleh juga match seluruh raw string — saat ini pakai raw biar mudah
  // ke-classify walau code berformat "[ADMIN..., RES...]".
  const upper = (parsed.raw ?? '').toUpperCase();
  for (const rule of rules) {
    if (rule.pattern.test(upper)) return rule.category;
  }
  return 'Lainnya';
}

// ==============================================================
// Build display label untuk breakdown per-kode unik.
// Kalau ada reseller, append "+RES" supaya jadi "ADMINJADIASN+RES".
// ==============================================================

export function buildPromoDisplayKey(
  parsed: ParsedPromo,
): string {
  if (parsed.isEmpty) return 'Tanpa Kode';
  if (!parsed.mainCode) return 'Lainnya';
  return parsed.resellerCode ? `${parsed.mainCode.toUpperCase()}+RES` : parsed.mainCode.toUpperCase();
}

// Tone color untuk badge per kategori
export const PROMO_CATEGORY_TONE: Record<PromoCategory, { bg: string; text: string }> = {
  'Sales':      { bg: 'bg-rose-50',     text: 'text-rose-700' },
  'Marketing':  { bg: 'bg-indigo-50',   text: 'text-indigo-700' },
  'Aplikasi':   { bg: 'bg-cyan-50',     text: 'text-cyan-700' },
  'Live':       { bg: 'bg-amber-50',    text: 'text-amber-700' },
  'Artikel':    { bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  'Lainnya':    { bg: 'bg-slate-100',   text: 'text-slate-600' },
  'Tanpa Kode': { bg: 'bg-slate-50',    text: 'text-slate-400' },
};
