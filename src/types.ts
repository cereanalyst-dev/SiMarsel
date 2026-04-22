export interface Transaction {
  transaction_date: string;
  payment_date: unknown;
  trx_id: string;
  source_app: string;
  methode_name: string;
  revenue: number;
  promo_code: string;
  content_name: string;
  full_name: string;
  email: string;
  phone: string;
  payment_status: string;
  // Derived
  parsed_payment_date: Date;
  year: number;
  month: number;
  quarter: number;
  year_month: string;
  hour: number;
}

export interface Downloader {
  date: unknown;
  source_app: string;
  count: number;
  // Derived
  parsed_date: Date;
  year: number;
  month: number;
  year_month: string;
}

export interface SocialMediaContent {
  platform: string;
  postingTime: string;
  contentType: string;
  title: string;
  caption: string;
  cta: string;
  topic: string;
  reach: number;
  engagement: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  hook: string;
  link: string;
  objective: string;
}

export interface DailyData {
  targetDownloader?: number;
  targetSales?: number;
  targetRepeatOrder?: number;
  actualDownloader?: number | null;
  actualSales?: number | null;
  actualRepeatOrder?: number | null;
  manualTargetDownloader?: number;
  manualTargetSales?: number;
  manualTargetRepeatOrder?: number;
  estimasiHarga?: number;
  channel?: string;
  promo?: string;
  strategy?: string;
  benefit?: string;
  event?: string;
  activity?: string;
  extra?: string;
  bcan?: string;
  story?: string;
  chat?: string;
  live?: string;
  ads?: string;
  premium?: string;
  benefit2?: string;
  socialContent?: SocialMediaContent[];
  dailyInsight?: string;
}

export interface TargetConfigMonth {
  targetDownloader: number;
  targetRepeatOrder: number;
  targetSales: number;
  targetConversion: number;
  avgPrice: number;
}

export interface AppData {
  id: string;
  name: string;
  targetConfig: Record<string, TargetConfigMonth>;
  dailyData: Record<string, DailyData>;
  isTargetSet: Record<string, boolean>;
}

export interface DashboardStats {
  totalRevenue: number;
  totalTransactions: number;
  totalUniqueOrders: number;
  aov: number;
  avgItemPrice: number;
  uniqueBuyers: number;
  totalPackagesSold: number;
  totalTargetRevenue: number;
  totalTargetDownloader: number;
  totalTargetRepeatOrder: number;
  progressDownloader: number;
  progressSales: number;
  progressConversion: number;
  hutangSales: number;
  totalRealDownloader: number;
  totalRealSales: number;
  totalRepeatOrderUsers: number;
}

export interface TrendItem {
  name: string;
  key?: string;
  revenue: number;
  transactions: number;
  downloader: number;
  conversion: number;
  rawDate?: Date;
  appBreakdown?: Record<
    string,
    { revenue: number; transactions: number; downloader: number }
  >;
}

export interface Filters {
  source_app: string;
  year: string;
  month: string;
  methode_name: string;
}

export interface AvailableOptions {
  source_apps: string[];
  years: number[];
  methods: string[];
}
