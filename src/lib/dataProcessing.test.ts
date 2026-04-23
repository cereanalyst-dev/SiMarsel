import { describe, expect, it } from 'vitest';
import { processTransactions, processDownloaders } from './dataProcessing';

describe('processTransactions', () => {
  it('returns empty array for empty input', () => {
    expect(processTransactions([])).toEqual([]);
  });

  it('parses payment_date from ISO string and derives year/month/quarter', () => {
    const rows = [{ trx_id: 'X1', payment_date: '2024-03-15 10:00:00', revenue: 100000 }];
    const result = processTransactions(rows);
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r.year).toBe(2024);
    expect(r.month).toBe(3);
    expect(r.quarter).toBe(1);
    expect(r.year_month).toBe('2024-03');
    expect(r.revenue).toBe(100000);
  });

  it('preserves original source_app casing (does not uppercase)', () => {
    const rows = [{ source_app: 'jadibumn', payment_date: '2024-01-01', revenue: 0 }];
    const result = processTransactions(rows);
    expect(result[0].source_app).toBe('jadibumn');
  });

  it('guards NaN revenue → 0', () => {
    const rows = [{ payment_date: '2024-01-01', revenue: 'invalid' }];
    const result = processTransactions(rows);
    expect(result[0].revenue).toBe(0);
  });

  it('handles revenue as number 0 gracefully', () => {
    const rows = [{ payment_date: '2024-01-01', revenue: 0 }];
    const result = processTransactions(rows);
    expect(result[0].revenue).toBe(0);
  });

  it('fallbacks payment_date to transaction_date if missing', () => {
    const rows = [{ transaction_date: '2024-06-15', revenue: 500 }];
    const result = processTransactions(rows);
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(6);
  });

  it('formats transaction_date & payment_date as local timestamp string', () => {
    const rows = [{ transaction_date: '2024-03-15', payment_date: '2024-03-15 14:30:00', revenue: 0 }];
    const result = processTransactions(rows);
    expect(result[0].transaction_date).toMatch(/^2024-03-15 \d{2}:\d{2}:\d{2}$/);
    expect(result[0].payment_date).toBe('2024-03-15 14:30:00');
  });
});

describe('processDownloaders', () => {
  it('converts wide Excel format → long DB rows', () => {
    const rows = [
      { Tanggal: '2024-01-01', CEREBRUM: 500, JADIASN: 100 },
      { Tanggal: '2024-01-02', CEREBRUM: 700, JADIASN: 150 },
    ];
    const result = processDownloaders(rows);

    // 2 dates × 2 apps = 4 long rows
    expect(result).toHaveLength(4);

    const cerebrumJan1 = result.find((r) => r.source_app === 'CEREBRUM' && r.year_month === '2024-01');
    expect(cerebrumJan1?.count).toBe(500);
  });

  it('skips rows without date', () => {
    const rows = [{ CEREBRUM: 100 }, { Tanggal: '2024-01-01', CEREBRUM: 200 }];
    const result = processDownloaders(rows);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(200);
  });

  it('handles empty cells as 0', () => {
    const rows = [{ Tanggal: '2024-01-01', CEREBRUM: '', JADIASN: 50 }];
    const result = processDownloaders(rows);
    const cerebrum = result.find((r) => r.source_app === 'CEREBRUM');
    expect(cerebrum?.count).toBe(0);
  });

  it('ignores XLSX internal keys like __rowNum__', () => {
    const rows = [{ Tanggal: '2024-01-01', __rowNum__: 5, CEREBRUM: 100 }];
    const result = processDownloaders(rows);
    expect(result).toHaveLength(1);
    expect(result[0].source_app).toBe('CEREBRUM');
  });

  it('derives year_month correctly', () => {
    const rows = [{ Tanggal: '2024-11-30', A: 10 }];
    const result = processDownloaders(rows);
    expect(result[0].year_month).toBe('2024-11');
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(11);
  });
});
