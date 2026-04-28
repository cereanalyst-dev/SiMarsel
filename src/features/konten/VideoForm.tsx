import type { VideoContent } from '../../types';

interface Props {
  value: VideoContent;
  onChange: (next: VideoContent) => void;
}

const set = <K extends keyof VideoContent>(
  prev: VideoContent,
  key: K,
  v: VideoContent[K],
): VideoContent => ({ ...prev, [key]: v });

export const VideoForm = ({ value, onChange }: Props) => {
  const update = <K extends keyof VideoContent>(key: K, v: VideoContent[K]) => {
    onChange(set(value, key, v));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Kata Kunci" wide>
          <input value={value.kata_kunci ?? ''} onChange={(e) => update('kata_kunci', e.target.value)} className="form-input" placeholder="Try out, latihan, CPNS..." />
        </FormField>
        <FormField label="Ad Group">
          <input value={value.ad_grup ?? ''} onChange={(e) => update('ad_grup', e.target.value)} className="form-input" />
        </FormField>
        <FormField label="Link Contoh Video">
          <input value={value.link_contoh_video ?? ''} onChange={(e) => update('link_contoh_video', e.target.value)} className="form-input" placeholder="https://..." />
        </FormField>
        <FormField label="Visual Hook" wide>
          <textarea value={value.visual_hook ?? ''} onChange={(e) => update('visual_hook', e.target.value)} className="form-input min-h-[60px]" placeholder="Visual ide yang menarik di awal..." />
        </FormField>
        <FormField label="Hook (Kalimat Pembuka)" wide>
          <textarea value={value.hook ?? ''} onChange={(e) => update('hook', e.target.value)} className="form-input min-h-[60px]" />
        </FormField>
      </div>

      {/* 4 Tahapan */}
      <div className="space-y-3 pt-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Skrip — 4 Tahapan
        </p>
        <FormField label="Tahapan 1">
          <textarea value={value.tahapan_1 ?? ''} onChange={(e) => update('tahapan_1', e.target.value)} className="form-input min-h-[80px]" />
        </FormField>
        <FormField label="Tahapan 2">
          <textarea value={value.tahapan_2 ?? ''} onChange={(e) => update('tahapan_2', e.target.value)} className="form-input min-h-[80px]" />
        </FormField>
        <FormField label="Tahapan 3">
          <textarea value={value.tahapan_3 ?? ''} onChange={(e) => update('tahapan_3', e.target.value)} className="form-input min-h-[80px]" />
        </FormField>
        <FormField label="Tahapan 4 (CTA)">
          <textarea value={value.tahapan_4_cta ?? ''} onChange={(e) => update('tahapan_4_cta', e.target.value)} className="form-input min-h-[80px]" placeholder="Call-to-action di akhir video..." />
        </FormField>
      </div>

      {/* Bagian footage + caption */}
      <div className="space-y-3 pt-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Footage &amp; Caption
        </p>
        <FormField label="Footage / Visual">
          <textarea value={value.footage ?? ''} onChange={(e) => update('footage', e.target.value)} className="form-input min-h-[60px]" />
        </FormField>
        <FormField label="Keterangan Skrip">
          <textarea value={value.keterangan_skrip ?? ''} onChange={(e) => update('keterangan_skrip', e.target.value)} className="form-input min-h-[60px]" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Caption TikTok" wide>
            <textarea value={value.caption_tiktok ?? ''} onChange={(e) => update('caption_tiktok', e.target.value)} className="form-input min-h-[80px]" />
          </FormField>
          <FormField label="Caption Instagram" wide>
            <textarea value={value.caption_instagram ?? ''} onChange={(e) => update('caption_instagram', e.target.value)} className="form-input min-h-[80px]" />
          </FormField>
        </div>
      </div>
    </div>
  );
};

const FormField = ({ label, children, wide }: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) => (
  <label className={`flex flex-col gap-1 ${wide ? 'col-span-2' : ''}`}>
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
      {label}
    </span>
    {children}
  </label>
);

export default VideoForm;
