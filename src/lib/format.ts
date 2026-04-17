// Formatting / parsing helpers shared across UI + import code.

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function getShortAppName(name: string): string {
  const upper = name.toUpperCase();
  if (upper === 'CEREBRUM') return 'Cerebrum';
  if (upper === 'JADIASN') return 'ASN';
  if (upper === 'JADIBUMN') return 'BUMN';
  if (upper === 'JADIPOLISI') return 'Polisi';
  if (upper === 'JADIPRAJURIT') return 'Prajurit';
  if (upper === 'JADIBEASISWA') return 'Beasiswa';
  if (upper === 'JADISEKDIN') return 'Sekdin';
  return name.replace(/^JADI/i, '');
}

// Excel stores dates as serial numbers (days since 1899-12-30). Convert to JS Date.
export function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  totalSeconds -= seconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
    hours,
    minutes,
    seconds
  );
}

// Coerce various date shapes (Excel serial, ISO string, Date) to 'YYYY-MM-DD'.
export function coerceToISODate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    return excelSerialToDate(value).toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}
