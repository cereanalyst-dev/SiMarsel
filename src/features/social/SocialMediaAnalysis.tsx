import { useMemo, useState } from 'react';
import { format, parse } from 'date-fns';
import { Calendar, Search, Smartphone } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../lib/formatters';
import type { AppData } from '../../types';

export const SocialMediaAnalysis = ({ 
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

export default SocialMediaAnalysis;
