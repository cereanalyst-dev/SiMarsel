import type { VideoContent } from '../../types';

interface Props {
  value: VideoContent;
  onChange: (next: VideoContent) => void;
}

// Layout spreadsheet 2-kolom: Field di kiri, value di kanan.
// Terminologi mengikuti Sheets asli (KATA KUNCI, ADS GRUP, TAHAPAN, dll).

interface RowDef {
  key: keyof VideoContent;
  label: string;
  multiline?: boolean;
  placeholder?: string;
  highlight?: 'tahapan' | 'caption';
}

const ROWS: RowDef[] = [
  { key: 'kata_kunci',         label: 'KATA KUNCI',          placeholder: 'Try out, latihan, CPNS...' },
  { key: 'ad_grup',            label: 'ADS GRUP' },
  { key: 'link_contoh_video',  label: 'LINK CONTOH VIDEO',   placeholder: 'https://...' },
  { key: 'visual_hook',        label: 'VISUAL HOOK',         multiline: true, placeholder: 'Visual ide menarik di awal...' },
  { key: 'hook',               label: 'HOOK',                multiline: true },
  { key: 'tahapan_1',          label: 'TAHAPAN 1',           multiline: true, highlight: 'tahapan' },
  { key: 'tahapan_2',          label: 'TAHAPAN 2',           multiline: true, highlight: 'tahapan' },
  { key: 'tahapan_3',          label: 'TAHAPAN 3',           multiline: true, highlight: 'tahapan' },
  { key: 'tahapan_4_cta',      label: 'TAHAPAN 4 (CTA)',     multiline: true, highlight: 'tahapan', placeholder: 'Call-to-action di akhir video...' },
  { key: 'footage',            label: 'FOOTAGE',             multiline: true },
  { key: 'keterangan_skrip',   label: 'KETERANGAN',          multiline: true },
  { key: 'caption_tiktok',     label: 'CAPTION TIKTOK',      multiline: true, highlight: 'caption' },
  { key: 'caption_instagram',  label: 'CAPTION INSTAGRAM',   multiline: true, highlight: 'caption' },
];

const HIGHLIGHT_BG: Record<string, string> = {
  tahapan: 'bg-rose-50/30',
  caption: 'bg-amber-50/30',
};

export const VideoForm = ({ value, onChange }: Props) => {
  const update = <K extends keyof VideoContent>(key: K, v: VideoContent[K]) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="bg-slate-50 border-b-2 border-slate-200">
            <th className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 py-3 text-left w-[200px] border-r border-slate-200">
              Field
            </th>
            <th className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 py-3 text-left">
              Skrip 1
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr
              key={row.key}
              className={`border-b border-slate-100 last:border-b-0 ${row.highlight ? HIGHLIGHT_BG[row.highlight] : ''}`}
            >
              <td className="text-[10px] font-black text-slate-700 uppercase tracking-widest px-4 py-2 align-top border-r border-slate-100 bg-slate-50/40">
                {row.label}
              </td>
              <td className="p-0 align-top">
                {row.multiline ? (
                  <textarea
                    value={(value[row.key] as string) ?? ''}
                    onChange={(e) => update(row.key, e.target.value)}
                    placeholder={row.placeholder ?? '—'}
                    className="sheet-cell"
                  />
                ) : (
                  <input
                    type="text"
                    value={(value[row.key] as string) ?? ''}
                    onChange={(e) => update(row.key, e.target.value)}
                    placeholder={row.placeholder ?? '—'}
                    className="sheet-cell"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VideoForm;
