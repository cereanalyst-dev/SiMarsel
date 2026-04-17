import * as XLSX from 'xlsx';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { coerceToISODate } from '@/lib/format';
import type { Database } from '@/types/database';

type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type DownloaderInsert = Database['public']['Tables']['downloaders']['Insert'];

const CHUNK_SIZE = 500;
const DATE_KEYS = new Set(['Tanggal', 'tanggal', 'date', 'Date', '__rowNum__']);

export interface ImportSummary {
  batchId: string;
  transactionCount: number;
  downloaderCount: number;
  validationErrors: string[];
}

// Excel cells may arrive as number | string | Date; treat anything non-empty
// as a string for text fields so phone numbers / emails that Excel stored as
// numbers don't fail validation.
const looseString = z
  .union([z.string(), z.number(), z.boolean()])
  .nullable()
  .optional()
  .transform((v) => (v == null || v === '' ? null : String(v)));

const TransactionRow = z.object({
  trx_id: z.union([z.string(), z.number()]).transform(String),
  payment_date: z.string().min(1),
  transaction_date: z.string().nullable().optional(),
  source_app: z.string().min(1),
  methode_name: looseString,
  revenue: z.coerce.number().default(0),
  promo_code: looseString,
  content_name: looseString,
  full_name: looseString,
  email: looseString,
  phone: looseString,
  payment_status: looseString,
});

function findSheetName(sheetNames: string[], keywords: string[]): string | undefined {
  return sheetNames.find((s) =>
    keywords.some((k) => s.toLowerCase().includes(k.toLowerCase()))
  );
}

function pickField<T = unknown>(row: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return undefined;
}

function normalizeTransactionRow(raw: Record<string, unknown>): unknown {
  const paymentRaw = pickField(raw, [
    'payment_date',
    'Payment Date',
    'tgl_bayar',
    'tanggal_bayar',
    'Tanggal Bayar',
  ]);
  const trxRaw = pickField(raw, [
    'transaction_date',
    'Transaction Date',
    'tgl_transaksi',
    'tanggal_transaksi',
  ]);

  const sourceApp = String(
    pickField(raw, ['source_app', 'Source App', 'app', 'aplikasi']) ?? ''
  ).toUpperCase();

  return {
    trx_id: pickField(raw, ['trx_id', 'TRX ID', 'id', 'transaction_id']),
    payment_date: coerceToISODate(paymentRaw),
    transaction_date: coerceToISODate(trxRaw),
    source_app: sourceApp,
    methode_name: pickField(raw, ['methode_name', 'method', 'metode']) ?? null,
    revenue: pickField(raw, ['revenue', 'Revenue', 'total_price', 'amount']) ?? 0,
    promo_code: pickField(raw, ['promo_code', 'promo', 'Promo']) ?? null,
    content_name: pickField(raw, ['content_name', 'content', 'Content']) ?? null,
    full_name: pickField(raw, ['full_name', 'name', 'Name']) ?? null,
    email: pickField(raw, ['email', 'Email']) ?? null,
    phone: pickField(raw, ['phone', 'Phone', 'hp']) ?? null,
    payment_status: pickField(raw, ['payment_status', 'status']) ?? null,
  };
}

// Downloader sheet is pivoted: one date column + one column per app.
// Unpivot to flat { date, source_app, count } rows.
function unpivotDownloaderRows(rows: Record<string, unknown>[]): DownloaderInsert[] {
  const out: DownloaderInsert[] = [];
  for (const row of rows) {
    const rawDate = pickField(row, ['Tanggal', 'tanggal', 'date', 'Date']);
    const isoDate = coerceToISODate(rawDate);
    if (!isoDate) continue;

    for (const key of Object.keys(row)) {
      if (DATE_KEYS.has(key)) continue;
      const count = Number(row[key]);
      if (!Number.isFinite(count)) continue;
      out.push({
        date: isoDate,
        source_app: key.toUpperCase(),
        count,
      });
    }
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function importExcelFile(file: File, userId: string | null): Promise<ImportSummary> {
  const batchId = crypto.randomUUID();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const errors: string[] = [];

  // ---- Transactions ----
  const trxSheetName =
    findSheetName(sheetNames, ['transaksi', 'trx', 'paid']) ?? sheetNames[0];
  const trxSheet = trxSheetName ? workbook.Sheets[trxSheetName] : null;
  const rawTrx = trxSheet
    ? (XLSX.utils.sheet_to_json(trxSheet) as Record<string, unknown>[])
    : [];

  const validTrx: TransactionInsert[] = [];
  rawTrx.forEach((row, i) => {
    const normalized = normalizeTransactionRow(row);
    const parsed = TransactionRow.safeParse(normalized);
    if (!parsed.success) {
      errors.push(`Row ${i + 2} (transactions): ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      return;
    }
    validTrx.push({
      ...parsed.data,
      transaction_date: parsed.data.transaction_date ?? null,
      imported_by: userId,
      import_batch_id: batchId,
    } as TransactionInsert);
  });

  for (const part of chunk(validTrx, CHUNK_SIZE)) {
    const { error } = await supabase
      .from('transactions')
      .upsert(part, { onConflict: 'trx_id,source_app', ignoreDuplicates: false });
    if (error) throw new Error(`Transactions upsert failed: ${error.message}`);
  }

  // ---- Downloaders ----
  const dlSheetName = findSheetName(sheetNames, ['downloader', 'download']);
  let downloaderCount = 0;
  if (dlSheetName) {
    const rawDl = XLSX.utils.sheet_to_json(workbook.Sheets[dlSheetName]) as Record<
      string,
      unknown
    >[];
    const flat = unpivotDownloaderRows(rawDl).map((r) => ({
      ...r,
      imported_by: userId,
      import_batch_id: batchId,
    }));
    for (const part of chunk(flat, CHUNK_SIZE)) {
      const { error } = await supabase
        .from('downloaders')
        .upsert(part, { onConflict: 'date,source_app' });
      if (error) throw new Error(`Downloaders upsert failed: ${error.message}`);
    }
    downloaderCount = flat.length;
  }

  return {
    batchId,
    transactionCount: validTrx.length,
    downloaderCount,
    validationErrors: errors,
  };
}
