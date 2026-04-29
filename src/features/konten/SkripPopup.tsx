import { AnimatePresence, motion } from 'motion/react';
import { Edit2, Film, Image as ImageIcon, Layers, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import type {
  CarouselContent, ContentScript, SinglePostContent, VideoContent,
} from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onEdit: (s: ContentScript) => void;        // klik tombol Edit → buka full drawer
  script: ContentScript | null;
}

const TYPE_META = {
  video:       { label: 'Video',        icon: Film,        accent: 'rose' },
  carousel:    { label: 'Carousel',     icon: Layers,      accent: 'violet' },
  single_post: { label: 'Single Post',  icon: ImageIcon,   accent: 'cyan' },
} as const;

// Banner kecil read-only buat preview cepat skrip — gak menampilkan
// metadata operasional / status / dropdown. Cuma isi skripnya saja.
// Klik 'Edit Lengkap' untuk masuk ke drawer editor full.
export const SkripPopup = ({ open, onClose, onEdit, script }: Props) => {
  return (
    <AnimatePresence>
      {open && script && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Tutup popup"
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto"
          >
            <SkripCardHeader script={script} onClose={onClose} />

            <div className="px-7 pb-7 space-y-5">
              {script.type === 'video' && (
                <VideoSkripBody content={script.content as VideoContent} />
              )}
              {script.type === 'carousel' && (
                <CarouselSkripBody content={script.content as CarouselContent} />
              )}
              {script.type === 'single_post' && (
                <SinglePostSkripBody content={script.content as SinglePostContent} />
              )}

              {/* Footer action */}
              <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400">
                  Preview read-only · klik Edit untuk ubah skrip
                </p>
                <button
                  type="button"
                  onClick={() => onEdit(script)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-100 transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Lengkap
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
// Header card
// ============================================================
function SkripCardHeader({ script, onClose }: { script: ContentScript; onClose: () => void }) {
  const meta = TYPE_META[script.type];
  const Icon = meta.icon;
  const dateStr = script.scheduled_date
    ? format(new Date(script.scheduled_date), 'dd MMM yyyy')
    : null;

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-7 py-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-4 min-w-0">
        <div className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
          `bg-${meta.accent}-100 text-${meta.accent}-700`,
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={cn(
              'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md',
              `bg-${meta.accent}-50 text-${meta.accent}-700 border border-${meta.accent}-100`,
            )}>
              {meta.label}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              {script.platform.toUpperCase()}
            </span>
            {dateStr && (
              <span className="text-[9px] font-bold text-slate-500">
                · Upload: {dateStr}
              </span>
            )}
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
            {script.title || 'Tanpa Judul'}
          </h3>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 flex-shrink-0"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ============================================================
// Body per type (read-only)
// ============================================================
function VideoSkripBody({ content }: { content: VideoContent }) {
  const rows: { label: string; value?: string; highlight?: boolean }[] = [
    { label: 'Kata Kunci', value: content.kata_kunci },
    { label: 'Hook', value: content.hook },
    { label: 'Tahapan 1', value: content.tahapan_1, highlight: true },
    { label: 'Tahapan 2', value: content.tahapan_2, highlight: true },
    { label: 'Tahapan 3', value: content.tahapan_3, highlight: true },
    { label: 'Tahapan 4 (CTA)', value: content.tahapan_4_cta, highlight: true },
    { label: 'Footage / Visual', value: content.footage },
    { label: 'Caption TikTok', value: content.caption_tiktok },
    { label: 'Caption Instagram', value: content.caption_instagram },
  ];

  return (
    <>
      {rows.map((r) => <SkripField key={r.label} {...r} />)}
    </>
  );
}

function CarouselSkripBody({ content }: { content: CarouselContent }) {
  const slides = content.slides ?? [];
  return (
    <>
      <div className="space-y-3">
        {slides.length === 0 && (
          <p className="text-xs text-slate-400 italic text-center py-6">Belum ada slide</p>
        )}
        {slides.map((s, idx) => (
          <div key={idx} className="bg-violet-50/50 border border-violet-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-violet-200 text-violet-800 text-[10px] font-black tabular-nums">
                {idx + 1}
              </span>
              {s.tema && (
                <span className="text-[11px] font-black text-violet-900">{s.tema}</span>
              )}
            </div>
            {s.skrip && (
              <p className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed mb-1.5">
                {s.skrip}
              </p>
            )}
            {s.kpt && (
              <p className="text-[10px] text-slate-500 italic">KPT: {s.kpt}</p>
            )}
          </div>
        ))}
      </div>
      <SkripField label="Caption" value={content.caption} />
    </>
  );
}

function SinglePostSkripBody({ content }: { content: SinglePostContent }) {
  const rows = [
    { label: 'Title / Judul', value: content.title_judul },
    { label: 'Sumber', value: content.sumber },
    { label: 'Image / Ilustrasi', value: content.image_ilustrasi },
    { label: 'Isi', value: content.isi, highlight: true },
    { label: 'CTA', value: content.cta, highlight: true },
    { label: 'Caption', value: content.caption },
  ];
  return (
    <>
      {rows.map((r) => <SkripField key={r.label} {...r} />)}
    </>
  );
}

// ============================================================
// Field row
// ============================================================
function SkripField({ label, value, highlight }: {
  label: string;
  value?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-2xl border p-4',
      highlight ? 'bg-rose-50/40 border-rose-100' : 'bg-slate-50/40 border-slate-100',
    )}>
      <p className={cn(
        'text-[10px] font-black uppercase tracking-widest mb-1.5',
        highlight ? 'text-rose-700' : 'text-slate-500',
      )}>
        {label}
      </p>
      {value ? (
        <p className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed">
          {value}
        </p>
      ) : (
        <p className="text-[11px] text-slate-300 italic">— belum diisi</p>
      )}
    </div>
  );
}

export default SkripPopup;
