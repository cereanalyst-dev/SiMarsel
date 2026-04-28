import type { ContentScript, ContentType } from '../../types';

// Placeholder — full form akan di-implement di Commit 3.

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing: ContentScript | null;
  defaultPlatform: string;
  defaultType: ContentType;
}

export const ContentEditorDrawer = ({ open, onClose }: Props) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog">
      <div
        className="flex-1 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="w-full md:w-[60%] lg:w-[55%] bg-white shadow-2xl overflow-y-auto p-8">
        <div className="text-center py-12">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Editor coming in commit 3
          </p>
          <p className="text-[10px] font-medium text-slate-300 mt-2">
            Form template akan ditambahkan di langkah berikutnya.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentEditorDrawer;
