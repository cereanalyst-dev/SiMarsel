export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('id-ID').format(value);

export const getShortAppName = (name: string): string => {
  const upper = (name || '').toUpperCase();
  if (upper === 'JADIASN') return 'ASN';
  if (upper === 'JADIBUMN') return 'BUMN';
  if (upper === 'JADIPOLRI') return 'Polri';
  if (upper === 'JADIPPPK') return 'PPPK';
  if (upper === 'JADITNI') return 'TNI';
  if (upper === 'JADICPNS') return 'CPNS';
  if (upper === 'CEREBRUM') return 'Cerebrum';
  return (name || '').replace(/^JADI/i, '');
};
