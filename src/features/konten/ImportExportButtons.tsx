import { useState, type ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import { logger } from '../../lib/logger';
import {
  bulkInsertContentScripts,
  fetchContentScripts,
} from '../../lib/dataAccess';
import type {
  CarouselContent, ContentScript, ContentType, NewContentScript,
  SinglePostContent, VideoContent,
} from '../../types';

interface Props {
  platform: string;       // platform yang lagi aktif (lowercase)
  onImported: () => void; // callback refresh list
}

// ============================================================
// Helpers buat parse Excel (column mapping fleksibel — case-insensitive)
// ============================================================
const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, '');

function pick(row: Record<string, unknown>, keys: string[]): string {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(row)) map[norm(k)] = row[k];
  for (const k of keys) {
    const v = map[norm(k)];
    if (v != null && v !== '') return String(v);
  }
  return '';
}

function pickDate(row: Record<string, unknown>, keys: string[]): string | null {
  const v = pick(row, keys);
  if (!v) return null;
  // Excel kadang stored as serial number atau ISO atau "DD/MM/YYYY"
  if (/^\d+(\.\d+)?$/.test(v)) {
    const days = Number(v);
    const d = new Date(Math.round((days - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // Try parse "DD/MM/YYYY" or "DD-MM-YYYY"
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const [, dd, mm, yyyyRaw] = m;
    const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}

// Parse 1 row Excel → NewContentScript untuk type tertentu.
function rowToScript(
  row: Record<string, unknown>,
  platform: string,
  type: ContentType,
): NewContentScript | null {
  const title = pick(row, ['judul', 'libur/imports', 'libur/imports/judul', 'judul keyword', 'title', 'libur']);

  // Skip empty rows (semua kolom kosong)
  const hasAny = Object.values(row).some((v) => v != null && String(v).trim() !== '');
  if (!hasAny) return null;

  const scheduledDate = pickDate(row, ['tanggal upload', 'tgl upload', 'tanggal']);
  const tglTay = pickDate(row, ['tgl tay', 'tanggal tayang', 'tgltayang']);

  const infoSkrip = pick(row, ['info skrip', 'info']);
  const talent = pick(row, ['talent']);
  const editor = pick(row, ['editor', 'editor']);
  const poster = pick(row, ['poster']);
  const creative = pick(row, ['creative', 'creator']);
  const linkVideo = pick(row, ['link video', 'linkvideo', 'url video']);
  const linkCanva = pick(row, ['link canva', 'linkcanva', 'url canva']);
  const cc = pick(row, ['qc', 'cc']);
  const uploadStatus = pick(row, ['upload', 'upload status', 'status upload']);
  const linkKonten = pick(row, ['link konten', 'urlkonten', 'url konten']);
  const keterangan = pick(row, ['keterangan']);
  const catatan = pick(row, ['catatan']);

  // Type-specific content (untuk import sederhana, kita simpan minimal —
  // user bisa edit detail di drawer kalau perlu nambah field).
  let content: VideoContent | CarouselContent | SinglePostContent;
  if (type === 'video') {
    content = {
      kata_kunci: pick(row, ['kata kunci', 'keyword']),
      hook: pick(row, ['hook']),
      tahapan_1: pick(row, ['tahapan 1', 'tahapan1']),
      tahapan_2: pick(row, ['tahapan 2', 'tahapan2']),
      tahapan_3: pick(row, ['tahapan 3', 'tahapan3']),
      tahapan_4_cta: pick(row, ['tahapan 4', 'tahapan4', 'cta']),
      caption_tiktok: pick(row, ['caption tiktok', 'tiktok']),
      caption_instagram: pick(row, ['caption instagram', 'instagram', 'caption ig']),
    } as VideoContent;
  } else if (type === 'carousel') {
    // Coba ambil slide (bisa multiple kolom)
    const slidesText = pick(row, ['skrip', 'isi', 'tema']);
    content = {
      slides: slidesText ? [{ tema: '', skrip: slidesText, kpt: '' }] : [{ tema: '', skrip: '', kpt: '' }],
      caption: pick(row, ['caption']),
    } as CarouselContent;
  } else {
    content = {
      title_judul: title,
      sumber: pick(row, ['sumber']),
      image_ilustrasi: pick(row, ['ilustrasi', 'image', 'gambar']),
      isi: pick(row, ['isi']),
      cta: pick(row, ['cta']),
      keterangan: pick(row, ['keterangan']),
      caption: pick(row, ['caption']),
    } as SinglePostContent;
  }

  return {
    user_id: null,                           // diisi server kalau ada session
    platform: platform.toLowerCase(),
    type,
    scheduled_date: scheduledDate,
    tgl_tay: tglTay,
    title: title || null,
    status: 'draft',                         // import default Draft
    assigned_to: null,
    info_skrip: infoSkrip || null,
    talent: talent || null,
    editor: editor || null,
    poster: poster || null,
    creative: creative || null,
    link_video: linkVideo || null,
    link_canva: linkCanva || null,
    cc: cc || null,
    upload_status: uploadStatus || null,
    link_konten: linkKonten || null,
    keterangan: keterangan || null,
    catatan: catatan || null,
    content,
  };
}

// ============================================================
// Import handler
// ============================================================
async function handleImport(
  file: File,
  platform: string,
  toast: ReturnType<typeof useToast>,
): Promise<{ inserted: number; failed: number; skipped: number } | null> {
  // Lazy load xlsx supaya gak nambah initial bundle
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  let totalInserted = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // Heuristik: nama sheet → type. User bisa pakai sheet bernama
  // "VIDEO", "CAROUSEL", "SINGLE POST" / "POST".
  const typeFromSheet = (name: string): ContentType | null => {
    const u = name.toUpperCase();
    if (u.includes('VIDEO')) return 'video';
    if (u.includes('CAROUSEL')) return 'carousel';
    if (u.includes('POST') || u.includes('SINGLE')) return 'single_post';
    return null;
  };

  for (const sheetName of wb.SheetNames) {
    const type = typeFromSheet(sheetName);
    if (!type) {
      logger.info(`Skip sheet "${sheetName}" — bukan type yang dikenali`);
      continue;
    }
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const payloads: NewContentScript[] = [];
    for (const row of rows) {
      const script = rowToScript(row, platform, type);
      if (script) payloads.push(script);
      else totalSkipped += 1;
    }
    if (payloads.length === 0) continue;
    const result = await bulkInsertContentScripts(payloads);
    totalInserted += result.inserted;
    totalFailed += result.failed;
  }

  if (totalInserted === 0 && totalFailed === 0) {
    toast.error(
      'Tidak ada data ter-import',
      'Nama sheet harus mengandung kata "VIDEO", "CAROUSEL", atau "POST".',
    );
    return null;
  }

  toast.success(
    'Import selesai',
    `${totalInserted} skrip masuk · ${totalSkipped} baris kosong di-skip${totalFailed > 0 ? ` · ${totalFailed} gagal` : ''}`,
  );
  return { inserted: totalInserted, failed: totalFailed, skipped: totalSkipped };
}

// ============================================================
// Export handler
// ============================================================
async function handleExport(platform: string, toast: ReturnType<typeof useToast>) {
  const XLSX = await import('xlsx');
  const all = await fetchContentScripts({ platform });
  if (all.length === 0) {
    toast.error('Tidak ada data', `Belum ada skrip untuk platform ${platform}.`);
    return;
  }

  const byType: Record<ContentType, ContentScript[]> = {
    video: [],
    carousel: [],
    single_post: [],
  };
  all.forEach((s) => byType[s.type].push(s));

  const wb = XLSX.utils.book_new();

  // Untuk setiap type, build rows yang flat (baca dari content jsonb)
  const flattenVideo = (s: ContentScript) => {
    const c = s.content as VideoContent;
    return {
      'No Skrip': s.id.slice(0, 8),
      'Tanggal Buat': s.tgl_tay ?? '',
      'Tanggal Upload': s.scheduled_date ?? '',
      'USP/Keyword': s.title ?? '',
      'Status': s.status,
      'Info Skrip': s.info_skrip ?? '',
      'Talent': s.talent ?? '',
      'Editor': s.editor ?? '',
      'Poster': s.poster ?? '',
      'Creative': s.creative ?? '',
      'Link Video': s.link_video ?? '',
      'Link Canva': s.link_canva ?? '',
      'QC': s.cc ?? '',
      'Upload Status': s.upload_status ?? '',
      'Link Konten': s.link_konten ?? '',
      'Keterangan': s.keterangan ?? '',
      'Catatan': s.catatan ?? '',
      'Kata Kunci': c.kata_kunci ?? '',
      'Ad Group': c.ad_grup ?? '',
      'Link Contoh': c.link_contoh_video ?? '',
      'Visual Hook': c.visual_hook ?? '',
      'Hook': c.hook ?? '',
      'Tahapan 1': c.tahapan_1 ?? '',
      'Tahapan 2': c.tahapan_2 ?? '',
      'Tahapan 3': c.tahapan_3 ?? '',
      'Tahapan 4 (CTA)': c.tahapan_4_cta ?? '',
      'Footage': c.footage ?? '',
      'Caption TikTok': c.caption_tiktok ?? '',
      'Caption Instagram': c.caption_instagram ?? '',
    };
  };

  const flattenCarousel = (s: ContentScript) => {
    const c = s.content as CarouselContent;
    const slidesText = (c.slides ?? [])
      .map((sl, i) => `[${i + 1}] ${sl.tema ?? ''}\n${sl.skrip ?? ''}\n${sl.kpt ?? ''}`)
      .join('\n---\n');
    return {
      'No': s.id.slice(0, 8),
      'Tanggal Upload': s.scheduled_date ?? '',
      'Tgl Tayang': s.tgl_tay ?? '',
      'Judul': s.title ?? '',
      'Status': s.status,
      'Assigned': s.assigned_to ?? '',
      'Info Skrip': s.info_skrip ?? '',
      'Poster': s.poster ?? '',
      'Link Konten': s.link_konten ?? '',
      'Slides': slidesText,
      'Caption': c.caption ?? '',
      'Keterangan': s.keterangan ?? '',
      'Catatan': s.catatan ?? '',
    };
  };

  const flattenSinglePost = (s: ContentScript) => {
    const c = s.content as SinglePostContent;
    return {
      'No': s.id.slice(0, 8),
      'Tanggal Upload': s.scheduled_date ?? '',
      'Tgl Tayang': s.tgl_tay ?? '',
      'Judul': s.title ?? c.title_judul ?? '',
      'Status': s.status,
      'Assigned': s.assigned_to ?? '',
      'Sumber': c.sumber ?? '',
      'Image/Ilustrasi': c.image_ilustrasi ?? '',
      'Isi': c.isi ?? '',
      'CTA': c.cta ?? '',
      'Keterangan': c.keterangan ?? s.keterangan ?? '',
      'Caption': c.caption ?? '',
    };
  };

  if (byType.video.length > 0) {
    const ws = XLSX.utils.json_to_sheet(byType.video.map(flattenVideo));
    XLSX.utils.book_append_sheet(wb, ws, `VIDEO ${platform.toUpperCase()}`);
  }
  if (byType.carousel.length > 0) {
    const ws = XLSX.utils.json_to_sheet(byType.carousel.map(flattenCarousel));
    XLSX.utils.book_append_sheet(wb, ws, `CAROUSEL ${platform.toUpperCase()}`);
  }
  if (byType.single_post.length > 0) {
    const ws = XLSX.utils.json_to_sheet(byType.single_post.map(flattenSinglePost));
    XLSX.utils.book_append_sheet(wb, ws, `POST ${platform.toUpperCase()}`);
  }

  const filename = `konten-${platform}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);

  toast.success('Export berhasil', `${all.length} skrip diekspor ke ${filename}`);
}

// ============================================================
// Main button group component
// ============================================================
export const ImportExportButtons = ({ platform, onImported }: Props) => {
  const toast = useToast();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const onFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await handleImport(file, platform, toast);
      if (result && result.inserted > 0) onImported();
    } catch (err) {
      logger.error('Import gagal:', err);
      toast.error('Import gagal', err instanceof Error ? err.message : 'Cek format file.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all',
          'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-100',
          importing && 'opacity-50 cursor-wait',
        )}
      >
        <Upload className="w-3 h-3" />
        {importing ? 'Import…' : 'Import Excel'}
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={onFileSelected}
          disabled={importing}
          className="hidden"
        />
      </label>
      <button
        type="button"
        onClick={async () => {
          setExporting(true);
          try {
            await handleExport(platform, toast);
          } finally {
            setExporting(false);
          }
        }}
        disabled={exporting}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
          'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-100',
          exporting && 'opacity-50 cursor-wait',
        )}
      >
        <Download className="w-3 h-3" />
        {exporting ? 'Export…' : 'Export Excel'}
      </button>
    </div>
  );
};

export default ImportExportButtons;
