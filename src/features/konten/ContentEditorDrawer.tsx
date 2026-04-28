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
  const [assignedTo, setAssignedTo] = useState('');
  const [infoSkrip, setInfoSkrip] = useState('');
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
      setAssignedTo(existing.assigned_to ?? '');
      setInfoSkrip(existing.info_skrip ?? '');
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
      setAssignedTo('');
      setInfoSkrip('');
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
      assigned_to: assignedTo || null,
      info_skrip: infoSkrip || null,
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
                    {isNew ? 'Skrip Baru' : 'Edit Skrip'}
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
              {/* META: platform, type, dates, status, assigned */}
              <Section label="Metadata">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Platform">
                    <input
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value.toLowerCase())}
                      placeholder="jadiasn"
                      className="form-input"
                    />
                  </Field>
                  <Field label="Tipe Konten">
                    <select
                      value={type}
                      onChange={(e) => handleTypeChange(e.target.value as ContentType)}
                      className="form-input"
                    >
                      <option value="video">Video</option>
                      <option value="carousel">Carousel</option>
                      <option value="single_post">Single Post</option>
                    </select>
                  </Field>
                  <Field label="Tanggal Upload">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Tanggal Tayang">
                    <input
                      type="date"
                      value={tglTay}
                      onChange={(e) => setTglTay(e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Status" wide>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ContentStatus)}
                      className="form-input"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.toUpperCase()}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Assigned To" wide>
                    <input
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      placeholder="email rekan tim..."
                      className="form-input"
                    />
                  </Field>
                </div>
              </Section>

              <Section label="Info Operasional">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Judul / Keyword Utama" wide>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Try Out CPNS — Live IG"
                      className="form-input"
                    />
                  </Field>
                  <Field label="Info Skrip" wide>
                    <input
                      value={infoSkrip}
                      onChange={(e) => setInfoSkrip(e.target.value)}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Poster (URL/Catatan)">
                    <input value={poster} onChange={(e) => setPoster(e.target.value)} className="form-input" />
                  </Field>
                  <Field label="Creative">
                    <input value={creative} onChange={(e) => setCreative(e.target.value)} className="form-input" />
                  </Field>
                  <Field label="Link Video">
                    <input value={linkVideo} onChange={(e) => setLinkVideo(e.target.value)} className="form-input" placeholder="https://..." />
                  </Field>
                  <Field label="Link Canva">
                    <input value={linkCanva} onChange={(e) => setLinkCanva(e.target.value)} className="form-input" placeholder="https://..." />
                  </Field>
                  <Field label="CC / Catatan Internal">
                    <input value={cc} onChange={(e) => setCc(e.target.value)} className="form-input" />
                  </Field>
                  <Field label="Upload Status">
                    <input value={uploadStatus} onChange={(e) => setUploadStatus(e.target.value)} className="form-input" placeholder="DONE, PROGRESS..." />
                  </Field>
                  <Field label="Link Konten Final" wide>
                    <input value={linkKonten} onChange={(e) => setLinkKonten(e.target.value)} className="form-input" placeholder="https://..." />
                  </Field>
                  <Field label="Keterangan" wide>
                    <textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} className="form-input min-h-[60px]" />
                  </Field>
                  <Field label="Catatan" wide>
                    <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} className="form-input min-h-[60px]" />
                  </Field>
                </div>
              </Section>

              {/* Type-specific section */}
              {type === 'video' && (
                <Section label="Skrip Video (4 Tahapan)">
                  <VideoForm value={videoContent} onChange={setVideoContent} />
                </Section>
              )}
              {type === 'carousel' && (
                <Section label="Skrip Carousel (Slides Dinamis)">
                  <CarouselForm value={carouselContent} onChange={setCarouselContent} />
                </Section>
              )}
              {type === 'single_post' && (
                <Section label="Skrip Single Post">
                  <SinglePostForm value={singlePostContent} onChange={setSinglePostContent} />
                </Section>
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
// Helper subcomponents
// ============================================================

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5">
    <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] mb-4">
      {label}
    </p>
    {children}
  </div>
);

const Field = ({ label, children, wide }: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <label className={cn('flex flex-col gap-1', wide && 'col-span-2')}>
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
      {label}
    </span>
    {children}
  </label>
);

export default ContentEditorDrawer;
