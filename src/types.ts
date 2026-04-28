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
  aov: number;
  uniqueBuyers: number;
  totalPackagesSold: number;
  totalTargetRevenue: number;
  totalTargetDownloader: number;
  totalTargetRepeatOrder: number;
  progressDownloader: number;
  progressSales: number;
  progressConversion: number;
  selisihSales: number; // signed: negatif = hutang, positif = kelebihan
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

// ============================================================
// Content Scripts (Manajemen Konten)
// ============================================================

export type ContentType = 'video' | 'carousel' | 'single_post';
export type ContentStatus = 'draft' | 'review' | 'approved' | 'published';

// Field-field per tipe konten — disimpan di kolom JSONB `content`.
// Setiap interface adalah subset fields untuk satu type.

export interface VideoContent {
  kata_kunci?: string;
  ad_grup?: string;
  link_contoh_video?: string;
  visual_hook?: string;
  hook?: string;
  tahapan_1?: string;
  tahapan_2?: string;
  tahapan_3?: string;
  tahapan_4_cta?: string;
  footage?: string;
  keterangan_skrip?: string;
  caption_tiktok?: string;
  caption_instagram?: string;
}

export interface CarouselSlide {
  tema?: string;
  skrip?: string;
  kpt?: string;
}

export interface CarouselContent {
  slides: CarouselSlide[];
  caption?: string;
}

export interface SinglePostContent {
  title_judul?: string;
  sumber?: string;
  image_ilustrasi?: string;
  isi?: string;
  cta?: string;
  keterangan?: string;
  caption?: string;
}

export type ContentTypeData = VideoContent | CarouselContent | SinglePostContent;

export interface ContentScript {
  id: string;
  user_id: string | null;
  platform: string;            // jadiasn, cerebrum, dll. (lowercase)
  type: ContentType;
  scheduled_date: string | null;
  tgl_tay: string | null;
  title: string | null;
  status: ContentStatus;
  assigned_to: string | null;
  info_skrip: string | null;
  poster: string | null;
  creative: string | null;
  link_video: string | null;
  link_canva: string | null;
  cc: string | null;
  upload_status: string | null;
  link_konten: string | null;
  keterangan: string | null;
  catatan: string | null;
  content: ContentTypeData;
  created_at: string;
  updated_at: string;
}

export type NewContentScript = Omit<ContentScript, 'id' | 'created_at' | 'updated_at'>;
