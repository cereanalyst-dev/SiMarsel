// ==============================================================
// CRUD + Excel template/import untuk Insight Hasil.
// 1 row = 1 (user, app, platform_sosmed, tanggal). Upsert idempotent
// agar re-import gak duplikat.
// ==============================================================

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { getSupabase } from './supabase';
import { logger } from './logger';
import { excelDateToJSDate } from './excelDate';
import type { InsightHasil, NewInsightHasil } from '../types';

export const fetchInsightHasil = async (userId: string): Promise<InsightHasil[]> => {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('insight_hasil')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('app_name', { ascending: true })
    .order('platform', { ascending: true });
  if (error) {
    logger.warn('Failed to fetch insight_hasil:', error.message);
    return [];
  }
  return (data ?? []) as InsightHasil[];
};

export const upsertInsightHasil = async (
  userId: string,
  rec: NewInsightHasil,
): Promise<InsightHasil | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const payload = { ...rec, user_id: userId };
  const { data, error } = await supabase
    .from('insight_hasil')
    .upsert(payload, { onConflict: 'user_id,app_name,platform,date' })
    .select('*')
    .single();
  if (error) {
    logger.warn('Failed to upsert insight_hasil:', error.message);
    return null;
  }
  return data as InsightHasil;
};

export const deleteInsightHasil = async (id: string): Promise<boolean> => {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('insight_hasil').delete().eq('id', id);
  if (error) {
    logger.warn('Failed to delete insight_hasil:', error.message);
    return false;
  }
  return true;
};

// ==============================================================
// Bulk Excel upload — kolom: App, Platform, Tanggal, 6 metrik.
// Idempotent (upsert). Return summary.
// ==============================================================

export interface BulkUploadResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export const bulkUploadInsightHasil = async (
  userId: string,
  file: File,
): Promise<BulkUploadResult> => {
  const result: BulkUploadResult = { inserted: 0, skipped: 0, errors: [] };
  const supabase = getSupabase();
  if (!supabase) {
    result.errors.push('Supabase tidak terkonfigurasi');
    return result;
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    result.errors.push('Sheet pertama kosong');
    return result;
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const num = (v: unknown): number => {
    if (v === '' || v == null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  const payloads: Array<NewInsightHasil & { user_id: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const appName = String(row['Nama App'] ?? row['App'] ?? '').trim();
    const platform = String(row['Platform'] ?? '').trim();

    const rawDate = row['Tanggal'] ?? row['Date'];
    const dateObj =
      typeof rawDate === 'number' ? excelDateToJSDate(rawDate) : new Date(String(rawDate));

    if (!appName || !platform || isNaN(dateObj.getTime())) {
      result.skipped += 1;
      result.errors.push(`Baris ${i + 2}: data wajib (App/Platform/Tanggal) tidak lengkap`);
      continue;
    }

    payloads.push({
      user_id: userId,
      app_name: appName,
      platform,
      date: format(dateObj, 'yyyy-MM-dd'),
      tayangan:         num(row['Tayangan']),
      jangkauan:        num(row['Jangkauan']),
      interaksi_konten: num(row['Interaksi Konten']),
      klik_tautan:      num(row['Klik Tautan']),
      kunjungan:        num(row['Kunjungan']),
      pengikut:         num(row['Pengikut']),
    });
  }

  if (payloads.length === 0) return result;

  const { error } = await supabase
    .from('insight_hasil')
    .upsert(payloads, { onConflict: 'user_id,app_name,platform,date' });
  if (error) {
    result.errors.push(`Gagal upsert: ${error.message}`);
    return result;
  }
  result.inserted = payloads.length;
  return result;
};

// ==============================================================
// Download template Excel
// ==============================================================

export const downloadInsightHasilTemplate = (knownAppNames: string[]): void => {
  const exampleApp = knownAppNames[0] ?? 'JADIBUMN';
  const today = format(new Date(), 'yyyy-MM-dd');

  const sample = [
    {
      'Nama App': exampleApp,
      'Platform': 'Instagram',
      'Tanggal': today,
      'Tayangan': 8000,
      'Jangkauan': 5000,
      'Interaksi Konten': 250,
      'Klik Tautan': 12,
      'Kunjungan': 30,
      'Pengikut': 8,
    },
    {
      'Nama App': exampleApp,
      'Platform': 'TikTok',
      'Tanggal': today,
      'Tayangan': 22000,
      'Jangkauan': 15000,
      'Interaksi Konten': 800,
      'Klik Tautan': 35,
      'Kunjungan': 80,
      'Pengikut': 30,
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Insight Hasil');

  const noteRows = [
    ['Petunjuk Pengisian'],
    [''],
    ['1.', `Nama App harus cocok dengan: ${knownAppNames.join(', ') || '(belum ada app)'}`],
    ['2.', 'Tanggal format YYYY-MM-DD (atau format Excel Date).'],
    ['3.', 'Kombinasi (Nama App, Platform, Tanggal) harus unik. Re-upload akan update row yang sama.'],
    ['4.', 'Semua kolom angka isi angka saja, tanpa pemisah ribuan.'],
  ];
  const notesWs = XLSX.utils.aoa_to_sheet(noteRows);
  notesWs['!cols'] = [{ wch: 4 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, notesWs, 'Petunjuk');

  XLSX.writeFile(wb, 'template-insight-hasil.xlsx');
};
