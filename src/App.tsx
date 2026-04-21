/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, ShoppingBag, DollarSign, Calendar, Filter,
  ChevronDown, Download, LayoutDashboard, Package,
  UserCheck, Users, ArrowUpRight, ArrowDownRight, Search, RefreshCw,
  Target, MessageSquare, Settings, Plus,
  ChevronRight, Activity, Zap, Smartphone
} from 'lucide-react';
import { format, parseISO, parse, startOfMonth, endOfMonth, getYear, getMonth, getQuarter } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { INITIAL_DATA } from './data';

// --- Types ---

interface Transaction {
  transaction_date: string;
  payment_date: any; // Can be Excel serial or ISO string
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
  // Derived fields
  parsed_payment_date: Date;
  year: number;
  month: number;
  quarter: number;
  year_month: string;
  hour: number;
}

interface Downloader {
  date: any;
  source_app: string;
  count: number;
  // Derived
  parsed_date: Date;
  year: number;
  month: number;
  year_month: string;
}

interface DashboardStats {
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
  hutangSales: number;
  totalRealDownloader: number;
  totalRealSales: number;
  totalRepeatOrderUsers: number;
}

interface SocialMediaContent {
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

interface DailyData {
  targetDownloader: number;
  targetSales: number;
  targetRepeatOrder: number;
  actualDownloader: number;
  actualSales: number;
  actualRepeatOrder: number;
  manualTargetDownloader?: number;
  manualTargetSales?: number;
  manualTargetRepeatOrder?: number;
  estimasiHarga: number;
  channel: string;
  promo: string;
  strategy: string;
  benefit: string;
  event: string;
  activity: string;
  extra: string;
  bcan: string;
  story: string;
  chat: string;
  live: string;
  ads: string;
  socialContent?: SocialMediaContent[];
  dailyInsight?: string;
}

interface AppData {
  id: string;
  name: string;
  targetConfig: Record<string, any>;
  dailyData: Record<string, DailyData>;
  isTargetSet: Record<string, boolean>;
}

// --- Constants ---

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#f43f5e',
  '#3b82f6', '#22c55e', '#eab308', '#d946ef', '#64748b'
];

interface MonthlyTarget {
  revenue: number;
  downloader: number;
  conversion: number;
  packageName: string;
  packagePrice: number;
  sellingPrice: number;
}

// --- Helper Functions ---

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const generateDailyInsight = (
  revenue: number,
  transactions: number,
  downloaders: number,
  strategies: any[],
  socialContent: SocialMediaContent[]
) => {
  if (revenue === 0 && transactions === 0 && downloaders === 0 && strategies.length === 0 && socialContent.length === 0) {
    return "Tidak ada aktivitas atau data transaksi yang tercatat untuk hari ini.";
  }

  let insight = "";

  // Analysis of Social Media vs Sales/Traffic
  if (socialContent.length > 0) {
    const totalReach = socialContent.reduce((acc, curr) => acc + curr.reach, 0);
    
    if (totalReach > 10000 && revenue > 5000000) {
      insight += `Konten sosial media hari ini sangat efektif dengan reach ${formatNumber(totalReach)}, berkontribusi signifikan terhadap revenue harian yang mencapai ${formatCurrency(revenue)}. `;
    } else if (totalReach > 5000 && downloaders > 100) {
      insight += `Aktivitas konten berhasil mendorong traffic baru dengan ${downloaders} downloader baru hari ini. `;
    } else if (socialContent.some(c => c.engagement > 500)) {
      insight += `Salah satu konten mendapatkan engagement tinggi, namun konversi ke sales masih perlu dioptimalkan. `;
    } else {
      insight += `Aktivitas konten sosial media membantu menjaga brand awareness hari ini. `;
    }
  }

  // Analysis of Operational Strategies
  if (strategies.length > 0) {
    const hasPromo = strategies.some(s => s.strategy?.promo);
    const hasPush = strategies.some(s => s.strategy?.chat || s.strategy?.bcan);
    
    if (hasPromo && transactions > 50) {
      insight += `Promo yang dijalankan berhasil meningkatkan volume transaksi menjadi ${transactions} order. `;
    }
    if (hasPush && revenue > 0) {
      insight += `Strategi push notification/chat efektif dalam menjaga momentum sales harian. `;
    }
  }

  // General Performance
  if (revenue > 10000000) {
    insight += "Performa hari ini sangat luar biasa (High Revenue Day). ";
  } else if (revenue > 0 && revenue < 1000000) {
    insight += "Revenue harian stabil, namun ada potensi peningkatan melalui optimalisasi jam posting konten. ";
  }

  if (!insight) {
    insight = "Aktivitas harian berjalan normal. Fokus pada konsistensi konten untuk meningkatkan awareness.";
  }

  return insight;
};

const getShortAppName = (name: string) => {
  const upper = name.toUpperCase();
  if (upper === 'JADIASN') return 'ASN';
  if (upper === 'JADIBUMN') return 'BUMN';
  if (upper === 'JADIPOLRI') return 'Polri';
  if (upper === 'JADIPPPK') return 'PPPK';
  if (upper === 'JADITNI') return 'TNI';
  if (upper === 'JADICPNS') return 'CPNS';
  if (upper === 'CEREBRUM') return 'Cerebrum';
  return name.replace(/^JADI/i, '');
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('id-ID').format(value);
};

const excelDateToJSDate = (serial: number) => {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
};

// --- Components ---

interface TrendItem {
  name: string;
  key?: string;
  revenue: number;
  transactions: number;
  downloader: number;
  conversion: number;
  rawDate?: Date;
  appBreakdown?: Record<string, {
    revenue: number;
    transactions: number;
    downloader: number;
  }>;
}

const StatCard = ({ title, value, icon: Icon, trend, colorClass, subtitle }: { 
  title: string; 
  value: string; 
  icon: any; 
  trend?: number; 
  colorClass: string; 
  subtitle?: string;
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileHover={{ y: -4 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50 flex flex-col gap-4 transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative overflow-hidden group"
  >
    <div className="flex justify-between items-start">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg shadow-slate-100", colorClass)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black",
          trend >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
      </div>
      {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-1">{subtitle}</p>}
    </div>
    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-0 group-hover:opacity-100 transition-all -z-10" />
  </motion.div>
);

const DrillDownModal = ({ isOpen, onClose, data, metric, appColors }: { 
  isOpen: boolean; 
  onClose: () => void; 
  data: any; 
  metric: string;
  appColors: Record<string, string>;
}) => {
  if (!isOpen || !data) return null;

  const breakdown = Object.entries(data.appBreakdown || {}).map(([app, vals]: [string, any]) => ({
    app,
    value: vals[metric] || 0,
    color: appColors[app]
  })).sort((a, b) => b.value - a.value);

  const total = breakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Detail Kontribusi: {data.name}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{metric}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <Plus className="w-5 h-5 text-slate-400 rotate-45" />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total {metric}</p>
            <h4 className="text-2xl font-black text-slate-900">
              {metric === 'revenue' ? formatCurrency(total) : 
               metric === 'conversion' ? `${total.toFixed(2)}%` : 
               formatNumber(total)}
            </h4>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Breakdown per Aplikasi</p>
            {breakdown.map((item: any) => (
              <div key={item.app} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-slate-700">{getShortAppName(item.app)}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {metric === 'revenue' ? formatCurrency(item.value) : 
                     metric === 'conversion' ? `${item.value.toFixed(2)}%` : 
                     formatNumber(item.value)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full" 
                    style={{ 
                      backgroundColor: item.color, 
                      width: `${(item.value / (total || 1)) * 100}%` 
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label, metric }: any) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);

    return (
      <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 min-w-[220px]">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">{label}</p>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black text-slate-900 uppercase">Total {metric}</span>
            <span className="text-[10px] font-black text-indigo-600">
              {metric === 'revenue' ? formatCurrency(total) : 
               metric === 'conversion' ? `${total.toFixed(2)}%` : 
               formatNumber(total)}
            </span>
          </div>
          {sortedPayload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-[9px] font-bold text-slate-500 uppercase">{getShortAppName(entry.name)}</span>
              </div>
              <span className="text-[9px] font-black text-slate-700">
                {metric === 'revenue' ? formatCurrency(entry.value) : 
                 metric === 'conversion' ? `${entry.value.toFixed(2)}%` : 
                 formatNumber(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const FlexibleChart = ({ 
  data, 
  type, 
  metric, 
  appColors, 
  onDrillDown,
  hiddenApps
}: { 
  data: any[]; 
  type: 'bar' | 'line' | 'area' | 'pie'; 
  metric: string;
  appColors: Record<string, string>;
  onDrillDown: (data: any) => void;
  hiddenApps: Set<string>;
}) => {
  const apps = Object.keys(appColors).filter(app => !hiddenApps.has(app));
  
  const renderChart = () => {
    if (type === 'pie') {
      const pieData = apps.map(app => {
        const total = data.reduce((sum, item) => sum + (item.appBreakdown?.[app]?.[metric] || 0), 0);
        return { name: app, value: total, fill: appColors[app] };
      }).filter(d => d.value > 0);

      return (
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={120}
            paddingAngle={5}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(val: number) => metric === 'revenue' ? formatCurrency(val) : formatNumber(val)}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
          />
        </PieChart>
      );
    }

    const ChartComponent = type === 'bar' ? BarChart : type === 'line' ? LineChart : AreaChart;
    const DataComponent = type === 'bar' ? Bar : type === 'line' ? Line : Area;

    return (
      <ChartComponent data={data} onClick={(e: any) => {
        const payload = e?.activePayload?.[0]?.payload;
        if (payload) onDrillDown(payload);
      }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
          tickFormatter={(val) => {
            if (metric === 'revenue') {
              if (val >= 1000000) return `Rp${(val/1000000).toFixed(1)}jt`;
              return `Rp${val}`;
            }
            if (metric === 'conversion') return `${val.toFixed(1)}%`;
            return formatNumber(val);
          }}
        />
        <Tooltip 
          cursor={{ fill: '#f8fafc' }}
          content={<CustomTooltip metric={metric} />}
        />
        {apps.map(app => (
          <DataComponent
            key={app}
            type="monotone"
            dataKey={`${metric}_${app}`}
            name={app}
            stackId="a"
            fill={appColors[app]}
            stroke={appColors[app]}
            fillOpacity={type === 'area' ? 0.1 : 1}
            strokeWidth={type === 'line' || type === 'area' ? 3 : 0}
            radius={type === 'bar' ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </ChartComponent>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {renderChart()}
    </ResponsiveContainer>
  );
};

const SocialMediaModal = ({ 
  isOpen, 
  onClose, 
  date, 
  content, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  date: string; 
  content: SocialMediaContent[]; 
  onSave: (newContent: SocialMediaContent[]) => void;
}) => {
  const [localContent, setLocalContent] = useState<SocialMediaContent[]>(content || []);

  useEffect(() => {
    setLocalContent(content || []);
  }, [content, isOpen]);

  if (!isOpen) return null;

  const addContent = () => {
    setLocalContent([...localContent, {
      platform: 'Instagram',
      postingTime: '10:00',
      contentType: 'Feed',
      title: '',
      caption: '',
      cta: '',
      topic: '',
      reach: 0,
      engagement: 0,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      hook: '',
      link: '',
      objective: 'Awareness'
    }]);
  };

  const updateContent = (index: number, field: keyof SocialMediaContent, value: any) => {
    const updated = [...localContent];
    updated[index] = { ...updated[index], [field]: value };
    setLocalContent(updated);
  };

  const removeContent = (index: number) => {
    setLocalContent(localContent.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Input Konten Sosial Media</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">{format(new Date(date), 'dd MMMM yyyy')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <Plus className="w-5 h-5 text-slate-400 rotate-45" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {localContent.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
              <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400">Belum ada konten sosial media untuk hari ini.</p>
              <button 
                onClick={addContent}
                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                Tambah Konten Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {localContent.map((item, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                  <button 
                    onClick={() => removeContent(idx)}
                    className="absolute top-4 right-4 p-1.5 bg-rose-50 text-rose-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-100"
                  >
                    <Plus className="w-3 h-3 rotate-45" />
                  </button>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                      <select 
                        value={item.platform}
                        onChange={(e) => updateContent(idx, 'platform', e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="Instagram">Instagram</option>
                        <option value="TikTok">TikTok</option>
                        <option value="Facebook">Facebook</option>
                        <option value="Twitter/X">Twitter/X</option>
                        <option value="YouTube">YouTube</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jam Posting</label>
                      <input 
                        type="time"
                        value={item.postingTime}
                        onChange={(e) => updateContent(idx, 'postingTime', e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Konten</label>
                      <select 
                        value={item.contentType}
                        onChange={(e) => updateContent(idx, 'contentType', e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="Feed">Feed</option>
                        <option value="Reels">Reels</option>
                        <option value="Story">Story</option>
                        <option value="Video">Video</option>
                        <option value="Shorts">Shorts</option>
                      </select>
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul / Caption</label>
                      <input 
                        type="text"
                        value={item.title}
                        onChange={(e) => updateContent(idx, 'title', e.target.value)}
                        placeholder="Masukkan judul atau caption konten..."
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reach</label>
                      <input 
                        type="number"
                        value={item.reach}
                        onChange={(e) => updateContent(idx, 'reach', Number(e.target.value))}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Engagement</label>
                      <input 
                        type="number"
                        value={item.engagement}
                        onChange={(e) => updateContent(idx, 'engagement', Number(e.target.value))}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Views</label>
                      <input 
                        type="number"
                        value={item.views}
                        onChange={(e) => updateContent(idx, 'views', Number(e.target.value))}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={addContent}
                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" />
                Tambah Konten Lainnya
              </button>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Batal
          </button>
          <button 
            onClick={() => {
              onSave(localContent);
              onClose();
            }}
            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            Simpan Data
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PackageCalendar = ({ data, downloaderData, availableOptions, apps, focusDate }: { data: Transaction[], downloaderData: Downloader[], availableOptions: any, apps: AppData[], focusDate?: Date | null }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedApp, setSelectedApp] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (focusDate) {
      setCurrentMonth(new Date(focusDate.getFullYear(), focusDate.getMonth(), 1));
      setSelectedDay(format(focusDate, 'yyyy-MM-dd'));
    }
  }, [focusDate]);

  const filteredData = useMemo(() => {
    if (!selectedApp) return data;
    return data.filter(d => d.source_app.toUpperCase() === selectedApp.toUpperCase());
  }, [data, selectedApp]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const activePackagesByDay = useMemo(() => {
    const map: Record<string, { packages: any[], appBreakdown: Record<string, { revenue: number, transactions: number }> }> = {};
    filteredData.forEach(item => {
      const dateStr = format(item.parsed_payment_date, 'yyyy-MM-dd');
      if (!map[dateStr]) map[dateStr] = { packages: [], appBreakdown: {} };
      
      const existingPkg = map[dateStr].packages.find(p => p.name === item.content_name);
      if (existingPkg) {
        existingPkg.revenue += item.revenue;
        existingPkg.transactions += 1;
        existingPkg.prices.push(item.revenue);
      } else {
        map[dateStr].packages.push({ 
          name: item.content_name, 
          revenue: item.revenue, 
          transactions: 1,
          prices: [item.revenue]
        });
      }

      const app = item.source_app || 'Unknown';
      if (!map[dateStr].appBreakdown[app]) {
        map[dateStr].appBreakdown[app] = { revenue: 0, transactions: 0 };
      }
      map[dateStr].appBreakdown[app].revenue += item.revenue;
      map[dateStr].appBreakdown[app].transactions += 1;
    });

    Object.keys(map).forEach(date => {
      map[date].packages = map[date].packages.map(p => ({
        ...p,
        minPrice: Math.min(...p.prices),
        maxPrice: Math.max(...p.prices),
        avgPrice: p.revenue / p.transactions
      }));
    });

    return map;
  }, [filteredData]);

  const selectedDayInsight = useMemo(() => {
    if (!selectedDay) return "";
    
    const dayRevenue = activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.revenue, 0) || 0;
    const dayTransactions = activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.transactions, 0) || 0;
    const dayDownloaders = downloaderData.filter(d => format(d.parsed_date, 'yyyy-MM-dd') === selectedDay).reduce((acc, curr) => acc + curr.count, 0);
    const dayStrategies = apps.map(app => ({
      appName: app.name,
      strategy: app.dailyData?.[selectedDay]
    })).filter(s => s.strategy);
    const daySocialContent = apps.flatMap(app => app.dailyData?.[selectedDay]?.socialContent || []);
    
    return generateDailyInsight(dayRevenue, dayTransactions, dayDownloaders, dayStrategies, daySocialContent);
  }, [selectedDay, activePackagesByDay, downloaderData, apps]);

  const selectedMonthPackages = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM');
    const grouped: Record<string, any> = {};
    filteredData.forEach(item => {
      if (item.year_month === monthStr) {
        if (!grouped[item.content_name]) {
          grouped[item.content_name] = { 
            name: item.content_name, 
            revenue: 0, 
            transactions: 0,
            buyers: new Set(),
            prices: []
          };
        }
        grouped[item.content_name].revenue += item.revenue;
        grouped[item.content_name].transactions += 1;
        grouped[item.content_name].buyers.add(item.email || item.phone || item.full_name || item.trx_id);
        grouped[item.content_name].prices.push(item.revenue);
      }
    });
    return Object.values(grouped).map((p: any) => ({
      ...p,
      uniqueBuyers: p.buyers.size,
      minPrice: p.prices.length > 0 ? p.prices.reduce((a: number, b: number) => Math.min(a, b), p.prices[0]) : 0,
      maxPrice: p.prices.length > 0 ? p.prices.reduce((a: number, b: number) => Math.max(a, b), p.prices[0]) : 0,
      avgPrice: p.revenue / p.transactions
    })).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [filteredData, currentMonth]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
  }, []);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Kalender Paket Aktif</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Visualisasi paket yang aktif berdasarkan transaksi harian</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* App Filter */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              <Smartphone className="w-4 h-4 text-slate-400 ml-2" />
              <select 
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none px-2 py-1.5 cursor-pointer"
              >
                <option value="">Semua App</option>
                {availableOptions.source_apps.map((app: string) => (
                  <option key={app} value={app}>{app}</option>
                ))}
              </select>
            </div>

            {/* Year & Month Selectors */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              <select 
                value={currentMonth.getFullYear()}
                onChange={(e) => setCurrentMonth(new Date(Number(e.target.value), currentMonth.getMonth(), 1))}
                className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none px-3 py-1.5 cursor-pointer border-r border-slate-200"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select 
                value={currentMonth.getMonth()}
                onChange={(e) => setCurrentMonth(new Date(currentMonth.getFullYear(), Number(e.target.value), 1))}
                className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none px-3 py-1.5 cursor-pointer"
              >
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3 mb-8">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
            <div key={day} className="text-center py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
          {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {daysInMonth.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const packages = activePackagesByDay[dateStr]?.packages || [];
            const hasActivity = packages.length > 0;
            const isSelected = selectedDay === dateStr;
            
            return (
              <div 
                key={dateStr} 
                onClick={() => hasActivity && setSelectedDay(isSelected ? null : dateStr)}
                className={cn(
                  "aspect-square rounded-2xl border p-2 flex flex-col items-center justify-center gap-1 transition-all relative group",
                  hasActivity 
                    ? "bg-indigo-50/30 border-indigo-100 hover:bg-indigo-50 hover:scale-105 cursor-pointer" 
                    : "bg-slate-50/30 border-slate-100",
                  isSelected && "ring-2 ring-indigo-500 bg-indigo-50 border-transparent scale-105"
                )}
              >
                <span className={cn(
                  "text-xs font-black",
                  hasActivity ? "text-indigo-600" : "text-slate-300"
                )}>
                  {format(day, 'd')}
                </span>
                {hasActivity && (
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-indigo-400" />
                    {packages.length > 1 && <div className="w-1 h-1 rounded-full bg-indigo-300" />}
                    {packages.length > 2 && <div className="w-1 h-1 rounded-full bg-indigo-200" />}
                  </div>
                )}
                {hasActivity && !isSelected && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white p-3 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Paket Aktif ({packages.length})</p>
                    <div className="space-y-1.5">
                      {packages.slice(0, 3).map((p, i) => (
                        <div key={i} className="flex justify-between items-center gap-2">
                          <span className="text-[9px] font-bold truncate">{p.name}</span>
                          <span className="text-[9px] font-black text-indigo-400">{p.transactions}x</span>
                        </div>
                      ))}
                      {packages.length > 3 && <p className="text-[8px] text-slate-400 italic">+{packages.length - 3} paket lainnya</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Daily Detail View */}
        <AnimatePresence mode="wait">
          {selectedDay && activePackagesByDay[selectedDay] && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 pt-8 border-t border-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Detail Transaksi - {format(new Date(selectedDay), 'dd MMMM yyyy')}
                </h4>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="text-[10px] font-black text-slate-400 uppercase hover:text-rose-500 transition-colors"
                >
                  Tutup
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Revenue</p>
                  <h3 className="text-xl font-black text-indigo-600">
                    {formatCurrency(activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.revenue, 0) || 0)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(activePackagesByDay[selectedDay]?.appBreakdown || {}).map(([app, vals]: [string, any]) => (
                      <span key={app} className="text-[8px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {app}: {formatCurrency(vals.revenue)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Transaksi</p>
                  <h3 className="text-xl font-black text-emerald-600">
                    {formatNumber(activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.transactions, 0) || 0)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(activePackagesByDay[selectedDay]?.appBreakdown || {}).map(([app, vals]: [string, any]) => (
                      <span key={app} className="text-[8px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {app}: {formatNumber(vals.transactions)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Downloader</p>
                  <h3 className="text-xl font-black text-violet-600">
                    {formatNumber(downloaderData.filter(d => format(d.parsed_date, 'yyyy-MM-dd') === selectedDay).reduce((acc, curr) => acc + curr.count, 0))}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {downloaderData.filter(d => format(d.parsed_date, 'yyyy-MM-dd') === selectedDay).map((d, i) => (
                      <span key={i} className="text-[8px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                        {d.source_app}: {d.count}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">AOV Harian</p>
                  <h3 className="text-xl font-black text-amber-600">
                    {(() => {
                      const rev = activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.revenue, 0) || 0;
                      const trx = activePackagesByDay[selectedDay]?.packages.reduce((acc, curr) => acc + curr.transactions, 0) || 0;
                      return trx ? formatCurrency(rev / trx) : 'Rp0';
                    })()}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2 border border-slate-100 rounded-2xl">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 border-b border-slate-50 sticky top-0 bg-white z-20 flex items-center gap-2">
                    <ShoppingBag className="w-3 h-3 text-emerald-600" />
                    Detail Transaksi
                  </h5>
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-10 bg-white z-10">
                      <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="py-4 px-4 bg-white">Nama Paket</th>
                        <th className="py-4 px-4 bg-white">Revenue</th>
                        <th className="py-4 px-4 bg-white">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...activePackagesByDay[selectedDay].packages].sort((a, b) => b.revenue - a.revenue).map((pkg, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-all group">
                          <td className="py-4 px-4 align-top">
                            <div className="text-xs font-black text-slate-700 max-w-[250px] whitespace-normal break-words line-clamp-5 leading-relaxed" title={pkg.name}>
                              {pkg.name}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs font-black text-indigo-600 align-top">{formatCurrency(pkg.revenue)}</td>
                          <td className="py-4 px-4 text-xs font-bold text-slate-500 align-top">{formatNumber(pkg.transactions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-indigo-600" />
                    Strategi & Aktivitas Operasional
                  </h5>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {apps.filter(app => !selectedApp || app.name.toUpperCase() === selectedApp.toUpperCase()).map(app => {
                      const dayData = app.dailyData?.[selectedDay];
                      if (!dayData) return null;
                      
                      const hasStrategy = dayData.strategy || dayData.benefit || dayData.event || dayData.activity || dayData.bcan || dayData.story || dayData.chat;
                      if (!hasStrategy) return null;

                      return (
                        <div key={app.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <p className="text-[9px] font-black text-indigo-600 uppercase mb-2">{app.name}</p>
                          <div className="grid grid-cols-2 gap-3">
                            {dayData.strategy && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Repeat Order</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.strategy}</p>
                              </div>
                            )}
                            {dayData.benefit && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Benefit</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.benefit}</p>
                              </div>
                            )}
                            {dayData.event && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Event</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.event}</p>
                              </div>
                            )}
                            {dayData.activity && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Aktivitas</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.activity}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Social Media & Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-indigo-600" />
                    Konten Sosial Media
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {apps.flatMap(app => app.dailyData?.[selectedDay as string]?.socialContent || []).map((content, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between mb-2">
                          <span className="text-[8px] font-black text-indigo-600 uppercase">{content.platform}</span>
                          <span className="text-[8px] font-bold text-slate-400">{content.postingTime} WIB</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-700 mb-2">{content.title || 'Tanpa Judul'}</p>
                        <p className="text-[10px] text-slate-500 mb-3 line-clamp-2">{content.caption}</p>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Reach</p>
                            <p className="text-[10px] font-black text-slate-900">{formatNumber(content.reach)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Eng</p>
                            <p className="text-[10px] font-black text-slate-900">{formatNumber(content.engagement)}</p>
                          </div>
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Views</p>
                            <p className="text-[10px] font-black text-slate-900">{formatNumber(content.views)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[8px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100">Type: {content.contentType}</span>
                          {content.cta && <span className="text-[8px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100">CTA: {content.cta}</span>}
                          <span className="text-[8px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-100">Obj: {content.objective}</span>
                        </div>
                      </div>
                    ))}
                    {apps.every(app => !app.dailyData?.[selectedDay as string]?.socialContent?.length) && (
                      <div className="col-span-full py-8 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Belum ada data konten</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-indigo-600 p-6 rounded-2xl text-white">
                  <h5 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-white" />
                    Auto-Generated Insights
                  </h5>
                  <p className="text-[11px] leading-relaxed opacity-90 italic">
                    {selectedDayInsight}
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-[8px] font-bold text-indigo-200 uppercase tracking-widest">Sebab-Akibat Analysis</p>
                    <p className="text-[10px] mt-1 text-white/80">Analisa ini dibuat secara otomatis berdasarkan korelasi data konten, strategi operasional, dan performa sales harian.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!selectedDay && (
          <div className="pt-8 border-t border-slate-100">
          <h4 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            Detail Performa Paket - {format(currentMonth, 'MMMM yyyy')}
          </h4>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-4">Nama Paket</th>
                  <th className="py-4 px-4">Revenue</th>
                  <th className="py-4 px-4">Transactions</th>
                  <th className="py-4 px-4 text-emerald-600">Low Price</th>
                  <th className="py-4 px-4 text-indigo-600">Avg Price</th>
                  <th className="py-4 px-4 text-rose-600">High Price</th>
                </tr>
              </thead>
              <tbody>
                {selectedMonthPackages.map((pkg: any, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-all group">
                    <td className="py-4 px-4 align-top">
                      <div className="text-xs font-black text-slate-700 max-w-[250px] whitespace-normal break-words line-clamp-5 leading-relaxed" title={pkg.name}>
                        {pkg.name}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-black text-indigo-600 align-top">{formatCurrency(pkg.revenue)}</td>
                    <td className="py-4 px-4 text-xs font-bold text-slate-500 align-top">{formatNumber(pkg.transactions)}</td>
                    <td className="py-4 px-4 text-xs font-black text-emerald-600 bg-emerald-50/30 align-top">{formatCurrency(pkg.minPrice)}</td>
                    <td className="py-4 px-4 text-xs font-black text-indigo-600 bg-indigo-50/30 align-top">{formatCurrency(pkg.avgPrice)}</td>
                    <td className="py-4 px-4 text-xs font-black text-rose-600 bg-rose-50/30 align-top">{formatCurrency(pkg.maxPrice)}</td>
                  </tr>
                ))}
                {selectedMonthPackages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <p className="text-sm font-bold text-slate-400">Tidak ada data transaksi di periode ini.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};

const TargetSection = ({ 
  apps, 
  setApps, 
  selectedAppId, 
  setSelectedAppId, 
  filters,
  data,
  downloaderData,
  targetMonth,
  setTargetMonth,
  setActiveTab,
  setCalendarFocusDate
}: { 
  apps: any[], 
  setApps: (a: any[]) => void, 
  selectedAppId: string, 
  setSelectedAppId: (id: string) => void,
  filters: any,
  data: Transaction[],
  downloaderData: Downloader[],
  targetMonth: string,
  setTargetMonth: (m: string) => void,
  setActiveTab: (tab: string) => void,
  setCalendarFocusDate: (d: Date | null) => void
}) => {
  const [showAppSelection, setShowAppSelection] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('All');
  const [socialModalDate, setSocialModalDate] = useState<string | null>(null);
  const selectedApp = apps.find(a => a.id === selectedAppId) || apps[0];

  const filteredAppsForSummary = useMemo(() => {
    if (platformFilter === 'All') return apps;
    return apps.filter(app => app.name === platformFilter);
  }, [apps, platformFilter]);
  
  // Get unique months from data for selection
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    const now = new Date();
    // Add next 12 months and past 12 months
    for (let i = -12; i <= 12; i++) {
      months.add(format(new Date(now.getFullYear(), now.getMonth() + i, 1), 'yyyy-MM'));
    }
    return Array.from(months).sort();
  }, []);

  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));
  const filteredMonths = useMemo(() => {
    return availableMonths.filter(m => m.startsWith(selectedYear));
  }, [availableMonths, selectedYear]);

  const emptyTargetForm = {
    targetDownloader: 0,
    targetRepeatOrder: 0,
    targetSales: 0,
    targetConversion: 0,
    avgPrice: 0,
  };

  const [form, setForm] = useState(selectedApp.targetConfig?.[targetMonth] || emptyTargetForm);

  useEffect(() => {
    setForm(selectedApp.targetConfig?.[targetMonth] || emptyTargetForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppId, targetMonth, selectedApp.targetConfig]);

  const daysInMonthCount = useMemo(() => {
    const [year, month] = targetMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [targetMonth]);

  const dates = useMemo(() => {
    const [year, month] = targetMonth.split('-').map(Number);
    return Array.from({ length: daysInMonthCount }, (_, i) => {
      return format(new Date(year, month - 1, i + 1), 'yyyy-MM-dd');
    });
  }, [targetMonth, daysInMonthCount]);

  const handleGenerateSheet = () => {
    const dailyDownloader = Math.ceil(form.targetDownloader / daysInMonthCount);
    const dailySales = Math.ceil(form.targetSales / daysInMonthCount);
    const dailyRepeatOrder = Math.ceil(form.targetRepeatOrder / daysInMonthCount);

    const existingDaily = selectedApp.dailyData || {};
    const newDailyData: Record<string, any> = { ...existingDaily };
    dates.forEach(date => {
      const prev = existingDaily[date] || {};
      newDailyData[date] = {
        targetDownloader: dailyDownloader,
        targetSales: dailySales,
        targetRepeatOrder: dailyRepeatOrder,
        // preserve any already-entered actuals so regenerate won't wipe user work
        actualDownloader: prev.actualDownloader ?? null,
        actualSales: prev.actualSales ?? null,
        actualRepeatOrder: prev.actualRepeatOrder ?? null,
        estimasiHarga: form.avgPrice,
        channel: prev.channel || '',
        promo: prev.promo || '',
        strategy: prev.strategy || '',
        benefit: prev.benefit || '',
        event: prev.event || '',
        extra: prev.extra || '',
        bcan: prev.bcan || '',
        story: prev.story || '',
        chat: prev.chat || '',
        activity: prev.activity || '',
        socialContent: prev.socialContent || [],
      };
    });

    const newTargetConfig = { ...(selectedApp.targetConfig || {}) };
    newTargetConfig[targetMonth] = form;

    const newIsTargetSet = { ...(selectedApp.isTargetSet || {}) };
    newIsTargetSet[targetMonth] = true;

    setApps(apps.map(a => a.id === selectedAppId ? { 
      ...a, 
      targetConfig: newTargetConfig, 
      dailyData: newDailyData,
      isTargetSet: newIsTargetSet
    } : a));
  };

  const updateDailyValue = (date: string, field: string, value: any) => {
    const newDailyData = { ...selectedApp.dailyData };
    if (!newDailyData[date]) {
      newDailyData[date] = {};
    }
    newDailyData[date][field] = value;
    setApps(apps.map(a => a.id === selectedAppId ? { ...a, dailyData: newDailyData } : a));
  };

  const isTargetSetForMonth = selectedApp.isTargetSet?.[targetMonth];

  const summary = useMemo(() => {
    const dailyValues = dates.map(date => selectedApp.dailyData?.[date] || {});
    const totalRealDownloader = dailyValues.reduce((sum, d) => sum + (Number(d.actualDownloader) || 0), 0);
    const totalRealSales = dailyValues.reduce((sum, d) => sum + (Number(d.actualSales) || 0), 0);
    const totalRealRepeatOrder = dailyValues.reduce((sum, d) => sum + (Number(d.actualRepeatOrder) || 0), 0);

    const targetConfig = selectedApp.targetConfig?.[targetMonth] || {
      targetDownloader: 0,
      targetSales: 0,
      targetRepeatOrder: 0,
      targetConversion: 0,
      avgPrice: 0
    };

    const progressDownloader = targetConfig.targetDownloader > 0
      ? (totalRealDownloader / targetConfig.targetDownloader) * 100
      : 0;
    const progressSales = targetConfig.targetSales > 0
      ? (totalRealSales / targetConfig.targetSales) * 100
      : 0;
    const progressConversion = totalRealDownloader > 0
      ? (totalRealRepeatOrder / totalRealDownloader) * 100
      : 0;

    // Calculate Hutang Sales (Debt)
    const lastFilledIdx = dates.reduce((acc, d, i) => {
      const data = selectedApp.dailyData?.[d];
      const hasData = data && (
        (data.actualSales !== undefined && data.actualSales !== null && data.actualSales !== 0) ||
        (data.actualDownloader !== undefined && data.actualDownloader !== null && data.actualDownloader !== 0) ||
        (data.actualRepeatOrder !== undefined && data.actualRepeatOrder !== null && data.actualRepeatOrder !== 0)
      );
      return hasData ? i : acc;
    }, -1);

    const baseDailySales = targetConfig.targetSales / Math.max(1, dates.length);
    const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
    const hutangSales = Math.max(0, expectedSalesSoFar - totalRealSales);

    return {
      totalRealDownloader,
      totalRealSales,
      totalRealRepeatOrder,
      progressDownloader,
      progressSales,
      progressConversion,
      hutangSales,
      targetConfig
    };
  }, [selectedApp, targetMonth, dates]);

  const addApp = () => {
    const newId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 11);
    setApps([...apps, {
      id: newId,
      name: `App ${apps.length + 1}`,
      targetConfig: {},
      dailyData: {},
      isTargetSet: {}
    }]);
    setSelectedAppId(newId);
  };

  const removeApp = (id: string) => {
    if (apps.length <= 1) return;
    const newApps = apps.filter(a => a.id !== id);
    setApps(newApps);
    if (selectedAppId === id) setSelectedAppId(newApps[0].id);
  };

  const globalSummary = useMemo(() => {
    let totalTargetDownloader = 0;
    let totalRealDownloader = 0;
    let totalTargetSales = 0;
    let totalRealSales = 0;
    let totalTargetRepeatOrder = 0;
    let totalRealRepeatOrder = 0;
    let totalHutangSales = 0;

    filteredAppsForSummary.forEach(app => {
      const targetConfig = app.targetConfig?.[targetMonth];
      if (targetConfig) {
        totalTargetDownloader += targetConfig.targetDownloader || 0;
        totalTargetSales += targetConfig.targetSales || 0;
        totalTargetRepeatOrder += targetConfig.targetRepeatOrder || 0;
      }

      const dailyData = app.dailyData || {};
      let appRealDownloader = 0;
      let appRealSales = 0;
      let appRealRepeatOrder = 0;
      let lastFilledIdx = -1;

      dates.forEach((date, idx) => {
        const d = dailyData[date];
        if (d) {
          const rd = Number(d.actualDownloader) || 0;
          const rs = Number(d.actualSales) || 0;
          const rr = Number(d.actualRepeatOrder) || 0;
          appRealDownloader += rd;
          appRealSales += rs;
          appRealRepeatOrder += rr;

          if (rd > 0 || rs > 0 || rr > 0) {
            lastFilledIdx = idx;
          }
        }
      });

      totalRealDownloader += appRealDownloader;
      totalRealSales += appRealSales;
      totalRealRepeatOrder += appRealRepeatOrder;

      if (targetConfig && targetConfig.targetSales > 0) {
        const baseDailySales = targetConfig.targetSales / Math.max(1, dates.length);
        const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
        totalHutangSales += Math.max(0, expectedSalesSoFar - appRealSales);
      }
    });

    return {
      totalTargetDownloader,
      totalRealDownloader,
      totalTargetSales,
      totalRealSales,
      totalTargetRepeatOrder,
      totalRealRepeatOrder,
      totalHutangSales,
      downloaderProgress: totalTargetDownloader > 0 ? (totalRealDownloader / totalTargetDownloader) * 100 : 0,
      salesProgress: totalTargetSales > 0 ? (totalRealSales / totalTargetSales) * 100 : 0,
      conversionProgress: totalRealDownloader > 0 ? (totalRealRepeatOrder / totalRealDownloader) * 100 : 0
    };
  }, [filteredAppsForSummary, targetMonth, dates]);

  if (showAppSelection) {
    return (
      <div className="space-y-10">
        {/* Global Summary Dashboard */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <LayoutDashboard className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Ringkasan Semua Platform</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Akumulasi performa dari seluruh aplikasi di bulan {format(new Date(targetMonth + '-01'), 'MMMM yyyy')}</p>
              </div>
            </div>

            {/* Global Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 px-3 border-r border-slate-200">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none py-1.5 cursor-pointer"
                >
                  <option value="All">Semua Platform</option>
                  {apps.map(app => <option key={app.id} value={app.name}>{app.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 px-3 border-r border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none py-1.5 cursor-pointer"
                >
                  {Array.from(new Set(availableMonths.map(m => m.split('-')[0]))).sort().map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 px-3">
                <select 
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black text-slate-600 outline-none py-1.5 cursor-pointer"
                >
                  {filteredMonths.map(m => (
                    <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progress Downloader</p>
              <h3 className="text-xl font-black text-indigo-600">{globalSummary.downloaderProgress.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min(100, globalSummary.downloaderProgress)}%` }} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-emerald-100 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progress Sales</p>
              <h3 className="text-xl font-black text-emerald-600">{globalSummary.salesProgress.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, globalSummary.salesProgress)}%` }} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-violet-100 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progres Konversi</p>
              <h3 className="text-xl font-black text-violet-600">{globalSummary.conversionProgress.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-violet-500 transition-all duration-1000" style={{ width: `${Math.min(100, globalSummary.conversionProgress)}%` }} />
              </div>
            </div>
            <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 shadow-sm hover:bg-rose-100/50 transition-all">
              <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mb-2">Hutang Sales</p>
              <h3 className="text-xl font-black text-rose-600">{formatCurrency(globalSummary.totalHutangSales)}</h3>
              <p className="text-[8px] text-rose-400 font-bold mt-1">Defisit s/d hari ini</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Real Downloader</p>
              <h3 className="text-xl font-black text-slate-900">{formatNumber(globalSummary.totalRealDownloader)}</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Target: {formatNumber(globalSummary.totalTargetDownloader)}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Real Sales</p>
              <h3 className="text-xl font-black text-slate-900">{formatCurrency(globalSummary.totalRealSales)}</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Target: {formatCurrency(globalSummary.totalTargetSales)}</p>
            </div>
          </div>

          {/* Target Recap Table */}
          <div className="mt-10 pt-10 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-50 rounded-xl">
                <Target className="w-4 h-4 text-violet-600" />
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Rekapitulasi Target All Platform</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="py-4 px-4">Platform</th>
                    <th className="py-4 px-4">Progress Downloader</th>
                    <th className="py-4 px-4">Progress Sales</th>
                    <th className="py-4 px-4">Progres Konversi</th>
                    <th className="py-4 px-4">Hutang Sales</th>
                    <th className="py-4 px-4">Total Real Downloader</th>
                    <th className="py-4 px-4">Total Real Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppsForSummary.map(app => {
                    const target = app.targetConfig?.[targetMonth];
                    const dailyData = app.dailyData || {};
                    let appRealDownloader = 0;
                    let appRealSales = 0;
                    let appRealRepeatOrder = 0;
                    let lastFilledIdx = -1;

                    dates.forEach((date, idx) => {
                      const d = dailyData[date];
                      if (d) {
                        const rd = Number(d.actualDownloader) || 0;
                        const rs = Number(d.actualSales) || 0;
                        const rr = Number(d.actualRepeatOrder) || 0;
                        appRealDownloader += rd;
                        appRealSales += rs;
                        appRealRepeatOrder += rr;
                        if (rd > 0 || rs > 0 || rr > 0) lastFilledIdx = idx;
                      }
                    });

                    const progressDownloader = target?.targetDownloader > 0 ? (appRealDownloader / target.targetDownloader) * 100 : 0;
                    const progressSales = target?.targetSales > 0 ? (appRealSales / target.targetSales) * 100 : 0;
                    const progressConversion = appRealDownloader > 0 ? (appRealRepeatOrder / appRealDownloader) * 100 : 0;

                    let hutangSales = 0;
                    if (target?.targetSales > 0) {
                      const baseDailySales = target.targetSales / Math.max(1, dates.length);
                      const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
                      hutangSales = Math.max(0, expectedSalesSoFar - appRealSales);
                    }

                    return (
                      <tr key={app.id} className="border-b border-slate-50 hover:bg-slate-50 transition-all group">
                        <td className="py-4 px-4 text-xs font-black text-slate-700">{app.name}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600">{progressDownloader.toFixed(1)}%</span>
                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, progressDownloader)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-600">{progressSales.toFixed(1)}%</span>
                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, progressSales)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-violet-600">{progressConversion.toFixed(1)}%</span>
                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, progressConversion)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-xs font-bold text-rose-600">{formatCurrency(hutangSales)}</td>
                        <td className="py-4 px-4 text-xs font-bold text-slate-500">{formatNumber(appRealDownloader)}</td>
                        <td className="py-4 px-4 text-xs font-black text-slate-900">{formatCurrency(appRealSales)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pilih Aplikasi</h2>
            <p className="text-sm text-slate-400 font-medium mt-1">Pilih aplikasi untuk mengatur target operasional</p>
          </div>
          <button 
            onClick={addApp}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Aplikasi
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps.map(app => (
            <motion.div
              key={app.id}
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 cursor-pointer group hover:border-indigo-200 transition-all relative"
            >
              <div 
                onClick={() => {
                  setSelectedAppId(app.id);
                  setShowAppSelection(false);
                }}
                className="absolute inset-0 z-0"
              />
              <div className="relative z-10">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Smartphone className="w-7 h-7 text-indigo-600" />
                </div>
                <input
                  type="text"
                  value={app.name}
                  onChange={(e) => {
                    setApps(apps.map(a => a.id === app.id ? { ...a, name: e.target.value } : a));
                  }}
                  className="text-lg font-black text-slate-900 mb-2 bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-100 rounded px-1 w-full"
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  {Object.keys(app.targetConfig || {}).length} Target Terpasang
                </p>
                <div 
                  onClick={() => {
                    setSelectedAppId(app.id);
                    setShowAppSelection(false);
                  }}
                  className="mt-6 flex items-center justify-between text-indigo-600"
                >
                  <span className="text-xs font-black uppercase tracking-widest">Atur Target</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* App & Month Selector */}
      <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50 flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAppSelection(true)}
            className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
          >
            <ChevronDown className="w-5 h-5 rotate-90" />
          </button>
          <div>
            <h3 className="text-sm font-black text-slate-900">{selectedApp.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pengaturan Target</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-transparent border-none text-xs font-black text-slate-600 outline-none px-4 py-1.5 cursor-pointer border-r border-slate-200"
          >
            {Array.from(new Set(availableMonths.map(m => m.split('-')[0]))).sort().map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select 
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="bg-transparent border-none text-xs font-black text-slate-600 outline-none px-4 py-1.5 cursor-pointer"
          >
            {filteredMonths.map(m => (
              <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM')}</option>
            ))}
          </select>
        </div>
      </div>

      {!isTargetSetForMonth ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-50 max-w-4xl mx-auto"
        >
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-indigo-50 rounded-2xl">
              <Target className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Set Target - {selectedApp.name}</h3>
              <p className="text-sm text-slate-400 font-medium">Target untuk bulan {format(new Date(targetMonth + '-01'), 'MMMM yyyy')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target Downloader</label>
              <input 
                type="number"
                value={form.targetDownloader || ''}
                onChange={(e) => setForm({...form, targetDownloader: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target Repeat Order</label>
              <input
                type="number"
                value={form.targetRepeatOrder || ''}
                onChange={(e) => setForm({...form, targetRepeatOrder: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target Sales (Revenue)</label>
              <input 
                type="number"
                value={form.targetSales || ''}
                onChange={(e) => setForm({...form, targetSales: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target Konversi (%)</label>
              <input 
                type="number"
                value={form.targetConversion || ''}
                onChange={(e) => setForm({...form, targetConversion: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Rata-rata Harga Paket</label>
              <input 
                type="number"
                value={form.avgPrice || ''}
                onChange={(e) => setForm({...form, avgPrice: Number(e.target.value)})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold"
                placeholder="0"
              />
            </div>
          </div>

          <button 
            onClick={handleGenerateSheet}
            className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Generate Sheet Operasional
          </button>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progress Downloader</p>
              <h3 className="text-xl font-black text-indigo-600">{summary.progressDownloader.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, summary.progressDownloader)}%` }} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progress Sales</p>
              <h3 className="text-xl font-black text-emerald-600">{summary.progressSales.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, summary.progressSales)}%` }} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Progres Konversi</p>
              <h3 className="text-xl font-black text-violet-600">{summary.progressConversion.toFixed(1)}%</h3>
              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, summary.progressConversion)}%` }} />
              </div>
            </div>
            <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 shadow-sm">
              <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mb-2">Hutang Sales</p>
              <h3 className="text-xl font-black text-rose-600">{formatCurrency(summary.hutangSales)}</h3>
              <p className="text-[8px] text-rose-400 font-bold mt-1">Defisit s/d hari ini</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Real Downloader</p>
              <h3 className="text-xl font-black text-slate-900">{formatNumber(summary.totalRealDownloader)}</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Target: {formatNumber(selectedApp.targetConfig[targetMonth]?.targetDownloader || 0)}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Real Sales</p>
              <h3 className="text-xl font-black text-slate-900">{formatCurrency(summary.totalRealSales)}</h3>
              <p className="text-[8px] text-slate-400 font-bold mt-1">Target: {formatCurrency(selectedApp.targetConfig[targetMonth]?.targetSales || 0)}</p>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-50 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/30 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl">
                  <Activity className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Operational Sheet - {selectedApp.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(targetMonth + '-01'), 'MMMM yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    const newIsTargetSet = { ...(selectedApp.isTargetSet || {}) };
                    newIsTargetSet[targetMonth] = false;
                    setApps(apps.map(a => a.id === selectedAppId ? { ...a, isTargetSet: newIsTargetSet } : a));
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                >
                  Edit Target
                </button>
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[2200px] border-spacing-0">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50">
                    <th colSpan={2} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-slate-200/20">Waktu</th>
                    <th colSpan={2} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-indigo-100/20">Downloader</th>
                    <th colSpan={3} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-violet-100/20 text-xs font-black uppercase tracking-widest text-violet-700">Repeat Order</th>
                    <th colSpan={4} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-emerald-100/20">Sales & Revenue</th>
                    <th colSpan={4} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-slate-100/50">Strategi</th>
                    <th colSpan={4} className="py-2 px-4 border-b border-slate-200 text-center bg-slate-200/50">Aktivitas</th>
                  </tr>
                  <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-50/80">
                    <th className="py-4 px-4 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">Tanggal</th>
                    <th className="py-4 px-4 border-r border-slate-200">Hari</th>
                    <th className="py-4 px-4 border-r border-slate-200">Target</th>
                    <th className="py-4 px-4 border-r border-slate-200">Real</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-indigo-50/30">Target</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-indigo-50/30">Real</th>
                    <th className="py-4 px-4 border-r border-slate-200">Conv (%)</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-emerald-50/30">Target</th>
                    <th className="py-4 px-4 border-r border-slate-200 bg-emerald-50/30">Real</th>
                    <th className="py-4 px-4 border-r border-slate-200">Status</th>
                    <th className="py-4 px-4 border-r border-slate-200">Keterangan</th>
                    <th className="py-4 px-4 border-r border-slate-200">Repeat Order</th>
                    <th className="py-4 px-4 border-r border-slate-200">Benefit</th>
                    <th className="py-4 px-4 border-r border-slate-200">Event</th>
                    <th className="py-4 px-4 border-r border-slate-200">Benefit</th>
                    <th className="py-4 px-4 border-r border-slate-200">BC</th>
                    <th className="py-4 px-4 border-r border-slate-200">Story</th>
                    <th className="py-4 px-4 border-r border-slate-200">Chat</th>
                    <th className="py-4 px-4 border-r border-slate-200">Lainnya</th>
                    <th className="py-4 px-4 border-slate-200 bg-indigo-50/50">Social Media</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date, idx) => {
                    const dayData = selectedApp.dailyData[date] || {};
                    const conv = dayData.actualDownloader > 0 ? (dayData.actualRepeatOrder / dayData.actualDownloader) * 100 : 0;
                    
                    // Chained Dynamic Target Logic
                    const totalTargetSales = selectedApp.targetConfig[targetMonth]?.targetSales || 0;
                    const totalTargetDownloader = selectedApp.targetConfig[targetMonth]?.targetDownloader || 0;
                    const totalTargetRepeatOrder = selectedApp.targetConfig[targetMonth]?.targetRepeatOrder || 0;
                    
                    const baseDailySales = totalTargetSales / dates.length;
                    const baseDailyDownloader = totalTargetDownloader / dates.length;
                    const baseDailyRepeatOrder = totalTargetRepeatOrder / dates.length;

                    // Find the last day that has real data (not null/undefined)
                    const lastFilledIdx = dates.reduce((acc, d, i) => {
                      const data = selectedApp.dailyData[d];
                      const hasData = data && (
                        (data.actualSales !== undefined && data.actualSales !== null) ||
                        (data.actualDownloader !== undefined && data.actualDownloader !== null) ||
                        (data.actualRepeatOrder !== undefined && data.actualRepeatOrder !== null)
                      );
                      return hasData ? i : acc;
                    }, -1);

                    let flexibleTargetSales = baseDailySales;
                    let flexibleTargetDownloader = baseDailyDownloader;
                    let flexibleTargetRepeatOrder = baseDailyRepeatOrder;

                    // If this is the day immediately after the last filled day, apply the accumulated deficit
                    if (idx === lastFilledIdx + 1) {
                      const actualsBefore = dates.slice(0, lastFilledIdx + 1).map(d => selectedApp.dailyData[d] || {});
                      const totalActualSalesBefore = actualsBefore.reduce((sum, d) => sum + (d.actualSales || 0), 0);
                      const totalActualDownloaderBefore = actualsBefore.reduce((sum, d) => sum + (d.actualDownloader || 0), 0);
                      const totalActualRepeatOrderBefore = actualsBefore.reduce((sum, d) => sum + (d.actualRepeatOrder || 0), 0);
                      
                      const expectedSalesBefore = baseDailySales * (lastFilledIdx + 1);
                      const expectedDownloaderBefore = baseDailyDownloader * (lastFilledIdx + 1);
                      const expectedRepeatOrderBefore = baseDailyRepeatOrder * (lastFilledIdx + 1);

                      const deficitSales = expectedSalesBefore - totalActualSalesBefore;
                      const deficitDownloader = expectedDownloaderBefore - totalActualDownloaderBefore;
                      const deficitRepeatOrder = expectedRepeatOrderBefore - totalActualRepeatOrderBefore;

                      // Apply reasonable limits (max 2x base target, min 0.2x base target)
                      flexibleTargetSales = Math.max(baseDailySales * 0.2, Math.min(baseDailySales * 2, baseDailySales + deficitSales));
                      flexibleTargetDownloader = Math.max(baseDailyDownloader * 0.2, Math.min(baseDailyDownloader * 2, baseDailyDownloader + deficitDownloader));
                      flexibleTargetRepeatOrder = Math.max(baseDailyRepeatOrder * 0.2, Math.min(baseDailyRepeatOrder * 2, baseDailyRepeatOrder + deficitRepeatOrder));
                    }

                    // Use manual override if exists
                    const displayTargetSales = dayData.manualTargetSales || flexibleTargetSales;
                    const displayTargetDownloader = dayData.manualTargetDownloader || flexibleTargetDownloader;
                    const displayTargetRepeatOrder = dayData.manualTargetRepeatOrder || flexibleTargetRepeatOrder;

                    const achievement = displayTargetSales > 0 ? (dayData.actualSales / displayTargetSales) * 100 : 0;
                    let statusColor = "text-slate-400";
                    let statusText = "Menunggu";
                    let statusBg = "bg-slate-50";

                    if (dayData.actualSales > 0) {
                      if (achievement >= 100) {
                        statusColor = "text-emerald-600";
                        statusText = "Melebihi";
                        statusBg = "bg-emerald-50";
                      } else if (achievement >= 90) {
                        statusColor = "text-amber-600";
                        statusText = "Mendekati";
                        statusBg = "bg-amber-50";
                      } else {
                        statusColor = "text-rose-600";
                        statusText = "Kurang";
                        statusBg = "bg-rose-50";
                      }
                    }

                    const salesDiff = (dayData.actualSales || 0) - displayTargetSales;
                    const keteranganText = dayData.actualSales > 0 
                      ? `${salesDiff >= 0 ? '+' : ''}${formatCurrency(salesDiff)}`
                      : '-';

                    return (
                      <tr key={date} className={cn(
                        "border-b border-slate-100 hover:bg-indigo-50/30 transition-all group",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      )}>
                        <td className="py-3 px-4 text-[11px] font-black text-slate-600 sticky left-0 bg-inherit group-hover:bg-indigo-50 z-10 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            <span>{format(new Date(date), 'dd MMM')}</span>
                            <button 
                              onClick={() => {
                                setCalendarFocusDate(new Date(date));
                                setActiveTab('calendar');
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 bg-indigo-100 text-indigo-600 rounded-md transition-all hover:bg-indigo-200"
                              title="Lihat di Kalender"
                            >
                              <Calendar className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[11px] font-bold text-slate-400 border-r border-slate-100">
                          {format(new Date(date), 'EEE')}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="number" 
                            value={dayData.manualTargetDownloader || Math.round(displayTargetDownloader)} 
                            onChange={(e) => updateDailyValue(date, 'manualTargetDownloader', Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-indigo-600 transition-colors"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="number" 
                            value={dayData.actualDownloader === null || dayData.actualDownloader === undefined ? '' : dayData.actualDownloader} 
                            onChange={(e) => updateDailyValue(date, 'actualDownloader', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-black text-indigo-600 outline-none"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-indigo-50/20">
                          <input 
                            type="number" 
                            value={dayData.manualTargetRepeatOrder || Math.round(displayTargetRepeatOrder)} 
                            onChange={(e) => updateDailyValue(date, 'manualTargetRepeatOrder', Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-indigo-600 transition-colors"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-indigo-50/20">
                          <input 
                            type="number" 
                            value={dayData.actualRepeatOrder === null || dayData.actualRepeatOrder === undefined ? '' : dayData.actualRepeatOrder} 
                            onChange={(e) => updateDailyValue(date, 'actualRepeatOrder', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-black text-indigo-600 outline-none"
                          />
                        </td>
                        <td className={cn("py-3 px-4 text-[11px] font-black border-r border-slate-100", conv >= (selectedApp.targetConfig[targetMonth]?.targetConversion || 0) ? "text-emerald-600" : "text-rose-600")}>
                          {conv.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-emerald-50/20">
                          <input 
                            type="number" 
                            value={dayData.manualTargetSales || Math.round(displayTargetSales)} 
                            onChange={(e) => updateDailyValue(date, 'manualTargetSales', Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-emerald-600 transition-colors"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-emerald-50/20">
                          <input 
                            type="number" 
                            value={dayData.actualSales === null || dayData.actualSales === undefined ? '' : dayData.actualSales} 
                            onChange={(e) => updateDailyValue(date, 'actualSales', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-black text-emerald-600 outline-none"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <div className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase text-center", statusBg, statusColor)}>
                            {statusText}
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <div className={cn("text-[10px] font-bold text-center", salesDiff >= 0 ? "text-emerald-600" : "text-rose-600")}>
                            {keteranganText}
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.premium || ''} 
                            onChange={(e) => updateDailyValue(date, 'premium', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.benefit || ''} 
                            onChange={(e) => updateDailyValue(date, 'benefit', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.event || ''} 
                            onChange={(e) => updateDailyValue(date, 'event', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.benefit2 || ''} 
                            onChange={(e) => updateDailyValue(date, 'benefit2', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.bcan || ''} 
                            onChange={(e) => updateDailyValue(date, 'bcan', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.story || ''} 
                            onChange={(e) => updateDailyValue(date, 'story', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.chat || ''} 
                            onChange={(e) => updateDailyValue(date, 'chat', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100">
                          <input 
                            type="text" 
                            value={dayData.activity || ''} 
                            onChange={(e) => updateDailyValue(date, 'activity', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
                        </td>
                        <td className="py-3 px-4 bg-indigo-50/30">
                          <button 
                            onClick={() => setSocialModalDate(date)}
                            className={cn(
                              "w-full py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5",
                              dayData.socialContent?.length > 0 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50"
                            )}
                          >
                            <MessageSquare className="w-3 h-3" />
                            {dayData.socialContent?.length > 0 ? `${dayData.socialContent.length} Konten` : 'Input'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {socialModalDate && (
        <SocialMediaModal 
          isOpen={!!socialModalDate}
          onClose={() => setSocialModalDate(null)}
          date={socialModalDate}
          content={selectedApp.dailyData[socialModalDate]?.socialContent || []}
          onSave={(newContent) => updateDailyValue(socialModalDate, 'socialContent', newContent)}
        />
      )}
    </div>
  );
};

const FilterSection = ({ filters, setFilters, availableOptions }: {
  filters: any;
  setFilters: (f: any) => void;
  availableOptions: { source_apps: string[]; years: number[]; methods: string[] };
}) => {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Filter className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Filter Dashboard</h2>
        </div>
        <button 
          onClick={() => setFilters({ source_app: 'All', year: 'All', month: 'All', methode_name: 'All' })}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset Filter
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Source App Filter */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Source App</label>
          <div className="relative group">
            <select 
              value={filters.source_app}
              onChange={(e) => setFilters({ ...filters, source_app: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all appearance-none text-sm font-semibold text-slate-700"
            >
              <option key="all" value="All">Semua App</option>
              {availableOptions.source_apps.map((app: string) => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>

        {/* Year Filter */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tahun</label>
          <div className="relative group">
            <select 
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all appearance-none text-sm font-semibold text-slate-700"
            >
              <option key="all" value="All">Semua Tahun</option>
              {availableOptions.years.map((year: number) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>

        {/* Month Filter */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Bulan</label>
          <div className="relative group">
            <select 
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all appearance-none text-sm font-semibold text-slate-700"
            >
              <option key="all" value="All">Semua Bulan</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>{format(new Date(2024, i, 1), 'MMMM')}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>

        {/* Payment Method Filter */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Metode Pembayaran</label>
          <div className="relative group">
            <select 
              value={filters.methode_name}
              onChange={(e) => setFilters({ ...filters, methode_name: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all appearance-none text-sm font-semibold text-slate-700"
            >
              <option key="all" value="All">Semua Metode</option>
              {availableOptions.methods.map((method: string) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
};

const PriceSuggestion = ({ data, availableOptions }: { data: Transaction[], availableOptions: any }) => {
  const [platform, setPlatform] = useState('');
  const [duration, setDuration] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const filteredHistory = useMemo(() => {
    let base = data;
    if (platform) base = base.filter(d => d.source_app.toUpperCase() === platform.toUpperCase());
    if (duration && !showAllHistory) {
      // Exact match logic as requested
      base = base.filter(d => {
        const name = d.content_name.toLowerCase();
        const search = duration.toLowerCase();
        // Simple heuristic for "same duration": check if the search term is a distinct part of the name
        // or if it matches exactly after some cleaning.
        return name.includes(search);
      });
    }
    return base;
  }, [data, platform, duration, showAllHistory]);

  const stats = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    const prices = filteredHistory.map(d => d.revenue);
    const minPrice = prices.length > 0 ? prices.reduce((a, b) => Math.min(a, b), prices[0]) : 0;
    const maxPrice = prices.length > 0 ? prices.reduce((a, b) => Math.max(a, b), prices[0]) : 0;
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Find most bought price (Mode)
    const priceCounts = prices.reduce((acc: any, p) => {
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    const mostBoughtPrice = Number(Object.keys(priceCounts).reduce((a, b) => priceCounts[a] > priceCounts[b] ? a : b));

    // Distribution at specific levels
    const lowCount = prices.filter(p => p <= minPrice * 1.1).length;
    const avgCount = prices.filter(p => p >= avgPrice * 0.9 && p <= avgPrice * 1.1).length;
    const highCount = prices.filter(p => p >= maxPrice * 0.9).length;

    return { minPrice, maxPrice, avgPrice, mostBoughtPrice, count: prices.length, lowCount, avgCount, highCount };
  }, [filteredHistory]);

  const recommendations = useMemo(() => {
    if (!stats) return null;
    
    // Logic: 
    // App Price (Value) = combination of average and most bought price
    let valuePrice = Math.round(((stats.avgPrice + stats.mostBoughtPrice) / 2) / 1000) * 1000;
    
    // Marketing Price (Campaign) = conversion-oriented derivative (between min and value)
    let campaignPrice = Math.round(((stats.minPrice + valuePrice) / 2.2) / 1000) * 1000;
    
    // Anchor Price (Coret) = derived from max price with psychological adjustment
    let anchorPrice = Math.round((stats.maxPrice * 1.15) / 1000) * 1000;

    // Avoid illogical gaps or conditions
    // 1. Marketing price shouldn't be too far from App price (max 40% gap)
    if (campaignPrice < valuePrice * 0.6) {
      campaignPrice = Math.round((valuePrice * 0.7) / 1000) * 1000;
    }

    // 2. Ensure order: Campaign < Value < Anchor
    if (campaignPrice >= valuePrice) campaignPrice = valuePrice - 5000;
    if (valuePrice >= anchorPrice) anchorPrice = valuePrice + 10000;

    return {
      anchor: anchorPrice,
      value: valuePrice,
      campaign: campaignPrice
    };
  }, [stats]);

  const buyerDistribution = useMemo(() => {
    if (!stats) return [];
    
    // Group into 5 price ranges for distribution
    const step = (stats.maxPrice - stats.minPrice) / 5;
    if (step === 0) return [{ range: formatCurrency(stats.minPrice), count: stats.count }];

    const ranges = Array.from({ length: 5 }, (_, i) => {
      const min = stats.minPrice + (i * step);
      const max = min + step;
      const count = filteredHistory.filter(d => d.revenue >= min && (i === 4 ? d.revenue <= max : d.revenue < max)).length;
      return { range: `${formatCurrency(min)} - ${formatCurrency(max)}`, count };
    });
    return ranges;
  }, [stats, filteredHistory]);

  const historyTableData = useMemo(() => {
    const grouped = filteredHistory.reduce((acc: any, curr) => {
      const key = curr.content_name;
      if (!acc[key]) acc[key] = { name: key, revenue: 0, transactions: 0, prices: [] };
      acc[key].revenue += curr.revenue;
      acc[key].transactions += 1;
      acc[key].prices.push(curr.revenue);
      return acc;
    }, {});

    return Object.values(grouped).map((p: any) => ({
      ...p,
      minPrice: p.prices.length > 0 ? p.prices.reduce((a: number, b: number) => Math.min(a, b), p.prices[0]) : 0,
      maxPrice: p.prices.length > 0 ? p.prices.reduce((a: number, b: number) => Math.max(a, b), p.prices[0]) : 0,
      avgPrice: p.revenue / p.transactions
    })).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [filteredHistory]);

  return (
    <div className="space-y-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <Zap className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Saran Harga Paket</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Rekomendasi harga berbasis histori & distribusi demand pembeli</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Platform</label>
            <select 
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-semibold text-slate-700"
            >
              <option value="">Pilih Platform</option>
              {availableOptions.source_apps.map((app: string) => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Masa Aktif / Durasi (Hari)</label>
            <input 
              type="number"
              placeholder="Misal: 30"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-sm font-semibold text-slate-700"
            />
          </div>
        </div>

        {recommendations ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Harga Coret (Anchor)</p>
              <p className="text-xl font-black text-slate-400 line-through">{formatCurrency(recommendations.anchor)}</p>
              <p className="text-[9px] text-slate-400 mt-1 font-medium">Berdasarkan harga tertinggi historis</p>
              <div className="mt-3 pt-3 border-t border-slate-200/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Demand High</p>
                <p className="text-xs font-black text-slate-500">{stats?.highCount} Pembeli</p>
              </div>
            </div>
            <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 text-center">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Harga Aplikasi (Value)</p>
              <p className="text-2xl font-black text-indigo-600">{formatCurrency(recommendations.value)}</p>
              <p className="text-[9px] text-indigo-400 mt-1 font-medium">Kombinasi rata-rata & demand terbanyak</p>
              <div className="mt-3 pt-3 border-t border-indigo-200/50">
                <p className="text-[10px] font-bold text-indigo-400 uppercase">Demand Avg</p>
                <p className="text-xs font-black text-indigo-600">{stats?.avgCount} Pembeli</p>
              </div>
            </div>
            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-center">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Harga Marketing (Campaign)</p>
              <p className="text-2xl font-black text-emerald-600">{formatCurrency(recommendations.campaign)}</p>
              <p className="text-[9px] text-emerald-400 mt-1 font-medium">Dioptimasi untuk konversi maksimal</p>
              <div className="mt-3 pt-3 border-t border-emerald-200/50">
                <p className="text-[10px] font-bold text-emerald-400 uppercase">Demand Low</p>
                <p className="text-xs font-black text-emerald-600">{stats?.lowCount} Pembeli</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 text-center border-dashed">
            <p className="text-sm font-bold text-slate-400">Pilih platform untuk melihat saran harga berbasis demand.</p>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <Activity className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">History Performa Paket</h3>
            </div>
            <button 
              onClick={() => setShowAllHistory(!showAllHistory)}
              className="px-4 py-2 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              {showAllHistory ? 'Paket Mirip' : 'Semua Paket'}
            </button>
          </div>

          <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="py-4 px-2">Nama</th>
                  <th className="py-4 px-2">Revenue</th>
                  <th className="py-4 px-2">Trx</th>
                  <th className="py-4 px-2 text-emerald-600">Low Price</th>
                  <th className="py-4 px-2 text-emerald-600">Low Trx</th>
                  <th className="py-4 px-2 text-indigo-600">Avg Price</th>
                  <th className="py-4 px-2 text-indigo-600">Avg Trx</th>
                  <th className="py-4 px-2 text-rose-600">High Price</th>
                  <th className="py-4 px-2 text-rose-600">High Trx</th>
                </tr>
              </thead>
              <tbody>
                {historyTableData.map((item, idx) => {
                  const prices = item.prices;
                  const min = item.minPrice;
                  const max = item.maxPrice;
                  const avg = item.avgPrice;
                  
                  const lowDmd = prices.filter((p: number) => p <= min * 1.1).length;
                  const avgDmd = prices.filter((p: number) => p >= avg * 0.9 && p <= avg * 1.1).length;
                  const highDmd = prices.filter((p: number) => p >= max * 0.9).length;

                  return (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all group">
                      <td className="py-4 px-2 text-[10px] font-bold text-slate-700">
                        <div className="max-w-[180px] whitespace-normal break-words line-clamp-5 leading-relaxed" title={item.name}>
                          {item.name}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-[10px] font-black text-indigo-600">{formatCurrency(item.revenue)}</td>
                      <td className="py-4 px-2 text-[10px] text-slate-500">{formatNumber(item.transactions)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-emerald-600 bg-emerald-50/30">{formatCurrency(item.minPrice)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-emerald-600 bg-emerald-50/10">{formatNumber(lowDmd)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-indigo-600 bg-indigo-50/30">{formatCurrency(item.avgPrice)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-indigo-600 bg-indigo-50/10">{formatNumber(avgDmd)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-rose-600 bg-rose-50/30">{formatCurrency(item.maxPrice)}</td>
                      <td className="py-4 px-2 text-[10px] font-black text-rose-600 bg-rose-50/10">{formatNumber(highDmd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {buyerDistribution.length > 0 && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
            <h3 className="text-lg font-black text-slate-900 mb-6">Buyer Distribution</h3>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buyerDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="range" hide />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [val, 'Pembeli']}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {buyerDistribution.map((range, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 truncate max-w-[100px]">{range.range}</span>
                  <span className="text-[10px] font-black text-indigo-600">{range.count} Users</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SocialMediaAnalysis = ({ 
  apps, 
  setActiveTab, 
  setCalendarFocusDate 
}: { 
  apps: AppData[], 
  setActiveTab: (tab: string) => void,
  setCalendarFocusDate: (date: Date) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');

  const allContent = useMemo(() => {
    return apps.flatMap(app => 
      Object.entries(app.dailyData || {}).flatMap(([date, dayData]) => 
        (dayData.socialContent || []).map(content => ({
          ...content,
          date,
          appName: app.name
        }))
      )
    ).sort((a, b) => b.date.localeCompare(a.date));
  }, [apps]);

  const handleDateClick = (dateStr: string) => {
    const date = parse(dateStr, 'yyyy-MM-dd', new Date());
    setCalendarFocusDate(date);
    setActiveTab('calendar');
  };

  const filteredContent = useMemo(() => {
    return allContent.filter(item => {
      const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.caption?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlatform = platformFilter === 'All' || item.platform === platformFilter;
      return matchesSearch && matchesPlatform;
    });
  }, [allContent, searchTerm, platformFilter]);

  const platforms = ['All', ...new Set(allContent.map(item => item.platform))];

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 rounded-xl">
              <Smartphone className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Repository Konten Sosial Media</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Database seluruh konten yang telah diposting</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <Search className="w-4 h-4 text-slate-400 ml-2" />
              <input 
                type="text"
                placeholder="Cari konten..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none px-2 py-1 w-48"
              />
            </div>
            <select 
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-slate-50 border border-slate-100 text-xs font-bold text-slate-600 outline-none px-4 py-2.5 rounded-2xl cursor-pointer"
            >
              {platforms.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 custom-scrollbar">
          <table className="w-full text-left min-w-[1200px] border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                <th className="py-4 px-4 rounded-tl-2xl">Platform</th>
                <th className="py-4 px-4">Tanggal</th>
                <th className="py-4 px-4">Jenis Post</th>
                <th className="py-4 px-4 text-center">Likes</th>
                <th className="py-4 px-4 text-center">Comments</th>
                <th className="py-4 px-4 text-center">Shares</th>
                <th className="py-4 px-4 text-center">ER (%)</th>
                <th className="py-4 px-4">Hook</th>
                <th className="py-4 px-4">CTA</th>
                <th className="py-4 px-4 rounded-tr-2xl text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredContent.map((item, i) => {
                const er = item.reach > 0 ? (item.engagement / item.reach) * 100 : 0;
                return (
                  <tr key={i} className="hover:bg-rose-50/20 transition-colors group">
                    <td className="py-5 px-4">
                      <span className="px-3 py-1 bg-rose-100 text-rose-600 text-[9px] font-black rounded-full uppercase tracking-wider">
                        {item.platform}
                      </span>
                    </td>
                    <td className="py-5 px-4 text-[11px] font-black text-slate-700">
                      {item.date ? format(new Date(item.date), 'dd MMM yyyy') : '-'}
                    </td>
                    <td className="py-5 px-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{item.contentType}</span>
                    </td>
                    <td className="py-5 px-4 text-[11px] font-bold text-slate-700 text-center">
                      {formatNumber(item.likes || 0)}
                    </td>
                    <td className="py-5 px-4 text-[11px] font-bold text-slate-700 text-center">
                      {formatNumber(item.comments || 0)}
                    </td>
                    <td className="py-5 px-4 text-[11px] font-bold text-slate-700 text-center">
                      {formatNumber(item.shares || 0)}
                    </td>
                    <td className="py-5 px-4 text-center">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-1 rounded-lg",
                        er > 5 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
                      )}>
                        {er.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-5 px-4 text-[11px] text-slate-600 max-w-xs truncate">
                      {item.hook || '-'}
                    </td>
                    <td className="py-5 px-4 text-[11px] font-bold text-indigo-600">
                      {item.cta || '-'}
                    </td>
                    <td className="py-5 px-4 text-center">
                      <button 
                        onClick={() => handleDateClick(item.date)}
                        className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-indigo-600 group/btn"
                        title="Lihat di Kalender Paket"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredContent.length === 0 && (
            <div className="py-20 text-center">
              <Smartphone className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tidak ada konten yang ditemukan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const menuItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'Ringkasan Performa' },
    { id: 'optimasi', icon: TrendingUp, label: 'Optimasi Harga' },
    { id: 'target', icon: Target, label: 'Strategi & Target' },
    { id: 'packages', icon: Package, label: 'Performa Produk' },
    { id: 'calendar', icon: Calendar, label: 'Kalender Paket' },
    { id: 'social', icon: MessageSquare, label: 'Analisa Sosial Media' },
  ];

  const accountItems = [
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0 overflow-y-auto">
      <div className="p-8 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 flex items-center justify-center">
            <img 
              src="/maungmarsel.jpeg" 
              alt="Logo" 
              className="w-full h-full object-contain rounded-xl" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight leading-none">SiMarsel<span className="text-indigo-500">.</span></h1>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">PT. Cerebrum Edukanesia</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-8">
        <div>
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Menu Utama</p>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group",
                  activeTab === item.id 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                  {item.label}
                </div>
                {activeTab === item.id && (
                  <motion.div layoutId="activeTab" className="w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Sistem</p>
          <div className="space-y-1">
            {accountItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group",
                  activeTab === item.id 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                  {item.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 mt-auto">
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status Server</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[11px] font-black text-white">Online & Terkoneksi</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const TopBar = () => {
  return (
    <div className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="relative w-96">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input 
          type="text" 
          placeholder="Search Anything" 
          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 flex items-center justify-center">
          <img 
            src="/maungmarsel.jpeg" 
            alt="Logo" 
            className="w-full h-full object-contain rounded-lg" 
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-black text-slate-900 leading-none">SiMarsel</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Dashboard</p>
        </div>
      </div>
    </div>
  );
};

const SettingsSection = ({ onDataUpdate }: { onDataUpdate: (data: Transaction[], downloader: Downloader[], append: boolean) => void }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buf = event.target?.result;
        if (!buf) throw new Error('Failed to read file');
        const workbook = XLSX.read(buf, { type: 'array' });

        let transactions: any[] = [];
        let downloaders: any[] = [];

        workbook.SheetNames.forEach(name => {
          const sheet = workbook.Sheets[name];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          const upper = name.toUpperCase();
          if (upper.includes('TRANSAKSI') || upper.includes('TRX') || upper.includes('PAID')) {
            transactions = jsonData;
          } else if (upper.includes('DOWNLOADER') || upper.includes('DOWNLOAD')) {
            downloaders = jsonData;
          }
        });

        if (transactions.length === 0 && workbook.SheetNames.length > 0) {
          transactions = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        }
        if (downloaders.length === 0 && workbook.SheetNames.length > 1) {
          downloaders = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[1]]);
        }

        onDataUpdate(transactions, downloaders, uploadMode === 'append');
        alert(uploadMode === 'append' ? 'Data berhasil ditambahkan!' : 'Data berhasil diganti!');
      } catch (err) {
        console.error(err);
        alert('Gagal memproses file. Pastikan format Excel benar.');
      } finally {
        setIsUploading(false);
        // Allow re-uploading the same file
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      alert('Gagal mengunggah file.');
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Pengaturan Data</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Kelola data dashboard SiMarsel</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-2xl">
          <button
            onClick={() => setUploadMode('replace')}
            className={cn(
              "p-6 rounded-3xl border-2 transition-all text-left group",
              uploadMode === 'replace' 
                ? "bg-indigo-50/50 border-indigo-600 ring-4 ring-indigo-50" 
                : "bg-white border-slate-100 hover:border-slate-300"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all",
              uploadMode === 'replace' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
            )}>
              <RefreshCw className="w-6 h-6" />
            </div>
            <h4 className={cn("text-sm font-black mb-1", uploadMode === 'replace' ? "text-slate-900" : "text-slate-500")}>Ganti Data Total</h4>
            <p className="text-xs text-slate-400 font-medium tracking-tight">Menghapus data lama dan mengganti dengan file baru secara keseluruhan.</p>
          </button>

          <button
            onClick={() => setUploadMode('append')}
            className={cn(
              "p-6 rounded-3xl border-2 transition-all text-left group",
              uploadMode === 'append' 
                ? "bg-emerald-50/50 border-emerald-500 ring-4 ring-emerald-50" 
                : "bg-white border-slate-100 hover:border-slate-300"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all",
              uploadMode === 'append' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
            )}>
              <Plus className="w-6 h-6" />
            </div>
            <h4 className={cn("text-sm font-black mb-1", uploadMode === 'append' ? "text-slate-900" : "text-slate-500")}>Tambah Data (Merge)</h4>
            <p className="text-xs text-slate-400 font-medium tracking-tight">Menambahkan data baru ke dalam database yang sudah ada saat ini.</p>
          </button>
        </div>

        <div className="max-w-xl">
          <div className={cn(
            "p-12 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-center group transition-all cursor-pointer relative",
            uploadMode === 'replace' ? "hover:border-indigo-300 hover:bg-indigo-50/30 border-slate-200 bg-slate-50/50" : "hover:border-emerald-300 hover:bg-emerald-50/30 border-slate-200 bg-slate-50/50"
          )}>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {isUploading ? <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" /> : (
                uploadMode === 'replace' ? <Download className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" /> : <Plus className="w-8 h-8 text-slate-400 group-hover:text-emerald-500" />
              )}
            </div>
            <h4 className="text-sm font-black text-slate-900 mb-1">
              {isUploading ? 'Memproses File...' : `Klik atau Drag file untuk ${uploadMode === 'replace' ? 'MENGGANTI' : 'MENAMBAH'} Data`}
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              Format: .xlsx atau .xls dengan sheet TRANSAKSI dan DOWNLOADER
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [data, setData] = useState<Transaction[]>([]);
  const [downloaderData, setDownloaderData] = useState<Downloader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    source_app: 'All',
    year: 'All',
    month: 'All',
    methode_name: 'All'
  });

  const APPS_STORAGE_KEY = 'simarsel:apps:v1';
  const SELECTED_APP_STORAGE_KEY = 'simarsel:selectedAppId:v1';

  const [apps, setApps] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(APPS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.warn('Failed to read apps from localStorage:', err);
      }
    }
    return [
      {
        id: '1',
        name: 'App Utama',
        targetConfig: {},       // keyed by YYYY-MM
        dailyData: {},          // keyed by YYYY-MM-DD
        isTargetSet: {},        // keyed by YYYY-MM
      },
    ];
  });
  const [selectedAppId, setSelectedAppId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(SELECTED_APP_STORAGE_KEY);
        if (raw) return raw;
      } catch (err) {
        console.warn('Failed to read selectedAppId from localStorage:', err);
      }
    }
    return '1';
  });

  // Persist apps & selection so refreshes don't wipe operational input.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));
    } catch (err) {
      console.warn('Failed to persist apps to localStorage:', err);
    }
  }, [apps]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SELECTED_APP_STORAGE_KEY, selectedAppId);
    } catch (err) {
      console.warn('Failed to persist selectedAppId to localStorage:', err);
    }
  }, [selectedAppId]);
  const [targetMonth, setTargetMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [calendarFocusDate, setCalendarFocusDate] = useState<Date | null>(null);

  // --- Flexible Charting State ---
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'transactions' | 'downloader' | 'conversion'>('revenue');
  const [chartGranularity, setChartGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [paymentChartMode, setPaymentChartMode] = useState<'revenue' | 'transactions'>('revenue');
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());
  const [drillDownData, setDrillDownData] = useState<any | null>(null);

  // --- Data Loading ---

  const processData = useCallback((rawData: any[]) => {
    return rawData.map(item => {
      let paymentDate: Date;
      const rawDate = item.payment_date || item.transaction_date || item.Tanggal || item.tanggal || item.Date || item.date;
      
      if (typeof rawDate === 'number') {
        paymentDate = excelDateToJSDate(rawDate);
      } else if (rawDate instanceof Date) {
        paymentDate = rawDate;
      } else if (rawDate) {
        paymentDate = new Date(rawDate);
      } else {
        paymentDate = new Date(); // Fallback
      }

      // Ensure valid date
      if (isNaN(paymentDate.getTime())) {
        paymentDate = new Date();
      }

      return {
        ...item,
        source_app: String(item.source_app || '').toUpperCase(),
        parsed_payment_date: paymentDate,
        year: getYear(paymentDate),
        month: getMonth(paymentDate) + 1,
        quarter: getQuarter(paymentDate),
        year_month: format(paymentDate, 'yyyy-MM'),
        hour: paymentDate.getHours(),
        revenue: Number(item.revenue || item.Revenue || item.total_price || 0)
      };
    });
  }, []);

  const processDownloaderData = useCallback((rawData: any[]) => {
    const processed: Downloader[] = [];
    
    rawData.forEach(row => {
      let date: Date;
      // Handle different possible date column names (Tanggal is from the user's screenshot)
      const rawDate = row.Tanggal || row.tanggal || row.date || row.Date;
      
      if (!rawDate) return;

      if (typeof rawDate === 'number') {
        date = excelDateToJSDate(rawDate);
      } else if (rawDate instanceof Date) {
        date = rawDate;
      } else {
        date = new Date(rawDate);
      }

      const year = getYear(date);
      const month = getMonth(date) + 1;
      const year_month = format(date, 'yyyy-MM');

      // Iterate over all keys except the date key and internal XLSX keys
      Object.keys(row).forEach(key => {
        if (['Tanggal', 'tanggal', 'date', 'Date', '__rowNum__'].includes(key)) return;
        
        processed.push({
          date: rawDate,
          source_app: String(key || '').toUpperCase(),
          count: Number(row[key]) || 0,
          parsed_date: date,
          year,
          month,
          year_month
        });
      });
    });
    
    return processed;
  }, []);

  const handleDataUpdate = useCallback((rawTransactions: any[], rawDownloaders: any[], append: boolean = false) => {
    const processedTransactions = processData(rawTransactions);
    const processedDownloaders = processDownloaderData(rawDownloaders);
    
    if (append) {
      setData(prev => [...prev, ...processedTransactions]);
      setDownloaderData(prev => [...prev, ...processedDownloaders]);
    } else {
      setData(processedTransactions);
      setDownloaderData(processedDownloaders);
    }
  }, [processData, processDownloaderData]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

        // Fetch strictly from public/data_paid_clean.xlsx
        const response = await fetch('/data_paid_clean.xlsx');
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetNames = workbook.SheetNames;
          const findSheet = (keywords: string[]) => {
            return sheetNames.find(s => keywords.some(k => s.toLowerCase().includes(k.toLowerCase())));
          };
          
          // Handle sheet "transaksi"
          const transactionSheetName = findSheet(['transaksi', 'trx', 'paid']);
          const transactionSheet = transactionSheetName ? workbook.Sheets[transactionSheetName] : workbook.Sheets[sheetNames[0]];
          const transactionJson = XLSX.utils.sheet_to_json(transactionSheet);
          if (transactionJson && transactionJson.length > 0) {
            setData(processData(transactionJson));
          }

          // Handle sheet "downloader"
          const downloaderSheetName = findSheet(['downloader', 'download']);
          const downloaderSheet = downloaderSheetName ? workbook.Sheets[downloaderSheetName] : null;
          if (downloaderSheet) {
            const downloaderJson = XLSX.utils.sheet_to_json(downloaderSheet);
            setDownloaderData(processDownloaderData(downloaderJson));
          }
          
          setError(null);
          setLoading(false);
          return;
        }

        // Fallback to INITIAL_DATA if fetch fails
        if (INITIAL_DATA && INITIAL_DATA.length > 0) {
          const processed = processData(INITIAL_DATA);
          setData(processed);
          setError(null);
          setLoading(false);
          return;
        }
        
        throw new Error('Database file not found');
      } catch (err) {
        console.warn('Initial data load skipped or failed:', err);
        setError('Silakan unggah file "data_paid_clean.xlsx" untuk memulai.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [processData, processDownloaderData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Failed to read file');
        
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        const findSheet = (keywords: string[]) => {
          return sheetNames.find(s => keywords.some(k => s.toLowerCase().includes(k.toLowerCase())));
        };
        
        // Handle sheet "transaksi"
        const transactionSheetName = findSheet(['transaksi', 'trx', 'paid']);
        const transactionSheet = transactionSheetName ? workbook.Sheets[transactionSheetName] : workbook.Sheets[sheetNames[0]];
        const transactionJson = XLSX.utils.sheet_to_json(transactionSheet);
        if (transactionJson && transactionJson.length > 0) {
          setData(processData(transactionJson));
        }

        // Handle sheet "downloader"
        const downloaderSheetName = findSheet(['downloader', 'download']);
        const downloaderSheet = downloaderSheetName ? workbook.Sheets[downloaderSheetName] : null;
        if (downloaderSheet) {
          const downloaderJson = XLSX.utils.sheet_to_json(downloaderSheet);
          setDownloaderData(processDownloaderData(downloaderJson));
        }

        setError(null);
      } catch (err) {
        console.error('Error parsing uploaded file:', err);
        setError('Gagal membaca file. Pastikan format file Excel benar.');
      }
    };
    reader.onerror = () => {
      setError('Gagal mengunggah file.');
    };
    reader.readAsArrayBuffer(file);
  };

  // --- Filtered Data & Analytics ---

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchApp = filters.source_app === 'All' || item.source_app === filters.source_app;
      const matchYear = filters.year === 'All' || item.year === Number(filters.year);
      const matchMonth = filters.month === 'All' || item.month === Number(filters.month);
      const matchMethod = filters.methode_name === 'All' || item.methode_name === filters.methode_name;
      return matchApp && matchYear && matchMonth && matchMethod;
    });
  }, [data, filters]);

  const filteredDownloaderData = useMemo(() => {
    return downloaderData.filter(item => {
      const matchApp = filters.source_app === 'All' || item.source_app === filters.source_app;
      const matchYear = filters.year === 'All' || item.year === Number(filters.year);
      const matchMonth = filters.month === 'All' || item.month === Number(filters.month);
      return matchApp && matchYear && matchMonth;
    });
  }, [downloaderData, filters]);

  const availableOptions = useMemo(() => {
    const allApps = data.map(d => d.source_app).concat(downloaderData.map(d => d.source_app));
    const allYears = data.map(d => d.year).concat(downloaderData.map(d => d.year));
    
    return {
      source_apps: Array.from(new Set(allApps.filter(Boolean))).sort(),
      years: Array.from(new Set(allYears.filter(y => y !== null && y !== undefined))).sort((a: number, b: number) => b - a),
      methods: Array.from(new Set(data.map(d => d.methode_name).filter(Boolean))).sort()
    };
  }, [data, downloaderData]);

  const appColors = useMemo(() => {
    const colors: Record<string, string> = {};
    availableOptions.source_apps.forEach((app, index) => {
      colors[app] = COLORS[index % COLORS.length];
    });
    return colors;
  }, [availableOptions.source_apps]);

  const stats: DashboardStats = useMemo(() => {
    const isMonthFiltered = filters.month !== 'All';
    const isYearFiltered = filters.year !== 'All';
    const monthKey = isYearFiltered && isMonthFiltered ? `${filters.year}-${filters.month.padStart(2, '0')}` : null;

    const totalRealSales = filteredData.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = filteredData.length;
    const uniqueBuyers = new Set(filteredData.map(item => item.email || item.phone || item.full_name || item.trx_id).filter(Boolean)).size;
    const totalRealDownloader = filteredDownloaderData.reduce((sum, d) => sum + d.count, 0);

    // Repeat Order calculation based on ALL available data
    const emailCountsInAllData = data.reduce((acc, curr) => {
      if (curr.email) {
        acc[curr.email] = (acc[curr.email] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Count how many unique users in the filtered result have >= 2 purchases in the whole dataset
    const repeatOrderUsersInFilteredData = new Set(
      filteredData
        .filter(item => item.email && emailCountsInAllData[item.email] >= 2)
        .map(item => item.email)
    ).size;

    // Filter apps based on source_app filter
    const relevantApps = filters.source_app === 'All' 
      ? apps 
      : apps.filter(app => app.name.toUpperCase() === filters.source_app.toUpperCase());

    let totalTargetRevenue = 0;
    let totalTargetDownloader = 0;
    let totalTargetRepeatOrder = 0;
    let totalRealRepeatOrderFromApps = 0; // Legacy mapping
    let totalHutangSales = 0;

    relevantApps.forEach(app => {
      // If month is filtered, get target for that month
      if (monthKey) {
        const target = app.targetConfig?.[monthKey];
        if (target) {
          totalTargetRevenue += target.targetSales || 0;
          totalTargetDownloader += target.targetDownloader || 0;
          totalTargetRepeatOrder += target.targetRepeatOrder || 0;
        }

        // Calculate real and hutang from dailyData
        const dailyData = app.dailyData || {};
        const monthDates = Object.keys(dailyData).filter(date => date.startsWith(monthKey)).sort();
        
        let appRealSales = 0;
        monthDates.forEach(date => {
          totalRealRepeatOrderFromApps += Number(dailyData[date].actualRepeatOrder) || 0;
          appRealSales += Number(dailyData[date].actualSales) || 0;
        });

        if (target) {
          const lastFilledIdx = monthDates.reduce((acc, d, i) => {
            const data = dailyData[d];
            const hasData = data && (
              (data.actualSales !== undefined && data.actualSales !== null && data.actualSales !== 0) ||
              (data.actualDownloader !== undefined && data.actualDownloader !== null && data.actualDownloader !== 0) ||
              (data.actualRepeatOrder !== undefined && data.actualRepeatOrder !== null && data.actualRepeatOrder !== 0)
            );
            return hasData ? i : acc;
          }, -1);

          // Use actual day count of the target month (28/29/30/31), not magic 30.
          const [ymY, ymM] = monthKey.split('-').map(Number);
          const daysInTargetMonth = new Date(ymY, ymM, 0).getDate();
          const baseDailySales = target.targetSales / Math.max(1, daysInTargetMonth);
          const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
          totalHutangSales += Math.max(0, expectedSalesSoFar - appRealSales);
        }
      } else {
        Object.keys(app.targetConfig || {}).forEach(m => {
          if (!isYearFiltered || m.startsWith(filters.year)) {
            const target = app.targetConfig[m];
            totalTargetRevenue += target.targetSales || 0;
            totalTargetDownloader += target.targetDownloader || 0;
            totalTargetRepeatOrder += target.targetRepeatOrder || 0;
          }
        });

        Object.keys(app.dailyData || {}).forEach(date => {
          if (!isYearFiltered || date.startsWith(filters.year)) {
            totalRealRepeatOrderFromApps += Number(app.dailyData[date].actualRepeatOrder) || 0;
          }
        });
      }
    });

    const progressDownloader = totalTargetDownloader > 0 ? (totalRealDownloader / totalTargetDownloader) * 100 : 0;
    const progressSales = totalTargetRevenue > 0 ? (totalRealSales / totalTargetRevenue) * 100 : 0;
    // For conversion, we might still use the app metrics or the transaction calculation. 
    // Let's use the transaction calculation for 'Real Repeat Order' vs downloader.
    const progressConversion = totalRealDownloader > 0 ? (repeatOrderUsersInFilteredData / totalRealDownloader) * 100 : 0;

    return {
      totalRevenue: totalRealSales,
      totalTransactions,
      aov: totalTransactions > 0 ? totalRealSales / totalTransactions : 0,
      uniqueBuyers,
      totalPackagesSold: totalTransactions,
      totalTargetRevenue,
      totalTargetDownloader,
      totalTargetRepeatOrder,
      progressDownloader,
      progressSales,
      progressConversion,
      hutangSales: totalHutangSales,
      totalRealDownloader,
      totalRealSales,
      totalRepeatOrderUsers: repeatOrderUsersInFilteredData
    };
  }, [filteredData, filteredDownloaderData, apps, filters, data]);

  // --- Chart Data Preparation ---

  const trendData = useMemo(() => {
    const grouped: Record<string, TrendItem> = {};
    
    const getGroupKey = (date: Date) => {
      if (chartGranularity === 'daily') return format(date, 'yyyy-MM-dd');
      if (chartGranularity === 'weekly') return `${format(date, 'yyyy')}-W${format(date, 'ww')}`;
      return format(date, 'yyyy-MM');
    };

    const getDisplayName = (key: string) => {
      try {
        if (chartGranularity === 'daily') return format(parseISO(key), 'dd MMM');
        if (chartGranularity === 'weekly') return key;
        return format(parseISO(key + '-01'), 'MMM yy');
      } catch (e) {
        return key;
      }
    };

    filteredData.forEach(item => {
      const key = getGroupKey(item.parsed_payment_date);
      if (!grouped[key]) {
        grouped[key] = { 
          name: getDisplayName(key), 
          revenue: 0, 
          transactions: 0, 
          downloader: 0, 
          conversion: 0, 
          rawDate: item.parsed_payment_date,
          appBreakdown: {}
        };
      }
      const app = item.source_app;
      if (!grouped[key].appBreakdown![app]) {
        grouped[key].appBreakdown![app] = { revenue: 0, transactions: 0, downloader: 0 };
      }
      grouped[key].revenue += item.revenue;
      grouped[key].transactions += 1;
      grouped[key].appBreakdown![app].revenue += item.revenue;
      grouped[key].appBreakdown![app].transactions += 1;
    });

    filteredDownloaderData.forEach(item => {
      const key = getGroupKey(item.parsed_date);
      if (!grouped[key]) {
        grouped[key] = { 
          name: getDisplayName(key), 
          revenue: 0, 
          transactions: 0, 
          downloader: 0, 
          conversion: 0, 
          rawDate: item.parsed_date,
          appBreakdown: {}
        };
      }
      const app = item.source_app;
      if (!grouped[key].appBreakdown![app]) {
        grouped[key].appBreakdown![app] = { revenue: 0, transactions: 0, downloader: 0 };
      }
      grouped[key].downloader += item.count;
      grouped[key].appBreakdown![app].downloader += item.count;
    });

    return Object.values(grouped).map(item => {
      const conversion = item.downloader > 0 ? (item.transactions / item.downloader) * 100 : 0;
      const dynamicProps: any = {};
      if (item.appBreakdown) {
        Object.entries(item.appBreakdown).forEach(([app, vals]) => {
          if (!hiddenApps.has(app)) {
            dynamicProps[`revenue_${app}`] = vals.revenue;
            dynamicProps[`transactions_${app}`] = vals.transactions;
            dynamicProps[`downloader_${app}`] = vals.downloader;
            dynamicProps[`conversion_${app}`] = vals.downloader > 0 ? (vals.transactions / vals.downloader) * 100 : 0;
          }
        });
      }
      return { ...item, conversion, ...dynamicProps };
    }).sort((a: any, b: any) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [filteredData, filteredDownloaderData, chartGranularity, hiddenApps]);

  const packagePerformanceData = useMemo(() => {
    const grouped = filteredData.reduce((acc: any, item) => {
      const key = item.content_name;
      const date = item.parsed_payment_date;
      if (!acc[key]) acc[key] = { 
        name: key, 
        revenue: 0, 
        transactions: 0, 
        buyers: new Set(),
        prices: [],
        minDate: date,
        maxDate: date
      };
      acc[key].revenue += item.revenue;
      acc[key].transactions += 1;
      const buyerId = item.email || item.phone || item.full_name || item.trx_id;
      if (buyerId) acc[key].buyers.add(buyerId);
      acc[key].prices.push(item.revenue);
      
      if (date < acc[key].minDate) acc[key].minDate = date;
      if (date > acc[key].maxDate) acc[key].maxDate = date;
      
      return acc;
    }, {});

    const totalRevenue = filteredData.reduce((sum, item) => sum + item.revenue, 0);

    return Object.values(grouped).map((item: any) => {
      const uniqueUsers = item.buyers.size;
      // AOV (Average Order Value) = Total Revenue / Total Transactions
      const aov = item.transactions > 0 ? item.revenue / item.transactions : 0;
      // ARPPU (Average Revenue Per Paying User) = Total Revenue / Unique Paying Users
      const arppu = uniqueUsers > 0 ? item.revenue / uniqueUsers : 0;
      
      const minPrice = item.prices.length > 0 ? item.prices.reduce((a: number, b: number) => Math.min(a, b), item.prices[0]) : 0;
      const maxPrice = item.prices.length > 0 ? item.prices.reduce((a: number, b: number) => Math.max(a, b), item.prices[0]) : 0;
      const avgPrice = item.prices.length > 0 ? item.prices.reduce((a: number, b: number) => a + b, 0) / item.prices.length : 0;
      
      const lowTrx = item.prices.filter((p: number) => p === minPrice).length;
      const highTrx = item.prices.filter((p: number) => p === maxPrice).length;
      const avgTrx = item.transactions;

      const durationDays = Math.max(1, Math.ceil((item.maxDate.getTime() - item.minDate.getTime()) / (1000 * 60 * 60 * 24)));
      let durationLabel = `${durationDays} Hari`;
      if (durationDays >= 365) {
        durationLabel = `${(durationDays / 365).toFixed(1)} Tahun`;
      } else if (durationDays >= 30) {
        durationLabel = `${(durationDays / 30).toFixed(1)} Bulan`;
      }

      return {
        ...item,
        uniqueUsers,
        aov,
        arppu,
        minPrice,
        avgPrice,
        maxPrice,
        lowTrx,
        highTrx,
        avgTrx,
        startDate: format(item.minDate, 'dd MMM yyyy'),
        endDate: format(item.maxDate, 'dd MMM yyyy'),
        durationDays,
        durationLabel
      };
    }).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [filteredData]);

  const methodData = useMemo(() => {
    const grouped = filteredData.reduce((acc: any, item) => {
      const key = item.methode_name;
      if (!acc[key]) acc[key] = { name: key, revenue: 0, transactions: 0 };
      acc[key].revenue += item.revenue;
      acc[key].transactions += 1;
      return acc;
    }, {});
    // Sort by transactions as requested
    return Object.values(grouped).sort((a: any, b: any) => b.transactions - a.transactions);
  }, [filteredData]);

  const [pricingMode, setPricingMode] = useState<'yearly' | 'monthly'>('yearly');
  const [pricingBreakdownByApp, setPricingBreakdownByApp] = useState(false);

  const pricingComparisonData = useMemo(() => {
    // Respect non-time filters for comparison
    const comparisonFilteredData = data.filter(item => {
      const matchApp = filters.source_app === 'All' || item.source_app === filters.source_app;
      const matchMethod = filters.methode_name === 'All' || item.methode_name === filters.methode_name;
      return matchApp && matchMethod;
    });

    // Step 1: Group by Month and App to get sub-period metrics
    const subPeriodGroups = comparisonFilteredData.reduce((acc: any, item) => {
      const subKey = `${item.year_month}_${item.source_app}`;
      if (!acc[subKey]) acc[subKey] = { 
        year_month: item.year_month,
        year: item.year,
        app: item.source_app,
        revenue: 0, 
        transactions: 0, 
        buyers: new Set()
      };
      acc[subKey].revenue += item.revenue;
      acc[subKey].transactions += 1;
      const buyerId = item.email || item.phone || item.full_name || item.trx_id;
      if (buyerId) acc[subKey].buyers.add(buyerId);
      return acc;
    }, {});

    const subPeriodMetrics = Object.values(subPeriodGroups).map((item: any) => ({
      ...item,
      aov: item.revenue / (item.transactions || 1),
      arppu: item.revenue / (item.buyers.size || 1)
    }));

    // Step 2: Group for the table display (Yearly or Monthly)
    const grouped = comparisonFilteredData.reduce((acc: any, item) => {
      const timeKey = pricingMode === 'yearly' ? item.year : item.year_month;
      const key = pricingBreakdownByApp ? `${timeKey}_${item.source_app}` : timeKey;
      
      if (!acc[key]) acc[key] = { 
        label: timeKey, 
        app: item.source_app,
        revenue: 0, 
        transactions: 0, 
        buyers: new Set(),
        prices: [] 
      };
      acc[key].revenue += item.revenue;
      acc[key].transactions += 1;
      const buyerId = item.email || item.phone || item.full_name || item.trx_id;
      if (buyerId) acc[key].buyers.add(buyerId);
      acc[key].prices.push(item.revenue);
      return acc;
    }, {});

    return Object.values(grouped).map((item: any) => {
      const uniqueUsers = item.buyers.size;
      const aov = item.revenue / (item.transactions || 1);
      const arppu = uniqueUsers > 0 ? item.revenue / uniqueUsers : 0;
      
      // Calculate Average AOV/ARPPU from sub-periods (rata-rata dari metrik sub-periode)
      const relevantSubPeriods = subPeriodMetrics.filter((sub: any) => {
        const timeMatch = pricingMode === 'yearly' ? sub.year === item.label : sub.year_month === item.label;
        const appMatch = !pricingBreakdownByApp || sub.app === item.app;
        return timeMatch && appMatch;
      });

      const avgAov = relevantSubPeriods.length > 0 
        ? relevantSubPeriods.reduce((sum, sub) => sum + sub.aov, 0) / relevantSubPeriods.length 
        : aov;
      const avgArppu = relevantSubPeriods.length > 0 
        ? relevantSubPeriods.reduce((sum, sub) => sum + sub.arppu, 0) / relevantSubPeriods.length 
        : arppu;

      const sortedPrices = item.prices.slice().sort((a: number, b: number) => a - b);
      const minPrice = item.prices.length > 0 ? item.prices.reduce((a: number, b: number) => Math.min(a, b)) : 0;
      const maxPrice = item.prices.length > 0 ? item.prices.reduce((a: number, b: number) => Math.max(a, b)) : 0;
      const avgPrice = item.revenue / (item.transactions || 1);

      const benchmarkPrice = sortedPrices[Math.floor(sortedPrices.length * 0.5)] || 0;
      const lowRec = sortedPrices[Math.floor(sortedPrices.length * 0.25)] || 0;
      const midRec = benchmarkPrice;
      const highRec = sortedPrices[Math.floor(sortedPrices.length * 0.75)] || 0;

      return {
        ...item,
        uniqueUsers,
        aov,
        arppu,
        avgAov,
        avgArppu,
        minPrice,
        maxPrice,
        avgPrice,
        benchmarkPrice,
        lowRec,
        midRec,
        highRec
      };
    }).sort((a: any, b: any) => b.label.toString().localeCompare(a.label.toString()));
  }, [data, pricingMode, pricingBreakdownByApp, filters.source_app, filters.methode_name]);

  // --- Pagination State ---
  const [packagePage, setPackagePage] = useState(1);
  const itemsPerPage = 10;

  const paginatedPackages = useMemo(() => {
    const startIndex = (packagePage - 1) * itemsPerPage;
    return packagePerformanceData.slice(startIndex, startIndex + itemsPerPage);
  }, [packagePerformanceData, packagePage]);

  const totalPackagePages = Math.ceil(packagePerformanceData.length / itemsPerPage);

  useEffect(() => {
    setPackagePage(1);
  }, [packagePerformanceData]);

  // --- Render Helpers ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mb-4"
        />
        <p className="text-slate-600 font-medium animate-pulse">Loading dashboard data...</p>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-16 rounded-[4rem] shadow-[0_40px_100px_rgba(0,0,0,0.08)] border border-slate-100 max-w-2xl w-full text-center relative z-10"
        >
          <div className="w-32 h-32 mx-auto mb-10 flex items-center justify-center">
            <img 
              src="/maungmarsel.jpeg" 
              alt="SiMarsel Logo" 
              className="w-full h-full object-contain drop-shadow-2xl rounded-3xl" 
              referrerPolicy="no-referrer"
            />
          </div>
          
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Selamat Datang di SiMarsel<span className="text-indigo-600">.</span></h2>
          <p className="text-slate-500 mb-12 leading-relaxed font-medium text-lg">
            Sistem sedang menunggu data untuk inisialisasi dashboard Anda. <br/>
            Silakan unggah file database untuk memulai analisa performa.
          </p>

          <div className="bg-slate-50/80 backdrop-blur-sm p-10 rounded-[3rem] border-2 border-dashed border-slate-200 group hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
            <label className="block w-full cursor-pointer">
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Download className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-black text-slate-900 uppercase tracking-widest">Unggah Database</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Format: .xlsx atau .xls (Sheet: TRANSAKSI & DOWNLOADER)</p>
                </div>
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="px-12 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95">
                  Pilih File Dari Komputer
                </div>
              </div>
            </label>
          </div>

          <div className="mt-12 flex items-center justify-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>Ready for initialization</span>
          </div>
        </motion.div>
        
        <p className="mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">PT. Cerebrum Edukanesia Nusantara</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <main className="p-8 max-w-[1600px] mx-auto w-full">
        {/* Dynamic Content Based on Tabs */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <FilterSection 
                filters={filters} 
                setFilters={setFilters} 
                availableOptions={availableOptions} 
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 rounded-xl">
                      <DollarSign className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Revenue</p>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{formatCurrency(stats.totalRevenue)}</h3>
                  <p className="text-[9px] text-slate-400 font-medium mt-1">Pendapatan kotor</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-50 rounded-xl">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Transaksi</p>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{formatNumber(stats.totalTransactions)}</h3>
                  <p className="text-[9px] text-slate-400 font-medium mt-1">Volume penjualan</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-violet-50 rounded-xl">
                      <Users className="w-4 h-4 text-violet-600" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unique Buyers</p>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{formatNumber(stats.uniqueBuyers)}</h3>
                  <p className="text-[9px] text-slate-400 font-medium mt-1">Pelanggan unik</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-50 rounded-xl">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AOV</p>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{formatCurrency(stats.aov)}</h3>
                  <p className="text-[9px] text-slate-400 font-medium mt-1">Rata-rata transaksi</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-50 rounded-xl">
                      <Download className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Downloader</p>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{formatNumber(stats.totalRealDownloader)}</h3>
                  <p className="text-[9px] text-slate-400 font-medium mt-1">Total unduhan real</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-rose-50 rounded-xl">
                      <UserCheck className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Repeat Order</p>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{formatNumber(stats.totalRepeatOrderUsers)}</h3>
                  <p className="text-[9px] text-slate-400 font-medium mt-1">Pembelian {'>'} 2x (By Email)</p>
                </div>
              </div>

              {/* Analisa Tren Section */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Analisa Tren & Performa</h3>
                    <p className="text-sm text-slate-400 font-medium mt-1">Visualisasi data multi-app dengan kontrol fleksibel</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Metric Selector */}
                    <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
                      {(['revenue', 'transactions', 'downloader', 'conversion'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setChartMetric(m)}
                          className={cn(
                            "px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                            chartMetric === m ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {/* Chart Type Selector */}
                    <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
                      {(['bar', 'line', 'area', 'pie'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setChartType(t)}
                          className={cn(
                            "px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                            chartType === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {/* Granularity Selector */}
                    <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
                      {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setChartGranularity(g)}
                          className={cn(
                            "px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest",
                            chartGranularity === g ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="h-[500px] mb-8">
                  <FlexibleChart 
                    data={trendData} 
                    type={chartType} 
                    metric={chartMetric} 
                    appColors={appColors}
                    onDrillDown={setDrillDownData}
                    hiddenApps={hiddenApps}
                  />
                </div>

                {/* Interactive Legend */}
                <div className="flex flex-wrap items-center justify-center gap-6 pt-8 border-t border-slate-50">
                  {Object.entries(appColors).map(([app, color]) => (
                    <button
                      key={app}
                      onClick={() => {
                        const newHidden = new Set(hiddenApps);
                        if (newHidden.has(app)) newHidden.delete(app);
                        else newHidden.add(app);
                        setHiddenApps(newHidden);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
                        hiddenApps.has(app) 
                          ? "bg-slate-50 border-slate-100 grayscale opacity-50" 
                          : "bg-white border-slate-100 hover:border-indigo-200 shadow-sm"
                      )}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{app}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method & Hourly Distribution Pie Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">Metode Pembayaran</h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">Distribusi berdasarkan {paymentChartMode === 'revenue' ? 'pendapatan' : 'jumlah transaksi'}</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button 
                        onClick={() => setPaymentChartMode('revenue')}
                        className={cn(
                          "px-4 py-1.5 text-[10px] font-black rounded-lg transition-all",
                          paymentChartMode === 'revenue' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                        )}
                      >
                        REVENUE
                      </button>
                      <button 
                        onClick={() => setPaymentChartMode('transactions')}
                        className={cn(
                          "px-4 py-1.5 text-[10px] font-black rounded-lg transition-all",
                          paymentChartMode === 'transactions' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                        )}
                      >
                        TRANSAKSI
                      </button>
                    </div>
                  </div>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.values(filteredData.reduce((acc: any, curr) => {
                            const method = curr.methode_name || 'Unknown';
                            if (!acc[method]) acc[method] = { name: method, value: 0 };
                            acc[method].value += paymentChartMode === 'revenue' ? curr.revenue : 1;
                            return acc;
                          }, {})).sort((a: any, b: any) => b.value - a.value)}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => paymentChartMode === 'revenue' ? formatCurrency(value) : formatNumber(value)} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">Waktu Pembelian (Jam)</h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">Distribusi transaksi berdasarkan jam</p>
                    </div>
                    <div className="p-2.5 bg-indigo-50 rounded-xl">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.values(filteredData.reduce((acc: any, curr) => {
                            const hour = curr.hour;
                            let label = '';
                            if (hour >= 0 && hour < 6) label = 'Dini Hari (00-06)';
                            else if (hour >= 6 && hour < 12) label = 'Pagi (06-12)';
                            else if (hour >= 12 && hour < 18) label = 'Siang/Sore (12-18)';
                            else label = 'Malam (18-00)';
                            
                            if (!acc[label]) acc[label] = { name: label, value: 0 };
                            acc[label].value += 1;
                            return acc;
                          }, {})).sort((a: any, b: any) => b.value - a.value)}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${formatNumber(value)} Transaksi`} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'optimasi' && (
            <motion.div 
              key="optimasi"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
              <PriceSuggestion data={data} availableOptions={availableOptions} />
              
              <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Perbandingan Harga & Performa</h3>
                    <p className="text-sm text-slate-400 font-medium mt-1.5">Analisis benchmark dan rekomendasi harga strategis lintas periode</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <button 
                      onClick={() => setPricingBreakdownByApp(!pricingBreakdownByApp)}
                      className={cn(
                        "px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300 border",
                        pricingBreakdownByApp 
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                          : "bg-white text-slate-400 border-slate-100 hover:border-indigo-200 hover:text-slate-600"
                      )}
                    >
                      {pricingBreakdownByApp ? 'Sembunyikan Aplikasi' : 'Lihat Per Aplikasi'}
                    </button>
                    <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
                      <button 
                        onClick={() => setPricingMode('yearly')}
                        className={cn(
                          "px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300",
                          pricingMode === 'yearly' ? "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 translate-y-0" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        Tahunan
                      </button>
                      <button 
                        onClick={() => setPricingMode('monthly')}
                        className={cn(
                          "px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300",
                          pricingMode === 'monthly' ? "bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 translate-y-0" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        Bulanan
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-4 px-4 custom-scrollbar">
                  <table className="w-full text-left min-w-[1300px]">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                        <th className="pb-6 px-4">{pricingMode === 'yearly' ? 'Tahun' : 'Bulan'}</th>
                        {pricingBreakdownByApp && <th className="pb-6 px-4">Aplikasi</th>}
                        <th className="pb-6">Total Revenue</th>
                        <th className="pb-6">Paying Users</th>
                        <th className="pb-6">Min Price</th>
                        <th className="pb-6">Avg Price</th>
                        <th className="pb-6">Max Price</th>
                        <th className="pb-6">AOV</th>
                        <th className="pb-6">ARPPU</th>
                        <th className="pb-6">Avg AOV</th>
                        <th className="pb-6">Avg ARPPU</th>
                        <th className="pb-6">Benchmark Price</th>
                        <th className="pb-6 text-emerald-600">Rec. Low</th>
                        <th className="pb-6 text-indigo-600">Rec. Mid</th>
                        <th className="pb-6 text-rose-600">Rec. High</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pricingComparisonData.map((item) => (
                        <tr key={`${item.label}-${item.app}`} className="group hover:bg-slate-50/50 transition-all duration-200">
                          <td className="py-6 px-4 font-black text-slate-900 text-sm">{item.label}</td>
                          {pricingBreakdownByApp && <td className="py-6 px-4 text-slate-500 text-sm font-bold">{item.app}</td>}
                          <td className="py-6 font-bold text-slate-700 text-sm">{formatCurrency(item.revenue)}</td>
                          <td className="py-6 text-slate-500 text-sm font-medium">{formatNumber(item.uniqueUsers)}</td>
                          <td className="py-6 text-emerald-600 font-bold text-sm">{formatCurrency(item.minPrice)}</td>
                          <td className="py-6 text-slate-500 text-sm font-medium">{formatCurrency(item.avgPrice)}</td>
                          <td className="py-6 text-rose-600 font-bold text-sm">{formatCurrency(item.maxPrice)}</td>
                          <td className="py-6 text-slate-500 text-sm font-medium">{formatCurrency(item.aov)}</td>
                          <td className="py-6 text-slate-500 text-sm font-medium">{formatCurrency(item.arppu)}</td>
                          <td className="py-6 text-slate-400 text-xs italic">{formatCurrency(item.avgAov)}</td>
                          <td className="py-6 text-slate-400 text-xs italic">{formatCurrency(item.avgArppu)}</td>
                          <td className="py-6 font-bold text-indigo-600 text-sm">{formatCurrency(item.benchmarkPrice)}</td>
                          <td className="py-6 text-emerald-600 font-black text-sm">{formatCurrency(item.lowRec)}</td>
                          <td className="py-6 text-indigo-600 font-black text-sm">{formatCurrency(item.midRec)}</td>
                          <td className="py-6 text-rose-600 font-black text-sm">{formatCurrency(item.highRec)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'social' && (
            <motion.div 
              key="social"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <SocialMediaAnalysis 
                apps={apps} 
                setActiveTab={setActiveTab}
                setCalendarFocusDate={setCalendarFocusDate}
              />
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div 
              key="calendar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PackageCalendar 
                data={data} 
                downloaderData={downloaderData}
                availableOptions={availableOptions} 
                apps={apps} 
                focusDate={calendarFocusDate} 
              />
            </motion.div>
          )}

          {activeTab === 'target' && (
            <motion.div 
              key="target"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <TargetSection 
                apps={apps} 
                setApps={setApps} 
                selectedAppId={selectedAppId} 
                setSelectedAppId={setSelectedAppId} 
                filters={filters}
                data={data}
                downloaderData={downloaderData}
                targetMonth={targetMonth}
                setTargetMonth={setTargetMonth}
                setActiveTab={setActiveTab}
                setCalendarFocusDate={setCalendarFocusDate}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <SettingsSection onDataUpdate={handleDataUpdate} />
            </motion.div>
          )}

          {activeTab === 'packages' && (
            <motion.div 
              key="packages"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <FilterSection 
                filters={filters} 
                setFilters={setFilters} 
                availableOptions={availableOptions} 
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <h3 className="text-lg font-bold mb-8 text-slate-900">Top Paket (Pendapatan)</h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={packagePerformanceData.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" hide />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                          tickFormatter={(val) => `Rp${val >= 1000000 ? (val/1000000).toFixed(0) + 'jt' : val}`} 
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                          formatter={(val: number) => [formatCurrency(val), 'Pendapatan']} 
                        />
                        <Bar dataKey="revenue" fill="#8b5cf6" radius={[10, 10, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <h3 className="text-lg font-bold mb-8 text-slate-900">Top Paket (Volume)</h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={packagePerformanceData.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" hide />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                          formatter={(val: number) => [formatNumber(val), 'Transaksi']}
                        />
                        <Bar dataKey="transactions" fill="#ec4899" radius={[10, 10, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <h3 className="text-xl font-black mb-10 text-slate-900 tracking-tight">Detail Performa Paket</h3>
                <div className="overflow-x-auto -mx-4 px-4 custom-scrollbar">
                  <table className="w-full text-left min-w-[1600px] border-separate border-spacing-0">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                        <th className="pb-6 px-4 sticky left-0 bg-white z-10 border-b border-slate-100">Nama Paket</th>
                        <th className="pb-6 px-4 border-b border-slate-100">Revenue</th>
                        <th className="pb-6 px-4 border-b border-slate-100">Trx</th>
                        <th className="pb-6 px-4 border-b border-slate-100">Low Price</th>
                        <th className="pb-6 px-4 border-b border-slate-100">Low Trx</th>
                        <th className="pb-6 px-4 border-b border-slate-100">Avg Price</th>
                        <th className="pb-6 px-4 border-b border-slate-100">Avg Trx</th>
                        <th className="pb-6 px-4 border-b border-slate-100">High Price</th>
                        <th className="pb-6 px-4 border-b border-slate-100">High Trx</th>
                        <th className="pb-6 px-4 border-b border-slate-100">Durasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedPackages.map((pkg) => (
                        <tr key={pkg.name} className="group hover:bg-slate-50/50 transition-all duration-200">
                          <td className="py-6 px-4 font-bold text-slate-700 text-sm sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <div className="max-w-[250px] whitespace-normal break-words line-clamp-4 leading-tight" title={pkg.name}>
                              {pkg.name}
                            </div>
                          </td>
                          <td className="py-6 px-4 font-black text-slate-900 text-sm">{formatCurrency(pkg.revenue)}</td>
                          <td className="py-6 px-4 text-slate-500 text-sm font-bold">{formatNumber(pkg.transactions)}</td>
                          <td className="py-6 px-4 text-emerald-600 font-bold text-sm">{formatCurrency(pkg.minPrice)}</td>
                          <td className="py-6 px-4 text-emerald-500 text-xs font-bold">{formatNumber(pkg.lowTrx)}</td>
                          <td className="py-6 px-4 text-slate-500 text-sm font-medium">{formatCurrency(pkg.avgPrice)}</td>
                          <td className="py-6 px-4 text-slate-400 text-xs font-bold">{formatNumber(pkg.avgTrx)}</td>
                          <td className="py-6 px-4 text-rose-600 font-bold text-sm">{formatCurrency(pkg.maxPrice)}</td>
                          <td className="py-6 px-4 text-rose-500 text-xs font-bold">{formatNumber(pkg.highTrx)}</td>
                          <td className="py-6 px-4 text-slate-500 text-sm font-medium">{pkg.durationLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-10 pt-6 border-t border-slate-100 gap-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    Showing {((packagePage - 1) * itemsPerPage) + 1} to {Math.min(packagePage * itemsPerPage, packagePerformanceData.length)} of {packagePerformanceData.length} packages
                  </p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPackagePage(p => Math.max(1, p - 1))}
                      disabled={packagePage === 1}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronDown className="w-5 h-5 rotate-90" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: Math.min(5, totalPackagePages) }, (_, i) => {
                        let pageNum = packagePage;
                        if (packagePage <= 3) pageNum = i + 1;
                        else if (packagePage >= totalPackagePages - 2) pageNum = totalPackagePages - 4 + i;
                        else pageNum = packagePage - 2 + i;
                        
                        if (pageNum <= 0 || pageNum > totalPackagePages) return null;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPackagePage(pageNum)}
                            className={cn(
                              "w-10 h-10 text-[11px] font-black rounded-xl transition-all",
                              packagePage === pageNum 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button 
                      onClick={() => setPackagePage(p => Math.min(totalPackagePages, p + 1))}
                      disabled={packagePage === totalPackagePages}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <DrillDownModal 
        isOpen={!!drillDownData} 
        onClose={() => setDrillDownData(null)} 
        data={drillDownData} 
        metric={chartMetric}
        appColors={appColors}
      />

      {/* Footer */}
      <footer className="max-w-[1600px] mx-auto p-12 text-center border-t border-slate-100 mt-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
            <TrendingUp className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]"> Dashboard analytic marketing & sales </p>
        </div>
      </footer>
    </div>
  </div>
  );
}
