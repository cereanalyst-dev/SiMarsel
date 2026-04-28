import { Plus, Trash2 } from 'lucide-react';
import type { CarouselContent, CarouselSlide } from '../../types';

interface Props {
  value: CarouselContent;
  onChange: (next: CarouselContent) => void;
}

// Layout spreadsheet horizontal — kayak Sheets:
// header: SLIDE | TEMA | SKRIP | KPT
// rows: setiap slide (1, 2, 3, ...)
// caption umum di bawah (full-width baris terpisah)

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

      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-3 py-3 text-left w-[80px] border-r border-slate-200">
                Slide
              </th>
              <th className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 py-3 text-left w-[200px] border-r border-slate-200">
                Tema
              </th>
              <th className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 py-3 text-left border-r border-slate-200">
                Skrip
              </th>
              <th className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 py-3 text-left w-[200px] border-r border-slate-200">
                KPT
              </th>
              <th className="w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {slides.map((s, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                <td className="text-[11px] font-black text-violet-700 px-3 py-2 align-top text-center border-r border-slate-100 bg-violet-50/40 tabular-nums">
                  {idx + 1}
                </td>
                <td className="p-0 align-top border-r border-slate-100">
                  <input
                    value={s.tema ?? ''}
                    onChange={(e) => updateSlide(idx, { tema: e.target.value })}
                    placeholder="Tema/judul slide..."
                    className="sheet-cell"
                  />
                </td>
                <td className="p-0 align-top border-r border-slate-100">
                  <textarea
                    value={s.skrip ?? ''}
                    onChange={(e) => updateSlide(idx, { skrip: e.target.value })}
                    placeholder="Isi/copy slide..."
                    className="sheet-cell"
                  />
                </td>
                <td className="p-0 align-top border-r border-slate-100">
                  <textarea
                    value={s.kpt ?? ''}
                    onChange={(e) => updateSlide(idx, { kpt: e.target.value })}
                    placeholder="Visual / catatan..."
                    className="sheet-cell"
                  />
                </td>
                <td className="px-1 py-2 align-top text-center">
                  <button
                    type="button"
                    onClick={() => removeSlide(idx)}
                    disabled={slides.length <= 1}
                    aria-label={`Hapus slide ${idx + 1}`}
                    className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Caption row terpisah — full width */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
        <table className="w-full border-collapse table-fixed">
          <tbody>
            <tr>
              <td className="text-[10px] font-black text-slate-700 uppercase tracking-widest px-4 py-2 align-top w-[200px] border-r border-slate-100 bg-slate-50/40">
                CAPTION
              </td>
              <td className="p-0 align-top">
                <textarea
                  value={value.caption ?? ''}
                  onChange={(e) => onChange({ ...value, caption: e.target.value })}
                  placeholder="Caption untuk postingan..."
                  className="sheet-cell"
                  style={{ minHeight: 100 }}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CarouselForm;
