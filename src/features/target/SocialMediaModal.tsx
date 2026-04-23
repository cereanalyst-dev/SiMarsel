import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { MessageSquare, Plus } from 'lucide-react';
import type { SocialMediaContent } from '../../types';

export const SocialMediaModal = ({ 
  isOpen, 
  onClose, 
  date, 
  content, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  date: string; 
  content: SocialMediaContent[]; 
  onSave: (newContent: SocialMediaContent[]) => void;
}) => {
  const [localContent, setLocalContent] = useState<SocialMediaContent[]>(content || []);

  useEffect(() => {
    setLocalContent(content || []);
  }, [content, isOpen]);

  if (!isOpen) return null;

  const addContent = () => {
    setLocalContent([...localContent, {
      platform: 'Instagram',
      postingTime: '10:00',
      contentType: 'Feed',
      title: '',
      caption: '',
      cta: '',
      topic: '',
      reach: 0,
      engagement: 0,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      hook: '',
      link: '',
      objective: 'Awareness'
    }]);
  };

  const updateContent = (index: number, field: keyof SocialMediaContent, value: any) => {
    const updated = [...localContent];
    updated[index] = { ...updated[index], [field]: value };
    setLocalContent(updated);
  };

  const removeContent = (index: number) => {
    setLocalContent(localContent.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Input Konten Sosial Media</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">{format(new Date(date), 'dd MMMM yyyy')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup modal input konten sosial media"
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5 text-slate-400 rotate-45" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {localContent.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
              <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-400">Belum ada konten sosial media untuk hari ini.</p>
              <button 
                onClick={addContent}
                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
              >
                Tambah Konten Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {localContent.map((item, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                  <button 
                    onClick={() => removeContent(idx)}
                    className="absolute top-4 right-4 p-1.5 bg-rose-50 text-rose-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-100"
                  >
                    <Plus className="w-3 h-3 rotate-45" />
                  </button>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Platform</label>
                      <select 
                        value={item.platform}
                        onChange={(e) => updateContent(idx, 'platform', e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="Instagram">Instagram</option>
                        <option value="TikTok">TikTok</option>
                        <option value="Facebook">Facebook</option>
                        <option value="Twitter/X">Twitter/X</option>
                        <option value="YouTube">YouTube</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jam Posting</label>
                      <input 
                        type="time"
                        value={item.postingTime}
                        onChange={(e) => updateContent(idx, 'postingTime', e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Konten</label>
                      <select 
                        value={item.contentType}
                        onChange={(e) => updateContent(idx, 'contentType', e.target.value)}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="Feed">Feed</option>
                        <option value="Reels">Reels</option>
                        <option value="Story">Story</option>
                        <option value="Video">Video</option>
                        <option value="Shorts">Shorts</option>
                      </select>
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul / Caption</label>
                      <input 
                        type="text"
                        value={item.title}
                        onChange={(e) => updateContent(idx, 'title', e.target.value)}
                        placeholder="Masukkan judul atau caption konten..."
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reach</label>
                      <input 
                        type="number"
                        value={item.reach}
                        onChange={(e) => updateContent(idx, 'reach', Number(e.target.value))}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Engagement</label>
                      <input 
                        type="number"
                        value={item.engagement}
                        onChange={(e) => updateContent(idx, 'engagement', Number(e.target.value))}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Views</label>
                      <input 
                        type="number"
                        value={item.views}
                        onChange={(e) => updateContent(idx, 'views', Number(e.target.value))}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={addContent}
                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" />
                Tambah Konten Lainnya
              </button>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Batal
          </button>
          <button 
            onClick={() => {
              onSave(localContent);
              onClose();
            }}
            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            Simpan Data
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SocialMediaModal;
