// Client-side domain types. These mirror shapes used by charts / calculations
// and are derived from the DB rows but kept stable so UI components don't
// depend directly on Supabase types.

export interface Transaction {
  transaction_date: string;
  payment_date: string;
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
}

export interface Downloader {
  date: string;
  source_app: string;
  count: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalTransactions: number;
  totalDownloaders: number;
  avgOrderValue: number;
  conversionRate: number;
  arppu: number;
  uniqueCustomers: number;
  prevRevenue: number;
  prevTransactions: number;
  prevDownloaders: number;
  prevAOV: number;
  prevConversion: number;
  prevARPPU: number;
  prevUniqueCustomers: number;
}

export interface SocialMediaContent {
  id?: string;
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
  link: string;
  objective: string;
}

export interface DailyData {
  targetDownloader: number;
  targetSales: number;
  targetUserPremium: number;
  actualDownloader?: number;
  actualSales?: number;
  actualUserPremium?: number;
  estimasiHarga: number;
  channel: string;
  promo: string;
  premium: string;
  benefit: string;
  benefit2: string;
  event: string;
  activity: string;
  extra: string;
  bcan: string;
  story: string;
  chat: string;
  live: string;
  ads: string;
  manualTargetSales?: number;
  manualTargetDownloader?: number;
  manualTargetPremium?: number;
  socialContent: SocialMediaContent[];
  dailyInsight?: string;
}

export interface TargetConfig {
  targetDownloader: number;
  targetUserPremium: number;
  targetSales: number;
  targetConversion: number;
  avgPrice: number;
}

export interface AppData {
  id: string;
  name: string;
  targetConfig: Record<string, TargetConfig>;
  dailyData: Record<string, DailyData>;
  isTargetSet: Record<string, boolean>;
}

export interface Filters {
  app: string;
  year: string;
  month: string;
  paymentMethod: string;
}

export interface AvailableOptions {
  apps: string[];
  years: string[];
  months: string[];
  paymentMethods: string[];
}
