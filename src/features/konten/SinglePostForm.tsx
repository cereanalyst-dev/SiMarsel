import type { SinglePostContent } from '../../types';

interface Props {
  value: SinglePostContent;
  onChange: (next: SinglePostContent) => void;
}

export const SinglePostForm = ({ value, onChange }: Props) => {
  const update = <K extends keyof SinglePostContent>(key: K, v: SinglePostContent[K]) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="space-y-3">
      <FormField label="Title / Judul">
        <input value={value.title_judul ?? ''} onChange={(e) => update('title_judul', e.target.value)} className="form-input" />
      </FormField>
      <FormField label="Sumber">
        <input value={value.sumber ?? ''} onChange={(e) => update('sumber', e.target.value)} className="form-input" placeholder="Sumber referensi/data..." />
      </FormField>
      <FormField label="Image / Ilustrasi">
        <textarea value={value.image_ilustrasi ?? ''} onChange={(e) => update('image_ilustrasi', e.target.value)} className="form-input min-h-[60px]" placeholder="Deskripsi visual atau URL gambar..." />
      </FormField>
      <FormField label="Isi (Content Body)">
        <textarea value={value.isi ?? ''} onChange={(e) => update('isi', e.target.value)} className="form-input min-h-[140px]" />
      </FormField>
      <FormField label="CTA (Call-to-Action)">
        <textarea value={value.cta ?? ''} onChange={(e) => update('cta', e.target.value)} className="form-input min-h-[60px]" placeholder="Ajakan untuk audience..." />
      </FormField>
      <FormField label="Keterangan">
        <textarea value={value.keterangan ?? ''} onChange={(e) => update('keterangan', e.target.value)} className="form-input min-h-[60px]" />
      </FormField>
      <FormField label="Caption (Untuk Postingan)">
        <textarea value={value.caption ?? ''} onChange={(e) => update('caption', e.target.value)} className="form-input min-h-[100px]" />
      </FormField>
    </div>
  );
};

const FormField = ({ label, children }: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
      {label}
    </span>
    {children}
  </label>
);

export default SinglePostForm;
