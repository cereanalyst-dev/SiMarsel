// Export helpers — CSV (native, no dep) + Excel (via xlsx).
// Usage:
//   exportToCSV(rows, 'transactions.csv');
//   exportToExcel(rows, 'transactions.xlsx', 'Transaksi');

type Row = Record<string, unknown>;

const normalizeValue = (v: unknown): string => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const escapeCsv = (raw: string): string => {
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportToCSV = (
  rows: Row[],
  filename: string,
  opts?: { columns?: string[] },
): void => {
  if (rows.length === 0) {
    const blob = new Blob([''], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, filename);
    return;
  }

  const columns = opts?.columns ?? Object.keys(rows[0]);
  const header = columns.map(escapeCsv).join(',');
  const body = rows
    .map((row) => columns.map((col) => escapeCsv(normalizeValue(row[col]))).join(','))
    .join('\n');

  // BOM supaya Excel Windows kenali UTF-8
  const csv = '﻿' + header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
};

export const exportToExcel = async (
  rows: Row[],
  filename: string,
  sheetName = 'Data',
  opts?: { columns?: string[] },
): Promise<void> => {
  // Dynamic import supaya bundle utama tidak ketarik xlsx
  const XLSX = await import('xlsx');
  const columns = opts?.columns ?? (rows.length > 0 ? Object.keys(rows[0]) : []);

  const filtered = rows.map((r) => {
    const out: Row = {};
    columns.forEach((c) => {
      out[c] = r[c] ?? '';
    });
    return out;
  });

  const ws = XLSX.utils.json_to_sheet(filtered, { header: columns });
  // Auto-width columns based on max content length
  ws['!cols'] = columns.map((col) => {
    const maxLen = Math.max(
      col.length,
      ...filtered.slice(0, 200).map((r) => normalizeValue(r[col]).length),
    );
    return { wch: Math.min(50, Math.max(10, maxLen + 2)) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
};
