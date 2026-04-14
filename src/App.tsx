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
  ChevronDown, Download, LayoutDashboard, Package, CreditCard,
  UserCheck, Users, ArrowUpRight, ArrowDownRight, Search, RefreshCw,
  Target, MessageSquare, Bell, Settings, Rocket, MoreHorizontal, Plus,
  ChevronRight, LogOut, Activity, Eye, Zap, AlertCircle, Smartphone,
  Menu, X, FileSpreadsheet, BarChart3, Upload
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, getYear, getMonth, getQuarter } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { dbSet, dbGet } from './lib/db';
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
  totalTargetPremium: number;
  progressDownloader: number;
  progressSales: number;
  progressConversion: number;
  hutangSales: number;
  totalRealDownloader: number;
  totalRealSales: number;
  totalRealPremium: number;
}

interface AppData {
  id: string;
  name: string;
  targetConfig: Record<string, any>;
  dailyData: Record<string, any>;
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

const PackageCalendar = ({ data, availableOptions, apps, focusDate }: { data: Transaction[], availableOptions: any, apps: AppData[], focusDate?: Date | null }) => {
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
    const map: Record<string, any[]> = {};
    filteredData.forEach(item => {
      const dateStr = format(item.parsed_payment_date, 'yyyy-MM-dd');
      if (!map[dateStr]) map[dateStr] = [];
      const existing = map[dateStr].find(p => p.name === item.content_name);
      if (existing) {
        existing.revenue += item.revenue;
        existing.transactions += 1;
        existing.prices.push(item.revenue);
      } else {
        map[dateStr].push({ 
          name: item.content_name, 
          revenue: item.revenue, 
          transactions: 1,
          prices: [item.revenue]
        });
      }
    });

    // Calculate stats
    Object.keys(map).forEach(date => {
      map[date] = map[date].map(p => ({
        ...p,
        minPrice: Math.min(...p.prices),
        maxPrice: Math.max(...p.prices),
        avgPrice: p.revenue / p.transactions
      }));
    });

    return map;
  }, [filteredData]);

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
            const packages = activePackagesByDay[dateStr] || [];
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2 border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="py-4 px-4 bg-white">Nama Paket</th>
                        <th className="py-4 px-4 bg-white">Revenue</th>
                        <th className="py-4 px-4 bg-white">Transactions</th>
                        <th className="py-4 px-4 bg-white text-emerald-600">Low Price</th>
                        <th className="py-4 px-4 bg-white text-indigo-600">Avg Price</th>
                        <th className="py-4 px-4 bg-white text-rose-600">High Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...activePackagesByDay[selectedDay]].sort((a, b) => b.revenue - a.revenue).map((pkg, i) => (
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
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-indigo-600" />
                    Strategi & Aktivitas Operasional
                  </h5>
                  <div className="space-y-4">
                    {apps.filter(app => !selectedApp || app.name.toUpperCase() === selectedApp.toUpperCase()).map(app => {
                      const dayData = app.dailyData?.[selectedDay];
                      if (!dayData) return null;
                      
                      const hasStrategy = dayData.premium || dayData.benefit || dayData.event || dayData.activity;
                      if (!hasStrategy) return null;

                      return (
                        <div key={app.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <p className="text-[9px] font-black text-indigo-600 uppercase mb-2">{app.name}</p>
                          <div className="grid grid-cols-2 gap-3">
                            {dayData.premium && (
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Premium</p>
                                <p className="text-[10px] font-bold text-slate-700">{dayData.premium}</p>
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
                    {apps.every(app => !app.dailyData?.[selectedDay] || (!app.dailyData[selectedDay].premium && !app.dailyData[selectedDay].benefit && !app.dailyData[selectedDay].event && !app.dailyData[selectedDay].activity)) && (
                      <div className="text-center py-8">
                        <p className="text-[10px] font-bold text-slate-400 italic">Tidak ada strategi operasional yang tercatat untuk hari ini.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

  const [form, setForm] = useState(selectedApp.targetConfig?.[targetMonth] || {
    targetDownloader: 0,
    targetUserPremium: 0,
    targetSales: 0,
    targetConversion: 0,
    avgPrice: 0,
  });

  useEffect(() => {
    setForm(selectedApp.targetConfig?.[targetMonth] || {
      targetDownloader: 0,
      targetUserPremium: 0,
      targetSales: 0,
      targetConversion: 0,
      avgPrice: 0,
    });
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
    const dailyUserPremium = Math.ceil(form.targetUserPremium / daysInMonthCount);
    
    const newDailyData: any = { ...(selectedApp.dailyData || {}) };
    dates.forEach(date => {
      newDailyData[date] = {
        targetDownloader: dailyDownloader,
        targetSales: dailySales,
        targetUserPremium: dailyUserPremium,
        actualDownloader: 0,
        actualSales: 0,
        actualUserPremium: 0,
        estimasiHarga: form.avgPrice,
        channel: '',
        promo: '',
        benefit: '',
        event: '',
        extra: '',
        bcan: '',
        story: '',
        chat: '',
        activity: ''
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
    const totalRealPremium = dailyValues.reduce((sum, d) => sum + (Number(d.actualUserPremium) || 0), 0);
    
    const targetConfig = selectedApp.targetConfig?.[targetMonth] || { 
      targetDownloader: 0, 
      targetSales: 0,
      targetUserPremium: 0,
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
      ? (totalRealPremium / totalRealDownloader) * 100 
      : 0;

    // Calculate Hutang Sales (Debt)
    const lastFilledIdx = dates.reduce((acc, d, i) => {
      const data = selectedApp.dailyData[d];
      const hasData = data && (
        (data.actualSales !== undefined && data.actualSales !== null && data.actualSales !== 0) ||
        (data.actualDownloader !== undefined && data.actualDownloader !== null && data.actualDownloader !== 0)
      );
      return hasData ? i : acc;
    }, -1);

    const baseDailySales = targetConfig.targetSales / dates.length;
    const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
    const hutangSales = Math.max(0, expectedSalesSoFar - totalRealSales);

    return {
      totalRealDownloader,
      totalRealSales,
      totalRealPremium,
      progressDownloader,
      progressSales,
      progressConversion,
      hutangSales,
      targetConfig
    };
  }, [selectedApp, targetMonth, dates]);

  const addApp = () => {
    const newId = Math.random().toString(36).substr(2, 9);
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
    let totalTargetPremium = 0;
    let totalRealPremium = 0;
    let totalHutangSales = 0;

    filteredAppsForSummary.forEach(app => {
      const targetConfig = app.targetConfig?.[targetMonth];
      if (targetConfig) {
        totalTargetDownloader += targetConfig.targetDownloader || 0;
        totalTargetSales += targetConfig.targetSales || 0;
        totalTargetPremium += targetConfig.targetUserPremium || 0;
      }

      const dailyData = app.dailyData || {};
      let appRealDownloader = 0;
      let appRealSales = 0;
      let appRealPremium = 0;
      let lastFilledIdx = -1;

      dates.forEach((date, idx) => {
        const d = dailyData[date];
        if (d) {
          const rd = Number(d.actualDownloader) || 0;
          const rs = Number(d.actualSales) || 0;
          const rp = Number(d.actualUserPremium) || 0;
          appRealDownloader += rd;
          appRealSales += rs;
          appRealPremium += rp;
          
          if (rd > 0 || rs > 0 || rp > 0) {
            lastFilledIdx = idx;
          }
        }
      });

      totalRealDownloader += appRealDownloader;
      totalRealSales += appRealSales;
      totalRealPremium += appRealPremium;

      if (targetConfig && targetConfig.targetSales > 0) {
        const baseDailySales = targetConfig.targetSales / dates.length;
        const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
        totalHutangSales += Math.max(0, expectedSalesSoFar - appRealSales);
      }
    });

    return {
      totalTargetDownloader,
      totalRealDownloader,
      totalTargetSales,
      totalRealSales,
      totalTargetPremium,
      totalRealPremium,
      totalHutangSales,
      downloaderProgress: totalTargetDownloader > 0 ? (totalRealDownloader / totalTargetDownloader) * 100 : 0,
      salesProgress: totalTargetSales > 0 ? (totalRealSales / totalTargetSales) * 100 : 0,
      conversionProgress: totalRealDownloader > 0 ? (totalRealPremium / totalRealDownloader) * 100 : 0
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
                    let appRealPremium = 0;
                    let lastFilledIdx = -1;

                    dates.forEach((date, idx) => {
                      const d = dailyData[date];
                      if (d) {
                        const rd = Number(d.actualDownloader) || 0;
                        const rs = Number(d.actualSales) || 0;
                        const rp = Number(d.actualUserPremium) || 0;
                        appRealDownloader += rd;
                        appRealSales += rs;
                        appRealPremium += rp;
                        if (rd > 0 || rs > 0 || rp > 0) lastFilledIdx = idx;
                      }
                    });

                    const progressDownloader = target?.targetDownloader > 0 ? (appRealDownloader / target.targetDownloader) * 100 : 0;
                    const progressSales = target?.targetSales > 0 ? (appRealSales / target.targetSales) * 100 : 0;
                    const progressConversion = appRealDownloader > 0 ? (appRealPremium / appRealDownloader) * 100 : 0;
                    
                    let hutangSales = 0;
                    if (target?.targetSales > 0) {
                      const baseDailySales = target.targetSales / dates.length;
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
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target User Premium</label>
              <input 
                type="number"
                value={form.targetUserPremium || ''}
                onChange={(e) => setForm({...form, targetUserPremium: Number(e.target.value)})}
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
                    <th colSpan={3} className="py-2 px-4 border-r border-b border-slate-200 text-center bg-violet-100/20">User Premium</th>
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
                    <th className="py-4 px-4 border-r border-slate-200">Premium</th>
                    <th className="py-4 px-4 border-r border-slate-200">Benefit</th>
                    <th className="py-4 px-4 border-r border-slate-200">Event</th>
                    <th className="py-4 px-4 border-r border-slate-200">Benefit</th>
                    <th className="py-4 px-4 border-r border-slate-200">BC</th>
                    <th className="py-4 px-4 border-r border-slate-200">Story</th>
                    <th className="py-4 px-4 border-r border-slate-200">Chat</th>
                    <th className="py-4 px-4 border-slate-200">Lainnya</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date, idx) => {
                    const dayData = selectedApp.dailyData[date] || {};
                    const conv = dayData.actualDownloader > 0 ? (dayData.actualUserPremium / dayData.actualDownloader) * 100 : 0;
                    
                    // Chained Dynamic Target Logic
                    const totalTargetSales = selectedApp.targetConfig[targetMonth]?.targetSales || 0;
                    const totalTargetDownloader = selectedApp.targetConfig[targetMonth]?.targetDownloader || 0;
                    const totalTargetPremium = selectedApp.targetConfig[targetMonth]?.targetUserPremium || 0;
                    
                    const baseDailySales = totalTargetSales / dates.length;
                    const baseDailyDownloader = totalTargetDownloader / dates.length;
                    const baseDailyPremium = totalTargetPremium / dates.length;

                    // Find the last day that has real data (not null/undefined)
                    const lastFilledIdx = dates.reduce((acc, d, i) => {
                      const data = selectedApp.dailyData[d];
                      const hasData = data && (
                        (data.actualSales !== undefined && data.actualSales !== null) ||
                        (data.actualDownloader !== undefined && data.actualDownloader !== null) ||
                        (data.actualUserPremium !== undefined && data.actualUserPremium !== null)
                      );
                      return hasData ? i : acc;
                    }, -1);

                    let flexibleTargetSales = baseDailySales;
                    let flexibleTargetDownloader = baseDailyDownloader;
                    let flexibleTargetPremium = baseDailyPremium;

                    // If this is the day immediately after the last filled day, apply the accumulated deficit
                    if (idx === lastFilledIdx + 1) {
                      const actualsBefore = dates.slice(0, lastFilledIdx + 1).map(d => selectedApp.dailyData[d] || {});
                      const totalActualSalesBefore = actualsBefore.reduce((sum, d) => sum + (d.actualSales || 0), 0);
                      const totalActualDownloaderBefore = actualsBefore.reduce((sum, d) => sum + (d.actualDownloader || 0), 0);
                      const totalActualPremiumBefore = actualsBefore.reduce((sum, d) => sum + (d.actualUserPremium || 0), 0);
                      
                      const expectedSalesBefore = baseDailySales * (lastFilledIdx + 1);
                      const expectedDownloaderBefore = baseDailyDownloader * (lastFilledIdx + 1);
                      const expectedPremiumBefore = baseDailyPremium * (lastFilledIdx + 1);

                      const deficitSales = expectedSalesBefore - totalActualSalesBefore;
                      const deficitDownloader = expectedDownloaderBefore - totalActualDownloaderBefore;
                      const deficitPremium = expectedPremiumBefore - totalActualPremiumBefore;

                      // Apply reasonable limits (max 2x base target, min 0.2x base target)
                      flexibleTargetSales = Math.max(baseDailySales * 0.2, Math.min(baseDailySales * 2, baseDailySales + deficitSales));
                      flexibleTargetDownloader = Math.max(baseDailyDownloader * 0.2, Math.min(baseDailyDownloader * 2, baseDailyDownloader + deficitDownloader));
                      flexibleTargetPremium = Math.max(baseDailyPremium * 0.2, Math.min(baseDailyPremium * 2, baseDailyPremium + deficitPremium));
                    }

                    // Use manual override if exists
                    const displayTargetSales = dayData.manualTargetSales || flexibleTargetSales;
                    const displayTargetDownloader = dayData.manualTargetDownloader || flexibleTargetDownloader;
                    const displayTargetPremium = dayData.manualTargetPremium || flexibleTargetPremium;

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
                            value={dayData.manualTargetPremium || Math.round(displayTargetPremium)} 
                            onChange={(e) => updateDailyValue(date, 'manualTargetPremium', Number(e.target.value))}
                            className="w-full bg-transparent text-[11px] font-bold text-slate-400 outline-none focus:text-indigo-600 transition-colors"
                          />
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 bg-indigo-50/20">
                          <input 
                            type="number" 
                            value={dayData.actualUserPremium === null || dayData.actualUserPremium === undefined ? '' : dayData.actualUserPremium} 
                            onChange={(e) => updateDailyValue(date, 'actualUserPremium', e.target.value === '' ? null : Number(e.target.value))}
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
                        <td className="py-3 px-4">
                          <input 
                            type="text" 
                            value={dayData.activity || ''} 
                            onChange={(e) => updateDailyValue(date, 'activity', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-200"
                            placeholder="..."
                          />
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

const MonitoringSection = ({ data, downloaderData, target }: { data: Transaction[], downloaderData: Downloader[], target: any }) => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const daysInMonth = endOfMonth(today).getDate();
  const currentDay = today.getDate();

  const currentMonthData = useMemo(() => {
    return data.filter(d => d.month === currentMonth && d.year === currentYear);
  }, [data, currentMonth, currentYear]);

  const currentMonthDownloader = useMemo(() => {
    return downloaderData.filter(d => d.month === currentMonth && d.year === currentYear);
  }, [downloaderData, currentMonth, currentYear]);

  const stats = useMemo(() => {
    const actualRevenue = currentMonthData.reduce((acc, curr) => acc + curr.revenue, 0);
    const actualPremium = currentMonthData.length;
    const actualDownloader = currentMonthDownloader.reduce((acc, curr) => acc + curr.count, 0);

    const revenueRunRate = actualRevenue / Math.max(1, currentDay);
    const projectedRevenue = revenueRunRate * daysInMonth;

    const downloaderRunRate = actualDownloader / Math.max(1, currentDay);
    const projectedDownloader = downloaderRunRate * daysInMonth;

    const premiumRunRate = actualPremium / Math.max(1, currentDay);
    const projectedPremium = premiumRunRate * daysInMonth;

    const revenueGap = target.revenue - actualRevenue;
    const remainingDays = Math.max(1, daysInMonth - currentDay);
    const requiredDailyRevenue = revenueGap > 0 ? revenueGap / remainingDays : 0;

    const isRevenueRealistic = projectedRevenue >= target.revenue * 0.9;

    const activePackages = target.packages.filter((p: any) => p.active && p.price > 0).sort((a: any, b: any) => a.price - b.price);
    const mainPackage = activePackages.length > 0 ? activePackages[activePackages.length - 1] : null;
    const conversionRate = (target.targetConversion || 1) / 100;
    
    const monthlyPremiumTarget = mainPackage ? Math.ceil(target.revenue / mainPackage.price) : 0;
    const monthlyDownloaderTarget = Math.ceil(monthlyPremiumTarget / (conversionRate || 0.01));

    return {
      actualRevenue,
      actualPremium,
      actualDownloader,
      projectedRevenue,
      projectedDownloader,
      projectedPremium,
      revenueGap,
      requiredDailyRevenue,
      isRevenueRealistic,
      monthlyDownloaderTarget,
      monthlyPremiumTarget,
      revenueProgress: (actualRevenue / (target.revenue || 1)) * 100,
      downloaderProgress: (actualDownloader / (monthlyDownloaderTarget || 1)) * 100,
      premiumProgress: (actualPremium / (monthlyPremiumTarget || 1)) * 100
    };
  }, [currentMonthData, currentMonthDownloader, target, currentDay, daysInMonth]);

  const dailyTrend = useMemo(() => {
    const days = Array.from({ length: currentDay }, (_, i) => i + 1);
    const targetDailyRev = target.revenue / 30;
    
    return days.map(day => {
      const dayData = currentMonthData.filter(d => d.parsed_payment_date.getDate() === day);
      const revenue = dayData.reduce((acc, curr) => acc + curr.revenue, 0);
      return {
        day: `Day ${day}`,
        Actual: revenue,
        Target: targetDailyRev
      };
    });
  }, [currentMonthData, target, currentDay]);

  if (target.revenue === 0) {
    return (
      <div className="bg-white p-12 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">Target Belum Ditentukan</h3>
        <p className="text-slate-400 max-w-md mx-auto">Silakan atur target bulanan Anda di menu "Strategi & Target" terlebih dahulu untuk melihat monitoring real-time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Real-time Status Header */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl",
              stats.isRevenueRealistic ? "bg-emerald-500 shadow-emerald-100" : "bg-rose-500 shadow-rose-100"
            )}>
              {stats.isRevenueRealistic ? <Zap className="w-10 h-10 text-white" /> : <AlertCircle className="w-10 h-10 text-white" />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.isRevenueRealistic ? "On Track!" : "Off Track!"}
              </h2>
              <p className="text-slate-400 font-medium">
                {stats.isRevenueRealistic 
                  ? "Berdasarkan tren saat ini, target Anda masih sangat realistis untuk dicapai." 
                  : "Tren saat ini menunjukkan target sulit tercapai. Dibutuhkan penyesuaian strategi segera."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-nowrap">Proyeksi Akhir Bulan</p>
              <p className="text-2xl font-black text-indigo-600">{formatCurrency(stats.projectedRevenue)}</p>
            </div>
            <div className="w-px h-12 bg-slate-100 hidden md:block" />
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                stats.isRevenueRealistic ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              )}>
                {stats.isRevenueRealistic ? "Realistis" : "Berisiko"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100 flex flex-col justify-between relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-2">Sisa Target</p>
            <h3 className="text-2xl font-black text-white">{formatCurrency(Math.max(0, target.revenue - stats.actualRevenue))}</h3>
          </div>
          <div className="relative z-10 mt-4">
            <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">Progress</p>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, stats.revenueProgress)}%` }}
                className="h-full bg-white"
              />
            </div>
          </div>
          <Activity className="w-24 h-24 text-white/10 absolute -right-4 -bottom-4 group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-indigo-50 rounded-2xl">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Revenue</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Actual vs Target</p>
          <div className="flex items-baseline gap-2 mb-4">
            <h4 className="text-2xl font-black text-slate-900">{formatCurrency(stats.actualRevenue)}</h4>
            <span className="text-xs text-slate-400 font-medium">/ {formatCurrency(target.revenue)}</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-slate-400">PROGRESS</span>
                <span className="text-indigo-600">{stats.revenueProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, stats.revenueProgress)}%` }} />
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Run Rate Harian</p>
              <p className="text-lg font-black text-slate-700">{formatCurrency(stats.actualRevenue / Math.max(1, currentDay))}</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Target Harian Baru</p>
              <p className="text-lg font-black text-indigo-700">{formatCurrency(stats.requiredDailyRevenue)}</p>
              <p className="text-[9px] text-indigo-400 font-medium leading-tight mt-1">Minimal pendapatan per hari untuk mencapai target di sisa hari bulan ini.</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <Download className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Downloads</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Actual vs Target</p>
          <div className="flex items-baseline gap-2 mb-4">
            <h4 className="text-2xl font-black text-slate-900">{formatNumber(stats.actualDownloader)}</h4>
            <span className="text-xs text-slate-400 font-medium">/ {formatNumber(stats.monthlyDownloaderTarget)}</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-slate-400">PROGRESS</span>
                <span className="text-emerald-600">{stats.downloaderProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, stats.downloaderProgress)}%` }} />
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Proyeksi Akhir</p>
              <p className="text-lg font-black text-slate-700">{formatNumber(Math.ceil(stats.projectedDownloader))}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-violet-50 rounded-2xl">
              <UserCheck className="w-6 h-6 text-violet-600" />
            </div>
            <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-3 py-1 rounded-full">Premium</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Actual vs Target</p>
          <div className="flex items-baseline gap-2 mb-4">
            <h4 className="text-2xl font-black text-slate-900">{formatNumber(stats.actualPremium)}</h4>
            <span className="text-xs text-slate-400 font-medium">/ {formatNumber(stats.monthlyPremiumTarget)}</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span className="text-slate-400">CONVERSION RATE</span>
                <span className="text-violet-600">{((stats.actualPremium / (stats.actualDownloader || 1)) * 100).toFixed(2)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-600" style={{ width: `${Math.min(100, (stats.actualPremium / (stats.actualDownloader || 1)) * 100 / target.targetConversion * 100)}%` }} />
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gap Target</p>
              <p className="text-lg font-black text-rose-600">-{formatNumber(Math.max(0, stats.monthlyPremiumTarget - stats.actualPremium))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-white p-10 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Tren Harian vs Target</h3>
            <p className="text-sm text-slate-400 font-medium mt-1">Monitoring performa harian untuk mencapai target bulanan</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-200" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target</span>
            </div>
          </div>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={(val) => `Rp${val >= 1000000 ? (val/1000000).toFixed(0) + 'jt' : val}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                formatter={(val: number) => [formatCurrency(val), 'Revenue']}
              />
              <Area type="monotone" dataKey="Actual" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorActual)" />
              <Line type="monotone" dataKey="Target" stroke="#e2e8f0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
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

const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose }: { activeTab: string, setActiveTab: (t: string) => void, isOpen: boolean, onClose: () => void }) => {
  const menuItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'Ringkasan Performa' },
    { id: 'monitoring', icon: BarChart3, label: 'Monitoring Real-time' },
    { id: 'optimasi', icon: TrendingUp, label: 'Optimasi Harga' },
    { id: 'target', icon: Target, label: 'Strategi & Target' },
    { id: 'packages', icon: Package, label: 'Performa Produk' },
    { id: 'calendar', icon: Calendar, label: 'Kalender Paket' },
  ];

  const accountItems = [
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="sidebar-overlay lg:hidden" onClick={onClose} />
      )}

      <div className={cn(
        "w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen overflow-y-auto custom-scrollbar transition-transform duration-300 ease-in-out z-50",
        "fixed lg:sticky top-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-8 border-b border-slate-800 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 flex items-center justify-center">
                <img
                  src="/logo_transparent.png"
                  alt="Logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.className = 'w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200';
                    fallback.innerHTML = '<svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3"></path><path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5"></path></svg>';
                    e.currentTarget.parentElement!.appendChild(fallback);
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight leading-none">SiMarsel<span className="text-indigo-500">.</span></h1>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">PT. Cerebrum Edukanesia</p>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-8">
          <div>
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Menu Utama</p>
            <div className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
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
                  onClick={() => handleTabClick(item.id)}
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
    </>
  );
};

const TopBar = ({ onMenuToggle, searchQuery, setSearchQuery, activeTab }: { onMenuToggle: () => void, searchQuery: string, setSearchQuery: (q: string) => void, activeTab: string }) => {
  const tabLabels: Record<string, string> = {
    overview: 'Ringkasan Performa',
    monitoring: 'Monitoring Real-time',
    optimasi: 'Optimasi Harga',
    target: 'Strategi & Target',
    packages: 'Performa Produk',
    calendar: 'Kalender Paket',
    settings: 'Pengaturan',
  };

  return (
    <div className="h-16 lg:h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">{tabLabels[activeTab] || 'Dashboard'}</h2>
          <p className="text-[10px] text-slate-400 font-medium">SiMarsel Analytics Dashboard</p>
        </div>
      </div>
      <div className="relative w-full max-w-xs lg:max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari transaksi, paket..."
          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

const SettingsSection = ({ onDataUpdate, data, downloaderData, apps }: { onDataUpdate: (data: Transaction[], downloader: Downloader[]) => void, data: Transaction[], downloaderData: Downloader[], apps: AppData[] }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadSuccess(false);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });

        let transactions: any[] = [];
        let downloaders: any[] = [];

        workbook.SheetNames.forEach(name => {
          const sheet = workbook.Sheets[name];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          if (name.toUpperCase().includes('TRANSAKSI')) {
            transactions = jsonData;
          } else if (name.toUpperCase().includes('DOWNLOADER')) {
            downloaders = jsonData;
          }
        });

        if (transactions.length === 0 && workbook.SheetNames.length > 0) {
          transactions = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        }
        if (downloaders.length === 0 && workbook.SheetNames.length > 1) {
          downloaders = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[1]]);
        }

        (onDataUpdate as any)(transactions, downloaders);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      } catch (err) {
        console.error(err);
        alert('Gagal memproses file. Pastikan format Excel benar.');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportData = () => {
    const wb = XLSX.utils.book_new();

    // Export transactions
    if (data.length > 0) {
      const exportData = data.map(d => ({
        transaction_date: d.transaction_date,
        payment_date: format(d.parsed_payment_date, 'yyyy-MM-dd'),
        trx_id: d.trx_id,
        source_app: d.source_app,
        methode_name: d.methode_name,
        revenue: d.revenue,
        promo_code: d.promo_code,
        content_name: d.content_name,
        full_name: d.full_name,
        email: d.email,
        phone: d.phone,
        payment_status: d.payment_status,
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'TRANSAKSI');
    }

    // Export downloader data
    if (downloaderData.length > 0) {
      const dlData = downloaderData.map(d => ({
        date: format(d.parsed_date, 'yyyy-MM-dd'),
        source_app: d.source_app,
        count: d.count,
      }));
      const ws2 = XLSX.utils.json_to_sheet(dlData);
      XLSX.utils.book_append_sheet(wb, ws2, 'DOWNLOADER');
    }

    XLSX.writeFile(wb, `SiMarsel_Export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportTargets = () => {
    const wb = XLSX.utils.book_new();
    const rows: any[] = [];

    apps.forEach(app => {
      Object.keys(app.targetConfig || {}).forEach(month => {
        const config = app.targetConfig[month];
        if (typeof config === 'object' && config !== null) {
          rows.push({
            app_name: app.name,
            month,
            target_downloader: config.targetDownloader || 0,
            target_user_premium: config.targetUserPremium || 0,
            target_sales: config.targetSales || 0,
            target_conversion: config.targetConversion || 0,
            avg_price: config.avgPrice || 0,
          });
        }
      });
    });

    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'TARGET');
    }

    XLSX.writeFile(wb, `SiMarsel_Targets_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <Upload className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Import Data</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Upload file Excel baru untuk memperbarui dashboard</p>
          </div>
        </div>

        <div className="max-w-xl">
          <div className={cn(
            "p-12 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-center group transition-all cursor-pointer relative",
            uploadSuccess
              ? "border-emerald-300 bg-emerald-50/30"
              : "border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30"
          )}>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {isUploading ? (
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              ) : uploadSuccess ? (
                <ArrowUpRight className="w-8 h-8 text-emerald-600" />
              ) : (
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" />
              )}
            </div>
            <h4 className="text-sm font-black text-slate-900 mb-1">
              {isUploading ? 'Memproses File...' : uploadSuccess ? 'Data Berhasil Diperbarui!' : 'Klik atau Drag file Excel di sini'}
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              Format: .xlsx atau .xls dengan sheet TRANSAKSI dan DOWNLOADER
            </p>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-emerald-50 rounded-xl">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Export Data</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Download data transaksi atau target dalam format Excel</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
          <button
            onClick={handleExportData}
            disabled={data.length === 0}
            className="p-6 border-2 border-slate-100 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Download className="w-6 h-6 text-indigo-600" />
            </div>
            <h4 className="text-sm font-black text-slate-900 mb-1">Export Transaksi</h4>
            <p className="text-[10px] text-slate-400 font-medium">{data.length > 0 ? `${formatNumber(data.length)} transaksi tersedia` : 'Belum ada data'}</p>
          </button>

          <button
            onClick={handleExportTargets}
            disabled={apps.every(a => Object.keys(a.targetConfig || {}).length === 0)}
            className="p-6 border-2 border-slate-100 rounded-2xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Target className="w-6 h-6 text-emerald-600" />
            </div>
            <h4 className="text-sm font-black text-slate-900 mb-1">Export Target</h4>
            <p className="text-[10px] text-slate-400 font-medium">
              {apps.reduce((sum, a) => sum + Object.keys(a.targetConfig || {}).length, 0)} konfigurasi target
            </p>
          </button>
        </div>
      </div>

      {/* Data Stats Summary */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-violet-50 rounded-xl">
            <Activity className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Status Data</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Ringkasan data yang tersedia di dashboard</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Transaksi</p>
            <p className="text-lg font-black text-slate-900">{formatNumber(data.length)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Downloader</p>
            <p className="text-lg font-black text-slate-900">{formatNumber(downloaderData.length)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Aplikasi</p>
            <p className="text-lg font-black text-slate-900">{apps.length}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data Tersimpan</p>
            <p className="text-lg font-black text-emerald-600">Lokal</p>
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

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Global search
  const [searchQuery, setSearchQuery] = useState('');

  // Load apps from localStorage or use default
  const [apps, setApps] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('simarsel_apps');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{
      id: '1',
      name: 'App Utama',
      targetConfig: {},
      dailyData: {},
      isTargetSet: {}
    }];
  });

  const [selectedAppId, setSelectedAppId] = useState(() => {
    try {
      return localStorage.getItem('simarsel_selectedAppId') || '1';
    } catch { return '1'; }
  });

  const [targetMonth, setTargetMonth] = useState(() => {
    try {
      return localStorage.getItem('simarsel_targetMonth') || format(new Date(), 'yyyy-MM');
    } catch { return format(new Date(), 'yyyy-MM'); }
  });

  const [calendarFocusDate, setCalendarFocusDate] = useState<Date | null>(null);

  // Persist apps to localStorage
  useEffect(() => {
    try { localStorage.setItem('simarsel_apps', JSON.stringify(apps)); } catch {}
  }, [apps]);

  useEffect(() => {
    try { localStorage.setItem('simarsel_selectedAppId', selectedAppId); } catch {}
  }, [selectedAppId]);

  useEffect(() => {
    try { localStorage.setItem('simarsel_targetMonth', targetMonth); } catch {}
  }, [targetMonth]);

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

  const handleDataUpdate = useCallback((rawTransactions: any[], rawDownloaders: any[]) => {
    const processedTransactions = processData(rawTransactions);
    const processedDownloaders = processDownloaderData(rawDownloaders);
    setData(processedTransactions);
    setDownloaderData(processedDownloaders);
  }, [processData, processDownloaderData]);

  // Save data to IndexedDB whenever it changes (and has content)
  useEffect(() => {
    if (data.length > 0) {
      dbSet('transactions', data).catch(() => {});
    }
  }, [data]);

  useEffect(() => {
    if (downloaderData.length > 0) {
      dbSet('downloaders', downloaderData).catch(() => {});
    }
  }, [downloaderData]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

        // 1. Try IndexedDB first (persisted from previous upload)
        try {
          const [savedTx, savedDl] = await Promise.all([
            dbGet<Transaction[]>('transactions'),
            dbGet<Downloader[]>('downloaders'),
          ]);
          if (savedTx && savedTx.length > 0) {
            // Restore parsed dates (IndexedDB serializes Date as string)
            const restored = savedTx.map(item => ({
              ...item,
              parsed_payment_date: new Date(item.parsed_payment_date),
            }));
            setData(restored);
            if (savedDl && savedDl.length > 0) {
              setDownloaderData(savedDl.map(d => ({ ...d, parsed_date: new Date(d.parsed_date) })));
            }
            setError(null);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('IndexedDB load failed, trying file:', e);
        }

        // 2. Try fetching xlsx file from public/
        const paths = ['/data_paid_clean.xlsx', 'data_paid_clean.xlsx', './data_paid_clean.xlsx'];
        let response: Response | null = null;

        for (const path of paths) {
          try {
            const r = await fetch(path);
            const contentType = r.headers.get('content-type');
            if (r.ok && (!contentType || !contentType.includes('text/html'))) {
              response = r;
              break;
            }
          } catch (e) {
            console.warn(`Failed to fetch from ${path}`);
          }
        }

        if (response) {
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetNames = workbook.SheetNames;
          const findSheet = (keywords: string[]) => {
            return sheetNames.find(s => keywords.some(k => s.toLowerCase().includes(k.toLowerCase())));
          };

          const transactionSheetName = findSheet(['transaksi', 'trx', 'paid']);
          const transactionSheet = transactionSheetName ? workbook.Sheets[transactionSheetName] : workbook.Sheets[sheetNames[0]];
          const transactionJson = XLSX.utils.sheet_to_json(transactionSheet);
          if (transactionJson && transactionJson.length > 0) {
            setData(processData(transactionJson));
          }

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

        // 3. Fallback to INITIAL_DATA
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
        setError('Silakan unggah file Excel melalui halaman Settings untuk memulai.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [processData]);

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
    const q = searchQuery.toLowerCase().trim();
    return data.filter(item => {
      const matchApp = filters.source_app === 'All' || item.source_app === filters.source_app;
      const matchYear = filters.year === 'All' || item.year === Number(filters.year);
      const matchMonth = filters.month === 'All' || item.month === Number(filters.month);
      const matchMethod = filters.methode_name === 'All' || item.methode_name === filters.methode_name;
      const matchSearch = !q || (
        (item.content_name || '').toLowerCase().includes(q) ||
        (item.full_name || '').toLowerCase().includes(q) ||
        (item.trx_id || '').toLowerCase().includes(q) ||
        (item.source_app || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q)
      );
      return matchApp && matchYear && matchMonth && matchMethod && matchSearch;
    });
  }, [data, filters, searchQuery]);

  const filteredDownloaderData = useMemo(() => {
    return downloaderData.filter(item => {
      const matchApp = filters.source_app === 'All' || item.source_app === filters.source_app;
      const matchYear = filters.year === 'All' || item.year === Number(filters.year);
      const matchMonth = filters.month === 'All' || item.month === Number(filters.month);
      return matchApp && matchYear && matchMonth;
    });
  }, [downloaderData, filters]);

  const recapData = useMemo(() => {
    const yearly: any = {};
    const monthly: any = {};
    const weekly: any = {};
    const daily: any = {};

    filteredData.forEach(item => {
      const d = item.parsed_payment_date;
      const yKey = format(d, 'yyyy');
      const mKey = format(d, 'yyyy-MM');
      const wKey = `${format(d, 'yyyy')}-W${format(d, 'ww')}`;
      const dKey = format(d, 'yyyy-MM-dd');

      const update = (acc: any, key: string) => {
        if (!acc[key]) acc[key] = { name: key, revenue: 0, transactions: 0, buyers: new Set() };
        acc[key].revenue += item.revenue;
        acc[key].transactions += 1;
        acc[key].buyers.add(item.email || item.phone);
      };

      update(yearly, yKey);
      update(monthly, mKey);
      update(weekly, wKey);
      update(daily, dKey);
    });

    const finalize = (acc: any) => Object.values(acc).map((item: any) => ({
      ...item,
      uniqueBuyers: item.buyers.size,
      aov: item.transactions > 0 ? item.revenue / item.transactions : 0
    })).sort((a: any, b: any) => a.name.localeCompare(b.name));

    return {
      yearly: finalize(yearly),
      monthly: finalize(monthly),
      weekly: finalize(weekly),
      daily: finalize(daily)
    };
  }, [filteredData]);

  const availableOptions = useMemo(() => {
    const allApps = data.map(d => d.source_app).concat(downloaderData.map(d => d.source_app));
    const allYears = data.map(d => d.year).concat(downloaderData.map(d => d.year));
    
    return {
      source_apps: Array.from(new Set(allApps.filter(Boolean))).sort(),
      years: Array.from(new Set(allYears.filter(y => y !== null && y !== undefined))).sort((a: number, b: number) => b - a),
      methods: Array.from(new Set(data.map(d => d.methode_name).filter(Boolean))).sort()
    };
  }, [data, downloaderData]);

  const stats: DashboardStats = useMemo(() => {
    const isMonthFiltered = filters.month !== 'All';
    const isYearFiltered = filters.year !== 'All';
    const monthKey = isYearFiltered && isMonthFiltered ? `${filters.year}-${filters.month.padStart(2, '0')}` : null;

    const totalRealSales = filteredData.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = filteredData.length;
    const uniqueBuyers = new Set(filteredData.map(item => item.email || item.phone || item.full_name || item.trx_id).filter(Boolean)).size;
    const totalRealDownloader = filteredDownloaderData.reduce((sum, d) => sum + d.count, 0);

    // Filter apps based on source_app filter
    const relevantApps = filters.source_app === 'All' 
      ? apps 
      : apps.filter(app => app.name.toUpperCase() === filters.source_app.toUpperCase());

    let totalTargetRevenue = 0;
    let totalTargetDownloader = 0;
    let totalTargetPremium = 0;
    let totalRealPremiumFromApps = 0;
    let totalHutangSales = 0;

    relevantApps.forEach(app => {
      // If month is filtered, get target for that month
      if (monthKey) {
        const target = app.targetConfig?.[monthKey];
        if (target) {
          totalTargetRevenue += target.targetSales || 0;
          totalTargetDownloader += target.targetDownloader || 0;
          totalTargetPremium += target.targetUserPremium || 0;
        }

        // Calculate real premium and hutang from dailyData
        const dailyData = app.dailyData || {};
        const monthDates = Object.keys(dailyData).filter(date => date.startsWith(monthKey)).sort();
        
        let appRealSales = 0;
        monthDates.forEach(date => {
          totalRealPremiumFromApps += Number(dailyData[date].actualUserPremium) || 0;
          appRealSales += Number(dailyData[date].actualSales) || 0;
        });

        if (target) {
          const lastFilledIdx = monthDates.reduce((acc, d, i) => {
            const data = dailyData[d];
            const hasData = data && (
              (data.actualSales !== undefined && data.actualSales !== null && data.actualSales !== 0) ||
              (data.actualDownloader !== undefined && data.actualDownloader !== null && data.actualDownloader !== 0)
            );
            return hasData ? i : acc;
          }, -1);

          const baseDailySales = target.targetSales / 30; // Approximation if month length not easily available here
          const expectedSalesSoFar = baseDailySales * (lastFilledIdx + 1);
          totalHutangSales += Math.max(0, expectedSalesSoFar - appRealSales);
        }
      } else {
        // If month is not filtered, we might want to aggregate all targets or just show 0
        // For now, let's aggregate all targets in targetConfig
        Object.keys(app.targetConfig || {}).forEach(m => {
          if (!isYearFiltered || m.startsWith(filters.year)) {
            const target = app.targetConfig[m];
            totalTargetRevenue += target.targetSales || 0;
            totalTargetDownloader += target.targetDownloader || 0;
            totalTargetPremium += target.targetUserPremium || 0;
          }
        });

        Object.keys(app.dailyData || {}).forEach(date => {
          if (!isYearFiltered || date.startsWith(filters.year)) {
            totalRealPremiumFromApps += Number(app.dailyData[date].actualUserPremium) || 0;
          }
        });
      }
    });

    const progressDownloader = totalTargetDownloader > 0 ? (totalRealDownloader / totalTargetDownloader) * 100 : 0;
    const progressSales = totalTargetRevenue > 0 ? (totalRealSales / totalTargetRevenue) * 100 : 0;
    const progressConversion = totalRealDownloader > 0 ? (totalRealPremiumFromApps / totalRealDownloader) * 100 : 0;

    return {
      totalRevenue: totalRealSales,
      totalTransactions,
      aov: totalTransactions > 0 ? totalRealSales / totalTransactions : 0,
      uniqueBuyers,
      totalPackagesSold: totalTransactions,
      totalTargetRevenue,
      totalTargetDownloader,
      totalTargetPremium,
      progressDownloader,
      progressSales,
      progressConversion,
      hutangSales: totalHutangSales,
      totalRealDownloader,
      totalRealSales,
      totalRealPremium: totalRealPremiumFromApps
    };
  }, [filteredData, filteredDownloaderData, apps, filters]);

  // --- Chart Data Preparation ---

  const trendData = useMemo(() => {
    const isMonthFiltered = filters.month !== 'All';

    if (isMonthFiltered) {
      // Daily recap for the specific month
      const grouped: Record<string, TrendItem> = {};
      
      filteredData.forEach(item => {
        const key = format(item.parsed_payment_date, 'dd MMM');
        if (!grouped[key]) {
          grouped[key] = { 
            name: key, 
            revenue: 0, 
            transactions: 0, 
            downloader: 0, 
            conversion: 0, 
            rawDate: item.parsed_payment_date 
          };
        }
        grouped[key].revenue += item.revenue;
        grouped[key].transactions += 1;
      });

      filteredDownloaderData.forEach(item => {
        const key = format(item.parsed_date, 'dd MMM');
        if (!grouped[key]) {
          grouped[key] = { 
            name: key, 
            revenue: 0, 
            transactions: 0, 
            downloader: 0, 
            conversion: 0, 
            rawDate: item.parsed_date 
          };
        }
        grouped[key].downloader += item.count;
      });

      return Object.values(grouped).map(item => ({
        ...item,
        conversion: item.downloader > 0 ? (item.transactions / item.downloader) * 100 : 0
      })).sort((a: TrendItem, b: TrendItem) => (a.rawDate?.getTime() || 0) - (b.rawDate?.getTime() || 0));
    }

    // Monthly trend based on data range
    if (data.length === 0 && downloaderData.length === 0) return [];

    const allYears = data.map(d => d.year).concat(downloaderData.map(d => d.year));
    const minYear = allYears.length > 0 ? allYears.reduce((a, b) => Math.min(a, b)) : 2024;
    const maxYear = allYears.length > 0 ? allYears.reduce((a, b) => Math.max(a, b)) : 2026;
    
    const allMonths: TrendItem[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      for (let m = 0; m < 12; m++) {
        const date = new Date(y, m, 1);
        allMonths.push({
          name: format(date, 'MMM yyyy'),
          key: format(date, 'yyyy-MM'),
          revenue: 0,
          transactions: 0,
          downloader: 0,
          conversion: 0
        });
      }
    }

    filteredData.forEach(item => {
      const key = item.year_month;
      const monthObj = allMonths.find(m => m.key === key);
      if (monthObj) {
        monthObj.revenue += item.revenue;
        monthObj.transactions += 1;
      }
    });

    filteredDownloaderData.forEach(item => {
      const key = item.year_month;
      const monthObj = allMonths.find(m => m.key === key);
      if (monthObj) {
        monthObj.downloader += item.count;
      }
    });

    return allMonths.map(item => ({
      ...item,
      conversion: item.downloader > 0 ? (item.transactions / item.downloader) * 100 : 0
    }));
  }, [data, downloaderData, filteredData, filteredDownloaderData, filters.month]);

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
      acc[subKey].buyers.add(item.email || item.phone);
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
      acc[key].buyers.add(item.email || item.phone);
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="bg-white p-12 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 max-w-xl w-full text-center">
          <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
            <TrendingUp className="w-12 h-12 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">SiMarsel Analytics</h2>
          <p className="text-slate-500 mb-10 leading-relaxed font-medium">
            Sistem sedang menunggu data untuk inisialisasi dashboard. <br/>
            Pastikan file <code className="bg-indigo-50 px-2 py-1 rounded text-indigo-600 font-bold text-sm mx-1">data_paid_clean.xlsx</code> tersedia di direktori utama atau unggah secara manual di bawah ini.
          </p>
          <div className="bg-slate-50 p-8 rounded-[2rem] border border-dashed border-slate-200">
            <label className="block w-full cursor-pointer">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <Download className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Unggah Database</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Format: .xlsx atau .xls</p>
                </div>
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                  Pilih File
                </div>
              </div>
            </label>
          </div>
          <div className="mt-10 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Activity className="w-3 h-3" />
            <span>Ready for initialization</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} searchQuery={searchQuery} setSearchQuery={setSearchQuery} activeTab={activeTab} />

        <main className="p-4 lg:p-8 max-w-[1600px] mx-auto w-full">
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Premium Users</p>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{formatNumber(stats.totalRealPremium)}</h3>
                  <p className="text-[9px] text-slate-400 font-medium mt-1">Total pengguna berbayar</p>
                </div>
              </div>
              {/* Revenue Trend */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Tren Pendapatan</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Statistik performa pendapatan</p>
                  </div>
                  <div className="p-2.5 bg-indigo-50 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData.filter(d => d.revenue > 0 || filters.year === 'All')} margin={{ bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        interval={filters.year === 'All' ? 2 : 0}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                        tickFormatter={(val) => {
                          if (val >= 1000000) return `Rp${(val/1000000).toFixed(1)}jt`;
                          if (val >= 1000) return `Rp${(val/1000).toFixed(0)}rb`;
                          return `Rp${val}`;
                        }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                        formatter={(val: number) => [formatCurrency(val), 'Pendapatan']}
                      />
                      <Bar dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transaction Volume */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Volume Transaksi</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Total transaksi per periode</p>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        interval={filters.year === 'All' ? 2 : 0}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                        formatter={(val: number) => [formatNumber(val), 'Transaksi']}
                      />
                      <Bar dataKey="transactions" fill="#10b981" radius={[8, 8, 0, 0]} barSize={filters.month !== 'All' ? 15 : 30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Downloader Trend */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Tren Downloader</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Total downloader per periode</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-xl">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        interval={filters.year === 'All' ? 2 : 0}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                        formatter={(val: number) => [formatNumber(val), 'Downloader']}
                      />
                      <Bar dataKey="downloader" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={filters.month !== 'All' ? 15 : 30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Method Pie Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">Metode Pembayaran (Revenue)</h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">Distribusi pendapatan per metode</p>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-xl">
                      <CreditCard className="w-5 h-5 text-emerald-600" />
                    </div>
                  </div>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.values(filteredData.reduce((acc: any, curr) => {
                            const method = curr.methode_name || 'Unknown';
                            if (!acc[method]) acc[method] = { name: method, value: 0 };
                            acc[method].value += curr.revenue;
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
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">Metode Pembayaran (Transaksi)</h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">Distribusi jumlah transaksi per metode</p>
                    </div>
                    <div className="p-2.5 bg-violet-50 rounded-xl">
                      <ShoppingBag className="w-5 h-5 text-violet-600" />
                    </div>
                  </div>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.values(filteredData.reduce((acc: any, curr) => {
                            const method = curr.methode_name || 'Unknown';
                            if (!acc[method]) acc[method] = { name: method, value: 0 };
                            acc[method].value += 1;
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
                        <Tooltip formatter={(value: number) => formatNumber(value)} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Conversion Trend */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Tingkat Konversi</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Persentase transaksi dibanding downloader</p>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-rose-600" />
                  </div>
                </div>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        interval={filters.year === 'All' ? 2 : 0}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `${val.toFixed(1)}%`} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '12px' }}
                        formatter={(val: number) => [`${val.toFixed(2)}%`, 'Konversi']}
                      />
                      <Area type="monotone" dataKey="conversion" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
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

          {activeTab === 'calendar' && (
            <motion.div 
              key="calendar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PackageCalendar data={data} availableOptions={availableOptions} apps={apps} focusDate={calendarFocusDate} />
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

          {activeTab === 'monitoring' && (
            <motion.div
              key="monitoring"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <MonitoringSection
                data={filteredData}
                downloaderData={filteredDownloaderData}
                target={{
                  revenue: stats.totalTargetRevenue,
                  targetConversion: (() => {
                    const relevantApps = filters.source_app === 'All' ? apps : apps.filter(app => app.name.toUpperCase() === filters.source_app.toUpperCase());
                    const conversions = relevantApps.map(app => {
                      const monthKey = format(new Date(), 'yyyy-MM');
                      return app.targetConfig?.[monthKey]?.targetConversion || 0;
                    }).filter(c => c > 0);
                    return conversions.length > 0 ? conversions.reduce((a, b) => a + b, 0) / conversions.length : 5;
                  })(),
                  packages: apps.flatMap(app => {
                    const monthKey = format(new Date(), 'yyyy-MM');
                    const config = app.targetConfig?.[monthKey];
                    if (!config) return [];
                    return [{ active: true, price: config.avgPrice || 0 }];
                  })
                }}
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
              <SettingsSection onDataUpdate={handleDataUpdate} data={data} downloaderData={downloaderData} apps={apps} />
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

      {/* Footer */}
      <footer className="max-w-[1600px] mx-auto px-4 lg:px-12 py-8 lg:py-12 text-center border-t border-slate-100 mt-12 no-print">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">SiMarsel<span className="text-indigo-500">.</span></h3>
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Sales Analytics Dashboard - PT. Cerebrum Edukanesia</p>
          <p className="text-slate-300 text-[9px] font-medium mt-1">Data tersimpan secara lokal di browser Anda</p>
        </div>
      </footer>
    </div>
  </div>
  );
}
