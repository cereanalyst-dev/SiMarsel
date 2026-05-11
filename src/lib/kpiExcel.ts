// ==============================================================
// Excel template & bulk upload untuk KPI.
// Struktur: 1 row = 1 metric. Kolom group: Divisi, Card (orang),
// Periode (Tahun, Bulan, Is Leader), Perspektif, Indikator,
// Bobot, Target, Achievement.
// Importer: group rows → upsert divisi (by name) → upsert card
// (by division+name+period) → insert metrics.
// ==============================================================

import * as XLSX from 'xlsx';
import { getSupabase } from './supabase';
import { logger } from './logger';
import type { KpiCard, KpiDivision, NewKpiMetric } from '../types';

export interface KpiBulkUploadResult {
  divisionsCreated: number;
  cardsCreated: number;
  metricsInserted: number;
  skipped: number;
  errors: string[];
}

interface RowParsed {
  rowIndex: number;
  divisionName: string;
  cardName: string;
  description: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  isLeader: boolean;
  perspektif: string;
  metricIndicator: string;
  bobot: number;
  target: number | null;
  achievement: number | null;
}

const MONTH_LOOKUP: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8,
  september: 9, sep: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  desember: 12, des: 12,
};

const parseMonth = (raw: unknown): number | null => {
  if (raw == null || raw === '') return null;
  const num = Number(raw);
  if (!isNaN(num) && num >= 1 && num <= 12) return Math.floor(num);
  const key = String(raw).trim().toLowerCase();
  return MONTH_LOOKUP[key] ?? null;
};

const parseBool = (raw: unknown): boolean => {
  if (raw == null || raw === '') return false;
  const s = String(raw).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'ya' || s === 'yes' || s === 'leader';
};

const numOrNull = (raw: unknown): number | null => {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

const numOrZero = (raw: unknown): number => numOrNull(raw) ?? 0;

// ==============================================================
// Bulk upload
// ==============================================================
export const bulkUploadKpi = async (
  userId: string,
  file: File,
  existingDivisions: KpiDivision[],
  existingCards: KpiCard[],
): Promise<KpiBulkUploadResult> => {
  const result: KpiBulkUploadResult = {
    divisionsCreated: 0, cardsCreated: 0, metricsInserted: 0, skipped: 0, errors: [],
  };
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

  // ----------------------------------------------------------------
  // Parse & validate rows
  // ----------------------------------------------------------------
  const parsed: RowParsed[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const divisionName = String(row['Divisi'] ?? row['Division'] ?? '').trim();
    const cardName = String(row['Nama Card'] ?? row['Nama'] ?? row['Name'] ?? '').trim();
    const perspektif = String(row['Perspektif'] ?? row['Perspective'] ?? '').trim();
    const metricIndicator = String(
      row['Indikator'] ?? row['Metric'] ?? row['Indicator'] ?? '',
    ).trim();
    const bobot = numOrZero(row['Bobot'] ?? row['Weight']);

    if (!divisionName || !cardName || !perspektif || !metricIndicator) {
      result.skipped += 1;
      result.errors.push(`Baris ${i + 2}: kolom wajib (Divisi/Nama Card/Perspektif/Indikator) tidak lengkap`);
      continue;
    }

    parsed.push({
      rowIndex: i + 2,
      divisionName,
      cardName,
      description: String(row['Deskripsi'] ?? row['Description'] ?? '').trim() || null,
      periodYear: numOrNull(row['Tahun'] ?? row['Year']),
      periodMonth: parseMonth(row['Bulan'] ?? row['Month']),
      isLeader: parseBool(row['Leader'] ?? row['Is Leader'] ?? row['IsLeader']),
      perspektif,
      metricIndicator,
      bobot,
      target: numOrNull(row['Target']),
      achievement: numOrNull(row['Achievement'] ?? row['Pencapaian']),
    });
  }

  if (parsed.length === 0) return result;

  // ----------------------------------------------------------------
  // Pastikan division & card ada (create kalau belum), index by name
  // ----------------------------------------------------------------
  const divByName = new Map<string, KpiDivision>();
  existingDivisions.forEach((d) => divByName.set(d.name.toLowerCase().trim(), d));

  const cardKey = (divId: string, name: string, year: number | null, month: number | null, isLeader: boolean): string =>
    `${divId}::${name.toLowerCase().trim()}::${year ?? 'NA'}::${month ?? 'NA'}::${isLeader ? 'L' : 'M'}`;

  const cardByKey = new Map<string, KpiCard>();
  existingCards.forEach((c) => {
    if (c.division_id) {
      cardByKey.set(cardKey(c.division_id, c.name, c.period_year, c.period_month, c.is_leader), c);
    }
  });

  // Create division kalau belum ada
  const uniqueDivNames = Array.from(new Set(parsed.map((p) => p.divisionName)));
  for (const name of uniqueDivNames) {
    const lower = name.toLowerCase().trim();
    if (divByName.has(lower)) continue;
    const { data, error } = await supabase
      .from('kpi_divisions')
      .insert({ user_id: userId, name, description: null, position: divByName.size })
      .select('*')
      .single();
    if (error || !data) {
      result.errors.push(`Gagal create divisi "${name}": ${error?.message ?? 'unknown'}`);
      continue;
    }
    divByName.set(lower, data as KpiDivision);
    result.divisionsCreated += 1;
  }

  // Create card kalau belum ada (per division + name + period)
  const uniqueCards = new Map<string, RowParsed>();
  parsed.forEach((p) => {
    const div = divByName.get(p.divisionName.toLowerCase().trim());
    if (!div) return;
    const key = cardKey(div.id, p.cardName, p.periodYear, p.periodMonth, p.isLeader);
    if (!uniqueCards.has(key)) uniqueCards.set(key, p);
  });

  for (const [key, p] of uniqueCards) {
    if (cardByKey.has(key)) continue;
    const div = divByName.get(p.divisionName.toLowerCase().trim());
    if (!div) continue;
    const { data, error } = await supabase
      .from('kpi_cards')
      .insert({
        user_id: userId,
        division_id: div.id,
        name: p.cardName,
        description: p.description,
        period_year: p.periodYear,
        period_month: p.periodMonth,
        is_leader: p.isLeader,
        position: cardByKey.size,
      })
      .select('*')
      .single();
    if (error || !data) {
      result.errors.push(`Gagal create card "${p.cardName}" (baris ${p.rowIndex}): ${error?.message ?? 'unknown'}`);
      continue;
    }
    cardByKey.set(key, data as KpiCard);
    result.cardsCreated += 1;
  }

  // ----------------------------------------------------------------
  // Insert metrics (1 row Excel = 1 row metric, no dedup)
  // ----------------------------------------------------------------
  const metricPayloads: Array<NewKpiMetric & { card_id: string }> = [];
  for (const p of parsed) {
    const div = divByName.get(p.divisionName.toLowerCase().trim());
    if (!div) {
      result.skipped += 1;
      continue;
    }
    const card = cardByKey.get(cardKey(div.id, p.cardName, p.periodYear, p.periodMonth, p.isLeader));
    if (!card) {
      result.skipped += 1;
      continue;
    }
    metricPayloads.push({
      card_id: card.id,
      perspektif: p.perspektif,
      metric_indicator: p.metricIndicator,
      bobot: p.bobot,
      target: p.target,
      achievement: p.achievement,
      position: metricPayloads.length,
    });
  }

  if (metricPayloads.length > 0) {
    const { error } = await supabase.from('kpi_metrics').insert(metricPayloads);
    if (error) {
      result.errors.push(`Gagal insert metrics: ${error.message}`);
      logger.warn('KPI bulk upload metric insert error:', error);
      return result;
    }
    result.metricsInserted = metricPayloads.length;
  }

  return result;
};

// ==============================================================
// Download Excel template
// ==============================================================
export const downloadKpiTemplate = (): void => {
  const currentYear = new Date().getFullYear();

  const sample = [
    {
      'Divisi': 'Marketing',
      'Nama Card': 'budi@perusahaan.com',
      'Deskripsi': 'Spesialis konten Instagram',
      'Tahun': currentYear,
      'Bulan': 5,
      'Leader': 'No',
      'Perspektif': 'Brand Awareness',
      'Indikator': 'Total Views Instagram Reels',
      'Bobot': 30,
      'Target': 100000,
      'Achievement': 85000,
    },
    {
      'Divisi': 'Marketing',
      'Nama Card': 'budi@perusahaan.com',
      'Deskripsi': 'Spesialis konten Instagram',
      'Tahun': currentYear,
      'Bulan': 5,
      'Leader': 'No',
      'Perspektif': 'Engagement',
      'Indikator': 'Avg engagement rate (%)',
      'Bobot': 25,
      'Target': 5,
      'Achievement': 4.2,
    },
    {
      'Divisi': 'Marketing',
      'Nama Card': 'ani@perusahaan.com',
      'Deskripsi': 'Leader divisi marketing',
      'Tahun': currentYear,
      'Bulan': 5,
      'Leader': 'Yes',
      'Perspektif': 'Team Performance',
      'Indikator': 'Avg KPI tim',
      'Bobot': 50,
      'Target': 90,
      'Achievement': 87,
    },
    {
      'Divisi': 'Sales',
      'Nama Card': 'citra@perusahaan.com',
      'Deskripsi': '',
      'Tahun': currentYear,
      'Bulan': 5,
      'Leader': 'No',
      'Perspektif': 'Revenue',
      'Indikator': 'Total Sales (IDR)',
      'Bobot': 40,
      'Target': 50000000,
      'Achievement': 47500000,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sample);
  ws['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 30 },
    { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 22 }, { wch: 35 },
    { wch: 8 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'KPI');

  const noteRows = [
    ['Petunjuk Pengisian Template KPI'],
    [''],
    ['STRUKTUR:'],
    ['', '1 row = 1 indikator (metric). Banyak indikator → banyak row.'],
    ['', 'Row dengan (Divisi + Nama Card + Tahun + Bulan + Leader) yang sama akan masuk ke card yang sama.'],
    [''],
    ['KOLOM WAJIB:'],
    ['•', 'Divisi — nama divisi (mis. Marketing, Sales, Operations).'],
    ['•', 'Nama Card — EMAIL user (sama dengan email login). Staf hanya lihat card yang emailnya cocok.'],
    ['•', 'Perspektif — kategori KPI (mis. Revenue, Brand Awareness, Customer Satisfaction).'],
    ['•', 'Indikator — nama metric spesifik.'],
    ['•', 'Bobot — persentase 0–100 (jumlah bobot semua metric per card idealnya 100).'],
    [''],
    ['KOLOM OPSIONAL:'],
    ['•', 'Deskripsi — keterangan card (cukup ditulis 1x per card).'],
    ['•', 'Tahun — angka tahun (mis. 2026). Kosong = card tanpa periode.'],
    ['•', 'Bulan — angka 1-12 atau nama bulan (Januari, Februari, dst). Kosong = KPI tahunan.'],
    ['•', 'Leader — Yes/No. Yes = card untuk leader divisi (max 1 per divisi+periode).'],
    ['•', 'Target — angka target.'],
    ['•', 'Achievement — angka pencapaian aktual.'],
    [''],
    ['CATATAN:'],
    ['', 'Pencapaian (%) = Achievement / Target × 100 (dihitung otomatis).'],
    ['', 'Score = Pencapaian (%) × Bobot / 100 (dihitung otomatis).'],
    ['', 'Divisi & Card baru otomatis dibuat. Kalau sudah ada, metric akan di-append.'],
    ['', 'Angka tanpa pemisah ribuan (1500000), atau pakai format Indonesia (1.500.000 atau 1.500,5).'],
  ];
  const notesWs = XLSX.utils.aoa_to_sheet(noteRows);
  notesWs['!cols'] = [{ wch: 4 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, notesWs, 'Petunjuk');

  XLSX.writeFile(wb, 'template-kpi.xlsx');
};
