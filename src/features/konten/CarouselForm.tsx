import { Plus, Trash2 } from 'lucide-react';
import type { CarouselContent, CarouselSlide } from '../../types';

interface Props {
  value: CarouselContent;
  onChange: (next: CarouselContent) => void;
}

export const CarouselForm = ({ value, onChange }: Props) => {
  const slides = value.slides ?? [];

  const updateSlide = (idx: number, patch: Partial<CarouselSlide>) => {
    const next = slides.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, slides: next });
  };

  const addSlide = () => {
    onChange({
      ...value,
      slides: [...slides, { tema: '', skrip: '', kpt: '' }],
    });
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 1) return;
    if (!window.confirm(`Hapus Slide ${idx + 1}?`)) return;
    onChange({
      ...value,
      slides: slides.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          {slides.length} Slide{slides.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={addSlide}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
        >
          <Plus className="w-3 h-3" />
          Tambah Slide
        </button>
      </div>

      <div className="space-y-3">
        {slides.map((s, idx) => (
          <div
            key={idx}
            className="bg-slate-50 border border-slate-100 rounded-2xl p-4 relative group"
          >
            {/* Slide header */}
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 text-[11px] font-black tabular-nums">
                {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeSlide(idx)}
                disabled={slides.length <= 1}
                aria-label={`Hapus slide ${idx + 1}`}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tema</span>
                <input
                  value={s.tema ?? ''}
                  onChange={(e) => updateSlide(idx, { tema: e.target.value })}
                  placeholder="Tema/judul slide..."
                  className="form-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Skrip</span>
                <textarea
                  value={s.skrip ?? ''}
                  onChange={(e) => updateSlide(idx, { skrip: e.target.value })}
                  placeholder="Isi/copy slide..."
                  className="form-input min-h-[80px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">KPT (Visual / Catatan)</span>
                <textarea
                  value={s.kpt ?? ''}
                  onChange={(e) => updateSlide(idx, { kpt: e.target.value })}
                  className="form-input min-h-[60px]"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1 pt-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Caption (Untuk Postingan)
        </span>
        <textarea
          value={value.caption ?? ''}
          onChange={(e) => onChange({ ...value, caption: e.target.value })}
          className="form-input min-h-[100px]"
        />
      </label>
    </div>
  );
};

export default CarouselForm;
