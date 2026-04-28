import type { SinglePostContent } from '../../types';

interface Props {
  value: SinglePostContent;
  onChange: (next: SinglePostContent) => void;
}

interface RowDef {
  key: keyof SinglePostContent;
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

const ROWS: RowDef[] = [
  { key: 'title_judul',      label: 'TITLE / JUDUL' },
  { key: 'sumber',           label: 'SUMBER',           placeholder: 'Sumber referensi/data...' },
  { key: 'image_ilustrasi',  label: 'IMAGE / ILUSTRASI', multiline: true, placeholder: 'Deskripsi visual atau URL gambar...' },
  { key: 'isi',              label: 'ISI',              multiline: true },
  { key: 'cta',              label: 'CTA',              multiline: true, placeholder: 'Ajakan untuk audience...' },
  { key: 'keterangan',       label: 'KETERANGAN',       multiline: true },
  { key: 'caption',          label: 'CAPTION',          multiline: true },
];

export const SinglePostForm = ({ value, onChange }: Props) => {
  const update = <K extends keyof SinglePostContent>(key: K, v: SinglePostContent[K]) => {
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
            <tr key={row.key} className="border-b border-slate-100 last:border-b-0">
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

export default SinglePostForm;
