import { format, getMonth, getQuarter, getYear } from 'date-fns';
import type { Downloader, Transaction } from '../types';
import { excelDateToJSDate } from './excelDate';

const coerceToDate = (raw: unknown): Date => {
  if (raw == null || raw === '') return new Date(NaN);
  if (typeof raw === 'number') return excelDateToJSDate(raw);
  if (raw instanceof Date) return raw;
  return new Date(String(raw));
};

// Format Date → "YYYY-MM-DD HH:mm:ss" pakai komponen WAKTU LOKAL.
// Ini cocok dengan kolom `timestamp` (tanpa time zone) di Postgres, jadi yang
// ditampilkan di Supabase persis seperti yang ada di Excel — tanpa konversi UTC.
const pad2 = (n: number) => String(n).padStart(2, '0');
const toLocalTimestampOrNull = (raw: unknown): string | null => {
  const d = coerceToDate(raw);
  if (isNaN(d.getTime())) return null;
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
};

export const processTransactions = (rawData: unknown[]): Transaction[] =>
  rawData
    .map((raw) => {
      const item = raw as Record<string, unknown>;

      // Parse payment_date (canonical — untuk semua chart & filter)
      const rawPaymentDate =
        item.payment_date ??
        item.transaction_date ??
        item.Tanggal ??
        item.tanggal ??
        item.Date ??
        item.date;

      let paymentDate = coerceToDate(rawPaymentDate);
      if (isNaN(paymentDate.getTime())) paymentDate = new Date();

      // Format kedua kolom date sebagai local timestamp string, supaya di
      // Supabase terlihat sama persis dengan Excel (tidak ter-convert ke UTC).
      const transactionDateStr = toLocalTimestampOrNull(item.transaction_date);
      const paymentDateStr = toLocalTimestampOrNull(rawPaymentDate);

      return {
        ...(item as object),
        transaction_date: transactionDateStr,
        payment_date: paymentDateStr,
        // source_app disimpan persis seperti di Excel — tanpa uppercase.
        source_app: String(item.source_app ?? ''),
        parsed_payment_date: paymentDate,
        year: getYear(paymentDate),
        month: getMonth(paymentDate) + 1,
        quarter: getQuarter(paymentDate),
        year_month: format(paymentDate, 'yyyy-MM'),
        hour: paymentDate.getHours(),
        revenue: Number(item.revenue ?? item.Revenue ?? item.total_price ?? 0),
      } as unknown as Transaction;
    });

export const processDownloaders = (rawData: unknown[]): Downloader[] => {
  const processed: Downloader[] = [];

  rawData.forEach((raw) => {
    const row = raw as Record<string, unknown>;
    const rawDate = row.Tanggal ?? row.tanggal ?? row.date ?? row.Date;
    if (!rawDate) return;

    const date = coerceToDate(rawDate);
    if (isNaN(date.getTime())) return;

    const year = getYear(date);
    const month = getMonth(date) + 1;
    const year_month = format(date, 'yyyy-MM');

    Object.keys(row).forEach((key) => {
      if (['Tanggal', 'tanggal', 'date', 'Date', '__rowNum__'].includes(key)) return;
      processed.push({
        date: rawDate,
        // source_app dari nama kolom di Excel — tanpa uppercase.
        source_app: String(key || ''),
        count: Number(row[key]) || 0,
        parsed_date: date,
        year,
        month,
        year_month,
      });
    });
  });

  return processed;
};
