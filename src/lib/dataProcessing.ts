import { format, getMonth, getQuarter, getYear } from 'date-fns';
import type { Downloader, Transaction } from '../types';
import { excelDateToJSDate } from './excelDate';

const coerceToDate = (raw: unknown): Date => {
  if (raw == null || raw === '') return new Date(NaN);
  if (typeof raw === 'number') return excelDateToJSDate(raw);
  if (raw instanceof Date) return raw;
  return new Date(String(raw));
};

export const processTransactions = (rawData: unknown[]): Transaction[] =>
  rawData
    .map((raw) => {
      const item = raw as Record<string, unknown>;
      const rawDate =
        item.payment_date ??
        item.transaction_date ??
        item.Tanggal ??
        item.tanggal ??
        item.Date ??
        item.date;

      let paymentDate = coerceToDate(rawDate);
      if (isNaN(paymentDate.getTime())) paymentDate = new Date();

      return {
        ...(item as object),
        source_app: String(item.source_app ?? '').toUpperCase(),
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
        source_app: String(key || '').toUpperCase(),
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
