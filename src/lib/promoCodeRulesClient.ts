// ==============================================================
// Client untuk tabel promo_code_rules — CRUD + bulk Excel upload
// + download template Excel.
// Kode auto-normalize (uppercase, strip non-alphanumeric) sebelum
// di-insert biar konsisten dengan classifyPromo().
// ==============================================================

import * as XLSX from 'xlsx';
import { getSupabase } from './supabase';
import { logger } from './logger';
import { normalizePromoKey, ASSIGNABLE_PROMO_CATEGORIES, type AssignablePromoCategory } from './promoRules';
import type { PromoCodeRule, NewPromoCodeRule } from '../types';

export const fetchPromoCodeRules = async (userId: string): Promise<PromoCodeRule[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('promo_code_rules')
    .select('*')
    .eq('user_id', userId)
    .order('platform', { ascending: true })
    .order('category', { ascending: true })
    .order('code', { ascending: true });
  if (error) {
    logger.warn('Failed to fetch promo_code_rules:', error.message);
    return [];
  }
  return (data ?? []) as PromoCodeRule[];
};

export const insertPromoCodeRule = async (
  userId: string,
  rule: NewPromoCodeRule,
): Promise<PromoCodeRule | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const payload = {
    user_id: userId,
    platform: rule.platform.trim().toLowerCase(),
    category: rule.category,
    code: normalizePromoKey(rule.code),
  };
  const { data, error } = await supabase
    .from('promo_code_rules')
    .insert(payload)
    .select('*')
    .single();
  if (error) {
    logger.warn('Failed to insert promo_code_rule:', error.message);
    return null;
  }
  return data as PromoCodeRule;
};

export const deletePromoCodeRule = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('promo_code_rules').delete().eq('id', id);
  if (error) {
    logger.warn('Failed to delete promo_code_rule:', error.message);
    return false;
  }
  return true;
};

// ==============================================================
// Bulk upload via Excel. Format kolom: platform, category, code.
// Return summary { inserted, skipped, errors }.
// ==============================================================

export interface BulkUploadResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export const bulkUploadPromoCodeRules = async (
  userId: string,
  file: File,
): Promise<BulkUploadResult> => {
  const result: BulkUploadResult = { inserted: 0, skipped: 0, errors: [] };
  const supabase = getSupabase();
  if (!supabase) {
    result.errors.push('Supabase tidak terkonfigurasi');
    return result;
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    result.errors.push('Sheet pertama kosong');
    return result;
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const allowed = new Set<AssignablePromoCategory>(ASSIGNABLE_PROMO_CATEGORIES);
  const payloads: Array<{ user_id: string; platform: string; category: string; code: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const platformRaw = String(row.platform ?? row.Platform ?? '').trim().toLowerCase();
    const categoryRaw = String(row.category ?? row.Category ?? '').trim();
    const codeRaw = String(row.code ?? row.Code ?? '').trim();

    if (!platformRaw || !categoryRaw || !codeRaw) {
      result.skipped += 1;
      continue;
    }
    if (!allowed.has(categoryRaw as AssignablePromoCategory)) {
      result.errors.push(`Baris ${i + 2}: kategori "${categoryRaw}" tidak valid`);
      result.skipped += 1;
      continue;
    }
    const normCode = normalizePromoKey(codeRaw);
    if (!normCode) {
      result.skipped += 1;
      continue;
    }
    payloads.push({
      user_id: userId,
      platform: platformRaw,
      category: categoryRaw,
      code: normCode,
    });
  }

  if (payloads.length === 0) return result;

  // Upsert biar idempotent — kalau (user_id, platform, code) udah ada, update kategorinya.
  const { error } = await supabase
    .from('promo_code_rules')
    .upsert(payloads, { onConflict: 'user_id,platform,code' });
  if (error) {
    result.errors.push(`Gagal upsert: ${error.message}`);
    return result;
  }
  result.inserted = payloads.length;
  return result;
};

// ==============================================================
// Generate + download template Excel kosong.
// Header: platform, category, code (+ contoh 1 baris)
// ==============================================================

export const downloadPromoCodeRulesTemplate = (): void => {
  const sampleRows = [
    { platform: 'cerebrum', category: 'Sales', code: 'ADMINCEREBRUM' },
    { platform: 'cerebrum', category: 'Marketing', code: 'TIKTOKCEREBRUM' },
    { platform: 'jadiasn', category: 'Aplikasi', code: 'DISKONAPK' },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows, {
    header: ['platform', 'category', 'code'],
  });

  ws['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PromoCodeRules');

  const helpRows = [
    ['Petunjuk Pengisian'],
    [''],
    ['platform', 'lowercase, mis. cerebrum, jadiasn, jadibumn, jadipolisi, jadiprajurit, jadisekdin'],
    ['category', `salah satu: ${ASSIGNABLE_PROMO_CATEGORIES.join(', ')}`],
    ['code', 'kode promo, akan dinormalisasi (uppercase + strip karakter non-alfanumerik)'],
    [''],
    ['Catatan: kalau (platform, code) sudah ada di database, kategori akan di-update.'],
  ];
  const wsHelp = XLSX.utils.aoa_to_sheet(helpRows);
  wsHelp['!cols'] = [{ wch: 14 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Petunjuk');

  XLSX.writeFile(wb, 'template_kode_promo.xlsx');
};
