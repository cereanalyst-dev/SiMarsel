/**
 * Single source of truth untuk semua yang sering user ubah.
 *
 * Ganti nilai di file ini untuk:
 *   - rebranding (nama app, perusahaan, logo)
 *   - tambah/hapus tab di sidebar
 *   - mapping nama panjang app → nama pendek (buat chart/tooltip)
 *   - warna palet chart
 *
 * Nilai yang perlu secret (URL/key Supabase) tetap di .env.local.
 */
import {
  BarChart3, Calendar, FileText, Gauge, KanbanSquare, LayoutDashboard,
  MessageSquare, Package, Settings, Sparkles, Tag, Target,
  TrendingUp, type LucideIcon,
} from 'lucide-react';

// ---------- Branding ----------
export const APP_NAME = 'SiMarsel';
export const APP_ACCENT_SUFFIX = '.';             // titik kecil di belakang nama
export const COMPANY_NAME = 'PT. Cerebrum Edukanesia Nusantara';
export const COMPANY_TAGLINE = 'Dashboard analytic marketing & sales';
export const LOGO_PATH = '/maungmarsel.jpeg';     // letakkan di public/

// ---------- Warna ----------
// Warna default chart (urutan = urutan app di dataset).
// Tambah/kurangi sesuka hati — index akan di-wrap modulo panjang array.
export const CHART_COLORS: string[] = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#f43f5e',
  '#3b82f6', '#22c55e', '#eab308', '#d946ef', '#64748b',
];

// ---------- App short-name mapping ----------
// Kalau data Anda pakai nama panjang (mis. "JADIASN"), map ke nama pendek
// yang ingin tampil di chart/tooltip. Tidak ada entry → pakai prefix strip.
export const APP_SHORT_NAMES: Record<string, string> = {
  JADIASN: 'ASN',
  JADIBUMN: 'BUMN',
  JADIPOLRI: 'Polri',
  JADIPPPK: 'PPPK',
  JADITNI: 'TNI',
  JADICPNS: 'CPNS',
  CEREBRUM: 'Cerebrum',
};

// Prefix yang akan distrip dari nama app untuk fallback short-name
// (mis. "JADIXYZ" → "XYZ").
export const APP_NAME_STRIP_PREFIX = /^JADI/i;

// ---------- Menu / Tab ----------
// Mendukung sub-menu collapsible: kalau item punya `children`, di-render
// sebagai expandable section di sidebar. Klik child → activeTab = child.id.
export interface MenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
  group: 'main' | 'system';
  // Optional: kalau ada children, sidebar render group dengan sub-items.
  // Item parent itu sendiri tidak punya halaman — cuma toggle expand.
  children?: Array<{ id: string; icon: LucideIcon; label: string }>;
}

export const MENU_ITEMS: MenuItem[] = [
  // 1. Tab tunggal
  { id: 'overview',   icon: LayoutDashboard, label: 'Ringkasan Performa',  group: 'main' },

  // 2. Group "Performa" (Produk + Kode Promo + Bulanan + Optimasi Harga)
  {
    id: 'performa-group',
    icon: BarChart3,
    label: 'Analisa Performa',
    group: 'main',
    children: [
      { id: 'packages',   icon: Package,    label: 'Produk' },
      { id: 'kode-promo', icon: Tag,        label: 'Kode Promo' },
      { id: 'bulanan',    icon: BarChart3,  label: 'Bulanan' },
      { id: 'optimasi',   icon: TrendingUp, label: 'Optimasi Harga' },
    ],
  },

  // 3. Strategi & Target
  { id: 'target',     icon: Target,          label: 'Strategi & Target',    group: 'main' },

  // 4. Kalender Marsel — standalone (per request user)
  { id: 'calendar',   icon: Calendar,        label: 'Kalender Marsel',      group: 'main' },

  // 5. Tasklist — Kanban board lintas departemen (Marketing + Sales)
  { id: 'tasklist',   icon: KanbanSquare,    label: 'Tasklist',             group: 'main' },

  // 5b. KPI — kartu performa per orang dengan metric per perspektif
  { id: 'kpi',        icon: Gauge,           label: 'KPI',                  group: 'main' },

  // 6. Group "Konten Hub" (Manajemen Konten + Analisa Sosmed — calendar
  //    sudah keluar jadi standalone)
  {
    id: 'konten-group',
    icon: FileText,
    label: 'Konten Hub',
    group: 'main',
    children: [
      { id: 'konten',   icon: FileText,      label: 'Manajemen Konten' },
      { id: 'social',   icon: MessageSquare, label: 'Analisa Sosmed' },
    ],
  },

  // 7. Asisten AI
  { id: 'asisten-ai', icon: Sparkles,       label: 'Asisten AI',           group: 'main' },

  // 8. Settings
  { id: 'settings',   icon: Settings,       label: 'Settings',             group: 'system' },
];

// Tab yang dipilih saat pertama kali buka dashboard.
export const DEFAULT_TAB: (typeof MENU_ITEMS)[number]['id'] = 'overview';

// ---------- Localization ----------
export const LOCALE = 'id-ID';
export const CURRENCY = 'IDR';

// ---------- Storage keys (hindari bentrok kalau multi-app di 1 domain) ----------
export const STORAGE_PREFIX = 'simarsel';
export const APPS_STORAGE_KEY = `${STORAGE_PREFIX}:apps:v2`;
export const SELECTED_APP_STORAGE_KEY = `${STORAGE_PREFIX}:selectedAppId:v1`;

// ---------- Data guardrails ----------
// Batas maksimum baris yang di-fetch dari Supabase saat load awal.
// Naikkan kalau dataset Anda lebih besar — tapi ingat semua rows di-load
// ke memory browser, jadi ada limit praktis sekitar 500K-1M tergantung
// kompleksitas kolom.
export const MAX_ROWS_PER_QUERY = 1_000_000;

// ---------- Misc ----------
// Dipakai ErrorBoundary untuk branding halaman error.
export const SUPPORT_EMAIL: string | null = null; // mis. 'support@company.com'
