import { ChevronDown, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import type { AvailableOptions, Filters } from '../types';

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  availableOptions: AvailableOptions;
}

export const FilterSection = ({ filters, setFilters, availableOptions }: Props) => (
  <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-8">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-xl">
          <Filter className="w-5 h-5 text-indigo-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Filter Dashboard</h2>
      </div>
      <button
        onClick={() =>
          setFilters({ source_app: 'All', year: 'All', month: 'All', methode_name: 'All' })
        }
        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Reset Filter
      </button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Select
        label="Source App"
        value={filters.source_app}
        onChange={(v) => setFilters({ ...filters, source_app: v })}
      >
        <option value="All">Semua App</option>
        {availableOptions.source_apps.map((app) => (
          <option key={app} value={app}>
            {app}
          </option>
        ))}
      </Select>
      <Select
        label="Tahun"
        value={filters.year}
        onChange={(v) => setFilters({ ...filters, year: v })}
      >
        <option value="All">Semua Tahun</option>
        {availableOptions.years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
      <Select
        label="Bulan"
        value={filters.month}
        onChange={(v) => setFilters({ ...filters, month: v })}
      >
        <option value="All">Semua Bulan</option>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i} value={i + 1}>
            {format(new Date(2024, i, 1), 'MMMM')}
          </option>
        ))}
      </Select>
      <Select
        label="Metode Pembayaran"
        value={filters.methode_name}
        onChange={(v) => setFilters({ ...filters, methode_name: v })}
      >
        <option value="All">Semua Metode</option>
        {availableOptions.methods.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
    </div>
  </div>
);

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}

const Select = ({ label, value, onChange, children }: SelectProps) => (
  <div className="space-y-2">
    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
      {label}
    </label>
    <div className="relative group">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all appearance-none text-sm font-semibold text-slate-700"
      >
        {children}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-500 transition-colors" />
    </div>
  </div>
);

export default FilterSection;
