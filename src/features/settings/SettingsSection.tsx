import { useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { logger } from '../../lib/logger';
import { useToast } from '../../components/Toast';
import MarkazApiCard from './MarkazApiCard';

interface UploadProgress {
  current: number;
  total: number;
  label: string;
}

interface SettingsSectionProps {
  onDataUpdate: (
    transactions: unknown[],
    downloaders: unknown[],
    append: boolean,
    onProgress?: (p: UploadProgress) => void,
  ) => void | Promise<void>;
  detectedPlatforms?: string[];
}

export const SettingsSection = ({ onDataUpdate, detectedPlatforms = [] }: SettingsSectionProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const toast = useToast();

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress({ current: 0, total: 1, label: 'Membaca file Excel…' });
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buf = event.target?.result;
        if (!buf) throw new Error('Failed to read file');
        const workbook = XLSX.read(buf, { type: 'array' });

        let transactions: unknown[] = [];
        let downloaders: unknown[] = [];

        workbook.SheetNames.forEach((name) => {
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

        await onDataUpdate(
          transactions,
          downloaders,
          uploadMode === 'append',
          (p) => setProgress(p),
        );
        toast.success(
          uploadMode === 'append' ? 'Data berhasil ditambahkan' : 'Data berhasil diganti',
          `${transactions.length.toLocaleString('id-ID')} transaksi • ${downloaders.length.toLocaleString('id-ID')} downloader row`,
        );
      } catch (err) {
        logger.error('Upload error:', err);
        toast.error(
          'Gagal memproses file',
          'Pastikan format Excel benar dan ada sheet TRANSAKSI / DOWNLOADER.',
        );
      } finally {
        setIsUploading(false);
        setProgress(null);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      setProgress(null);
      toast.error('Gagal mengunggah file', 'Coba pilih file Excel lain.');
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-8">
      {/* Editorial header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              System
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Pengaturan Data
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Upload file Excel untuk mengganti atau menambah data transaksi &amp; downloader di database.
          </p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-1 h-12 rounded-full bg-gradient-to-b from-indigo-500 to-emerald-500" />
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">
              Langkah 1 — Pilih Mode
            </p>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Mode Upload
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <button
            onClick={() => setUploadMode('replace')}
            aria-pressed={uploadMode === 'replace'}
            className={cn(
              'p-6 rounded-3xl border-2 transition-all text-left group relative overflow-hidden',
              uploadMode === 'replace'
                ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-600 shadow-lg shadow-indigo-100'
                : 'bg-white border-slate-200 hover:border-slate-300',
            )}
          >
            {uploadMode === 'replace' && (
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            )}
            <div className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all',
              uploadMode === 'replace' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400',
            )}>
              <RefreshCw className="w-6 h-6" />
            </div>
            <h4 className={cn('text-sm font-black mb-1', uploadMode === 'replace' ? 'text-indigo-900' : 'text-slate-500')}>
              Ganti Data Total
            </h4>
            <p className={cn('text-xs font-medium leading-relaxed', uploadMode === 'replace' ? 'text-indigo-700/70' : 'text-slate-400')}>
              Hapus semua data lama di DB, lalu insert data baru. Cocok untuk refresh bulanan.
            </p>
          </button>

          <button
            onClick={() => setUploadMode('append')}
            aria-pressed={uploadMode === 'append'}
            className={cn(
              'p-6 rounded-3xl border-2 transition-all text-left group relative overflow-hidden',
              uploadMode === 'append'
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-500 shadow-lg shadow-emerald-100'
                : 'bg-white border-slate-200 hover:border-slate-300',
            )}
          >
            {uploadMode === 'append' && (
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
            <div className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all',
              uploadMode === 'append' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-400',
            )}>
              <Plus className="w-6 h-6" />
            </div>
            <h4 className={cn("text-sm font-black mb-1", uploadMode === 'append' ? "text-slate-900" : "text-slate-500")}>Tambah Data (Merge)</h4>
            <p className="text-xs text-slate-400 font-medium tracking-tight">Menambahkan data baru ke dalam database yang sudah ada saat ini.</p>
          </button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-1 h-12 rounded-full bg-gradient-to-b from-emerald-500 to-amber-500" />
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">
              Langkah 2 — Upload File
            </p>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Drop File Excel
            </h3>
          </div>
        </div>

        <div className="max-w-xl">
          <div
            className={cn(
              'p-12 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-center group transition-all cursor-pointer relative',
              uploadMode === 'replace'
                ? 'hover:border-indigo-300 hover:bg-indigo-50/30 border-slate-200 bg-slate-50/50'
                : 'hover:border-emerald-300 hover:bg-emerald-50/30 border-slate-200 bg-slate-50/50',
            )}
          >
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={isUploading}
              aria-label="Pilih file Excel"
            />
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {isUploading ? (
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              ) : uploadMode === 'replace' ? (
                <Download className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" />
              ) : (
                <Plus className="w-8 h-8 text-slate-400 group-hover:text-emerald-500" />
              )}
            </div>
            <h4 className="text-sm font-black text-slate-900 mb-1">
              {isUploading
                ? 'Memproses File...'
                : `Klik atau Drag file untuk ${uploadMode === 'replace' ? 'MENGGANTI' : 'MENAMBAH'} Data`}
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              Format: .xlsx atau .xls dengan sheet TRANSAKSI dan DOWNLOADER
            </p>
          </div>

          {/* Progress bar */}
          {progress && (
            <div className="mt-6 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                  {progress.label}
                </p>
                <p className="text-[11px] font-bold text-slate-500">
                  {progress.total > 0
                    ? `${Math.round((progress.current / progress.total) * 100)}%`
                    : ''}
                </p>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
                  style={{
                    width: `${
                      progress.total > 0
                        ? Math.min(100, (progress.current / progress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-2">
                {progress.current.toLocaleString('id-ID')} / {progress.total.toLocaleString('id-ID')}{' '}
                baris
              </p>
            </div>
          )}
        </div>
      </div>

      <MarkazApiCard detectedPlatforms={detectedPlatforms} />
    </div>
  );
};

export default SettingsSection;
