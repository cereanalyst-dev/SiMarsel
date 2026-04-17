export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
  '#6366f1', '#f43f5e', '#22c55e', '#0ea5e9', '#a855f7',
];

// Map full app names to short labels used on compact charts / legends.
export const APP_SHORT_NAMES: Record<string, string> = {
  JADIASN: 'ASN',
  JADIBUMN: 'BUMN',
  JADIPOLRI: 'POLRI',
  JADIPPPK: 'PPPK',
  JADITNI: 'TNI',
  JADICPNS: 'CPNS',
  CEREBRUM: 'CEREBRUM',
};

export const DEFAULT_APP_NAMES = [
  'JADIASN',
  'JADIBUMN',
  'JADIPOLRI',
  'JADIPPPK',
  'JADITNI',
  'JADICPNS',
  'CEREBRUM',
] as const;
