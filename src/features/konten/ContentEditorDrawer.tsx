import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Save, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import { getSupabase } from '../../lib/supabase';
import {
  createContentScript,
  updateContentScript,
} from '../../lib/dataAccess';
import type {
  CarouselContent, ContentScript, ContentStatus, ContentType,
  NewContentScript, SinglePostContent, VideoContent,
} from '../../types';
import VideoForm from './VideoForm';
import CarouselForm from './CarouselForm';
import SinglePostForm from './SinglePostForm';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing: ContentScript | null;       // null = create new
  defaultPlatform: string;
  defaultType: ContentType;
}

const STATUS_OPTIONS: ContentStatus[] = ['draft', 'review', 'approved', 'published'];

export const ContentEditorDrawer = ({
  open, onClose, onSaved, existing, defaultPlatform, defaultType,
}: Props) => {
  const toast = useToast();
  const isNew = !existing;

  // Form state
  const [platform, setPlatform] = useState(defaultPlatform);
  const [type, setType] = useState<ContentType>(defaultType);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [tglTay, setTglTay] = useState<string>('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ContentStatus>('draft');
  const [infoSkrip, setInfoSkrip] = useState('');
  const [talent, setTalent] = useState('');
  const [editor, setEditor] = useState('');
  const [poster, setPoster] = useState('');
  const [creative, setCreative] = useState('');
  const [linkVideo, setLinkVideo] = useState('');
  const [linkCanva, setLinkCanva] = useState('');
  const [cc, setCc] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [linkKonten, setLinkKonten] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [catatan, setCatatan] = useState('');

  // Content per type
  const [videoContent, setVideoContent] = useState<VideoContent>({});
  const [carouselContent, setCarouselContent] = useState<CarouselContent>({
    slides: [{ tema: '', skrip: '', kpt: '' }],
    caption: '',
  });
  const [singlePostContent, setSinglePostContent] = useState<SinglePostContent>({});

  const [saving, setSaving] = useState(false);

  // Reset form pas existing/defaults berubah
  useEffect(() => {
    if (existing) {
      setPlatform(existing.platform);
      setType(existing.type);
      setScheduledDate(existing.scheduled_date ?? '');
      setTglTay(existing.tgl_tay ?? '');
      setTitle(existing.title ?? '');
      setStatus(existing.status);
      setInfoSkrip(existing.info_skrip ?? '');
      setTalent(existing.talent ?? '');
      setEditor(existing.editor ?? '');
      setPoster(existing.poster ?? '');
      setCreative(existing.creative ?? '');
      setLinkVideo(existing.link_video ?? '');
      setLinkCanva(existing.link_canva ?? '');
      setCc(existing.cc ?? '');
      setUploadStatus(existing.upload_status ?? '');
      setLinkKonten(existing.link_konten ?? '');
      setKeterangan(existing.keterangan ?? '');
      setCatatan(existing.catatan ?? '');
      // Cast content sesuai type
      if (existing.type === 'video') {
        setVideoContent(existing.content as VideoContent);
      } else if (existing.type === 'carousel') {
        const c = existing.content as CarouselContent;
        setCarouselContent({
          slides: Array.isArray(c.slides) && c.slides.length > 0
            ? c.slides
            : [{ tema: '', skrip: '', kpt: '' }],
          caption: c.caption ?? '',
        });
      } else if (existing.type === 'single_post') {
        setSinglePostContent(existing.content as SinglePostContent);
      }
    } else {
      // New script — reset ke default
      setPlatform(defaultPlatform);
      setType(defaultType);
      setScheduledDate('');
      setTglTay('');
      setTitle('');
      setStatus('draft');
      setInfoSkrip('');
      setTalent('');
      setEditor('');
      setPoster('');
      setCreative('');
      setLinkVideo('');
      setLinkCanva('');
      setCc('');
      setUploadStatus('');
      setLinkKonten('');
      setKeterangan('');
      setCatatan('');
      setVideoContent({});
      setCarouselContent({ slides: [{ tema: '', skrip: '', kpt: '' }], caption: '' });
      setSinglePostContent({});
    }
  }, [existing, defaultPlatform, defaultType, open]);

  const handleTypeChange = (t: ContentType) => {
    setType(t);
    // Reset content saat ganti type biar gak mismatch
    if (t === 'video' && Object.keys(videoContent).length === 0) {
      setVideoContent({});
    }
    if (t === 'carousel' && carouselContent.slides.length === 0) {
      setCarouselContent({ slides: [{ tema: '', skrip: '', kpt: '' }], caption: '' });
    }
    if (t === 'single_post' && Object.keys(singlePostContent).length === 0) {
      setSinglePostContent({});
    }
  };

  const handleSave = async () => {
    if (!platform.trim()) {
      toast.error('Platform wajib diisi');
      return;
    }
    setSaving(true);

    let contentPayload: VideoContent | CarouselContent | SinglePostContent;
    if (type === 'video') contentPayload = videoContent;
    else if (type === 'carousel') contentPayload = carouselContent;
    else contentPayload = singlePostContent;

    // Get current user_id (kalau ada session)
    const supabase = getSupabase();
    let userId: string | null = null;
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? null;
    }

    const payload: NewContentScript = {
      user_id: userId,
      platform: platform.trim().toLowerCase(),
      type,
      scheduled_date: scheduledDate || null,
      tgl_tay: tglTay || null,
      title: title || null,
      status,
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
      content: contentPayload,
    };

    try {
      const result = isNew
        ? await createContentScript(payload)
        : await updateContentScript(existing!.id, payload);

      if (result) {
        toast.success(isNew ? 'Skrip dibuat' : 'Skrip diperbarui');
        onSaved();
      } else {
        toast.error('Gagal simpan skrip');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <button
            type="button"
            className="flex-1 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Tutup editor"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="w-full md:w-[60%] lg:w-[55%] xl:w-[50%] bg-slate-50 shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-1 h-8 rounded-full bg-gradient-to-b from-rose-500 to-pink-500',
                )} />
                <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">
                    {isNew ? 'Buat Skrip Baru' : 'Lihat / Edit Skrip'}
                  </p>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    {title || 'Tanpa Judul'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* SHEET 1: METADATA UTAMA — sama dengan kolom paling kiri di Sheets list */}
              <SheetSection label="Metadata Utama">
                <table className="w-full border-collapse table-fixed">
                  <tbody>
                    <SheetRow label="PLATFORM">
                      <input
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value.toLowerCase())}
                        placeholder="jadiasn, cerebrum, jadibumn..."
                        className="sheet-cell"
                      />
                    </SheetRow>
                    <SheetRow label="TIPE KONTEN">
                      <select
                        value={type}
                        onChange={(e) => handleTypeChange(e.target.value as ContentType)}
                        className="sheet-cell"
                      >
                        <option value="video">Video</option>
                        <option value="carousel">Carousel</option>
                        <option value="single_post">Single Post</option>
                      </select>
                    </SheetRow>
                    <SheetRow label="TANGGAL BUAT">
                      <input
                        type="date"
                        value={tglTay}
                        onChange={(e) => setTglTay(e.target.value)}
                        className="sheet-cell"
                      />
                    </SheetRow>
                    <SheetRow label="TANGGAL UPLOAD">
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="sheet-cell"
                      />
                    </SheetRow>
                    <SheetRow label="JUDUL">
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Try Out CPNS — Live IG..."
                        className="sheet-cell"
                      />
                    </SheetRow>
                    <SheetRow label="STATUS">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ContentStatus)}
                        className="sheet-cell"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.toUpperCase()}</option>
                        ))}
                      </select>
                    </SheetRow>
                  </tbody>
                </table>
              </SheetSection>

              {/* SHEET 2: INFO OPERASIONAL */}
              <SheetSection label="Info Operasional">
                <table className="w-full border-collapse table-fixed">
                  <tbody>
                    <SheetRow label="INFO SKRIP">
                      <select value={infoSkrip} onChange={(e) => setInfoSkrip(e.target.value)} className="sheet-cell">
                        <option value="">—</option>
                        <option value="progress">PROGRESS</option>
                        <option value="skrip ready">SKRIP READY</option>
                        <option value="skrip urgent">SKRIP URGENT</option>
                      </select>
                    </SheetRow>
                    <SheetRow label="TALENT">
                      <select value={talent} onChange={(e) => setTalent(e.target.value)} className="sheet-cell">
                        <option value="">—</option>
                        <option value="analisis">ANALISIS</option>
                        <option value="take">TAKE</option>
                        <option value="done">DONE</option>
                      </select>
                    </SheetRow>
                    <SheetRow label="EDITOR">
                      <input value={editor} onChange={(e) => setEditor(e.target.value)} className="sheet-cell" placeholder="Nama editor..." />
                    </SheetRow>
                    <SheetRow label="POSTER">
                      <input value={poster} onChange={(e) => setPoster(e.target.value)} className="sheet-cell" placeholder="URL atau deskripsi..." />
                    </SheetRow>
                    <SheetRow label="CREATIVE">
                      <select value={creative} onChange={(e) => setCreative(e.target.value)} className="sheet-cell">
                        <option value="">—</option>
                        <option value="progress">PROGRESS</option>
                        <option value="editing">EDITING</option>
                        <option value="done">DONE</option>
                      </select>
                    </SheetRow>
                    <SheetRow label="LINK VIDEO">
                      <input value={linkVideo} onChange={(e) => setLinkVideo(e.target.value)} className="sheet-cell" placeholder="https://..." />
                    </SheetRow>
                    <SheetRow label="LINK CANVA">
                      <input value={linkCanva} onChange={(e) => setLinkCanva(e.target.value)} className="sheet-cell" placeholder="https://..." />
                    </SheetRow>
                    <SheetRow label="QC">
                      <select value={cc} onChange={(e) => setCc(e.target.value)} className="sheet-cell">
                        <option value="">—</option>
                        <option value="revisi">REVISI</option>
                        <option value="done">DONE</option>
                        <option value="cancel">CANCEL</option>
                      </select>
                    </SheetRow>
                    <SheetRow label="UPLOAD STATUS">
                      <input value={uploadStatus} onChange={(e) => setUploadStatus(e.target.value)} className="sheet-cell" placeholder="DONE, PROGRESS..." />
                    </SheetRow>
                    <SheetRow label="LINK KONTEN">
                      <input value={linkKonten} onChange={(e) => setLinkKonten(e.target.value)} className="sheet-cell" placeholder="https://..." />
                    </SheetRow>
                    <SheetRow label="KETERANGAN">
                      <textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="sheet-cell" />
                    </SheetRow>
                    <SheetRow label="CATATAN">
                      <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} className="sheet-cell" />
                    </SheetRow>
                  </tbody>
                </table>
              </SheetSection>

              {/* SHEET 3: TEMPLATE SKRIP per type */}
              {type === 'video' && (
                <SheetSection label={`Skrip Video — ${platform.toUpperCase()}`}>
                  <VideoForm value={videoContent} onChange={setVideoContent} />
                </SheetSection>
              )}
              {type === 'carousel' && (
                <SheetSection label={`Skrip Carousel — ${platform.toUpperCase()}`}>
                  <CarouselForm value={carouselContent} onChange={setCarouselContent} />
                </SheetSection>
              )}
              {type === 'single_post' && (
                <SheetSection label={`Skrip Single Post — ${platform.toUpperCase()}`}>
                  <SinglePostForm value={singlePostContent} onChange={setSinglePostContent} />
                </SheetSection>
              )}

              {/* Action buttons */}
              <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all',
                    'bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100',
                    'disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed',
                  )}
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Menyimpan…' : isNew ? 'Buat Skrip' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================
// Helper subcomponents — spreadsheet-style
// ============================================================

const SheetSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className="w-1 h-4 rounded-full bg-rose-500" />
      <p className="text-[11px] font-black text-rose-600 uppercase tracking-[0.2em]">
        {label}
      </p>
    </div>
    {children}
  </div>
);

const SheetRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <tr className="border-b border-slate-100 last:border-b-0 bg-white">
    <td className="text-[10px] font-black text-slate-700 uppercase tracking-widest px-4 py-2 align-top w-[180px] border-r border-slate-100 bg-slate-50/40 border border-slate-200">
      {label}
    </td>
    <td className="p-0 align-top border border-slate-200">
      {children}
    </td>
  </tr>
);

export default ContentEditorDrawer;
