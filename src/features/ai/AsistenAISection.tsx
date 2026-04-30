import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot, Copy, FileText, Lightbulb, Loader2, Send, Sparkles,
  Smartphone, TrendingUp, Type, User as UserIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import { logger } from '../../lib/logger';
import { getSupabase } from '../../lib/supabase';
import { createContentScript } from '../../lib/dataAccess';
import type { ContentType, NewContentScript, VideoContent } from '../../types';

interface Props {
  detectedPlatforms?: string[];
  setActiveTab?: (tab: string) => void;
}

type ContextType = 'analytics' | 'recommendation' | 'copy' | 'free';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contextType?: ContextType;
  timestamp: Date;
  meta?: { model?: string; usage?: { input_tokens: number; output_tokens: number } };
}

const QUICK_PROMPTS: Array<{
  type: ContextType;
  icon: typeof TrendingUp;
  label: string;
  hint: string;
  example: string;
  gradient: string;
}> = [
  {
    type: 'analytics',
    icon: TrendingUp,
    label: 'Analisa Tren',
    hint: 'Tanya tentang revenue, conversion, performa platform',
    example: 'Kenapa revenue Maret turun 20% dari Februari? Breakdown per app dan kategori promo.',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    type: 'recommendation',
    icon: Lightbulb,
    label: 'Rekomendasi Paket',
    hint: 'Saran paket baru, pricing, strategi promo',
    example: 'Buat 2 rekomendasi paket baru untuk JADIBUMN bulan depan dengan range harga 100-200rb.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    type: 'copy',
    icon: Type,
    label: 'Generate Copy',
    hint: 'Buat copy iklan TikTok / Instagram',
    example: 'Generate 3 variasi copy iklan TikTok untuk paket Bimbel Lengkap CPNS — target gen-Z fresh graduate.',
    gradient: 'from-rose-500 to-pink-500',
  },
];

export const AsistenAISection = ({ detectedPlatforms = [], setActiveTab }: Props) => {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [contextType, setContextType] = useState<ContextType>('free');
  const [platform, setPlatform] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ke bawah saat ada pesan baru
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const platformsList = useMemo(() => {
    return ['', ...detectedPlatforms.map((p) => p.toLowerCase())];
  }, [detectedPlatforms]);

  const handleSend = async (queryOverride?: string, ctxOverride?: ContextType) => {
    const query = (queryOverride ?? input).trim();
    if (!query || loading) return;

    const ctx = ctxOverride ?? contextType;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      contextType: ctx,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase belum siap');
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes?.session?.access_token;
      if (!token) throw new Error('Sesi habis — login dulu');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query,
          contextType: ctx,
          platform: platform || undefined,
        }),
      });

      if (res.status === 404) {
        throw new Error('Endpoint AI belum tersedia (deploy dulu)');
      }

      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: body.content,
        contextType: ctx,
        timestamp: new Date(),
        meta: { model: body.model, usage: body.usage },
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Error: ${err instanceof Error ? err.message : String(err)}`,
        contextType: ctx,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      logger.error('AI chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: typeof QUICK_PROMPTS[number]) => {
    setContextType(prompt.type);
    void handleSend(prompt.example, prompt.type);
  };

  const handleSaveAsKonten = async (msg: ChatMessage) => {
    if (msg.role !== 'assistant' || msg.contextType !== 'copy') return;
    const supabase = getSupabase();
    if (!supabase) {
      toast.error('Supabase belum siap');
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    // Default: simpan sebagai video script. AI text masuk ke caption fields.
    const content: VideoContent = {
      caption_tiktok: msg.content,
      caption_instagram: msg.content,
    };
    const payload: NewContentScript = {
      user_id: userId,
      platform: platform || 'jadiasn',
      type: 'video' as ContentType,
      scheduled_date: null,
      tgl_tay: null,
      title: `[AI] ${msg.content.slice(0, 60)}…`,
      status: 'draft',
      assigned_to: null,
      info_skrip: 'Dibuat oleh Asisten AI',
      talent: null,
      editor: null,
      poster: null,
      creative: null,
      link_video: null,
      link_canva: null,
      cc: null,
      upload_status: null,
      link_konten: null,
      keterangan: 'Generated dari Asisten AI',
      catatan: null,
      content,
    };

    const result = await createContentScript(payload);
    if (result) {
      toast.success(
        'Disimpan ke Manajemen Konten',
        'Status: Draft. Edit detail di tab Manajemen Konten.',
      );
    } else {
      toast.error('Gagal simpan', 'Coba lagi atau cek console.');
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied', 'Teks disalin ke clipboard.');
    } catch {
      toast.error('Gagal copy', 'Browser tidak izinkan akses clipboard.');
    }
  };

  return (
    <motion.div
      key="asisten-ai"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 mb-3">
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              AI Assistant
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Asisten AI
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Tanya apa saja tentang data dashboard. AI bisa analisa tren,
            kasih rekomendasi paket baru, atau buatin copy iklan — langsung
            simpan hasil ke Manajemen Konten.
          </p>
        </div>

        {/* Platform context selector */}
        {platformsList.length > 1 && (
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
            <Smartphone className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              aria-label="Konteks platform"
              className="bg-transparent text-[11px] font-black text-slate-700 outline-none cursor-pointer uppercase tracking-widest pr-3 py-1"
            >
              <option value="">SEMUA PLATFORM</option>
              {platformsList.filter(Boolean).map((p) => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Quick action cards (cuma tampil kalau belum ada chat) */}
      {messages.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {QUICK_PROMPTS.map((prompt) => {
            const Icon = prompt.icon;
            return (
              <motion.button
                key={prompt.type}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleQuickPrompt(prompt)}
                disabled={loading}
                className={cn(
                  'relative overflow-hidden p-5 rounded-2xl text-left transition-all',
                  'bg-gradient-to-br text-white shadow-lg',
                  prompt.gradient,
                  loading && 'opacity-50 cursor-wait',
                )}
              >
                <div className="pointer-events-none absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black tracking-tight mb-1">{prompt.label}</h3>
                  <p className="text-xs text-white/80 font-medium leading-snug">
                    {prompt.hint}
                  </p>
                  <p className="text-[10px] text-white/60 font-medium mt-3 italic line-clamp-2">
                    "{prompt.example}"
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Chat container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col" style={{ height: messages.length > 0 ? '70vh' : 'auto' }}>
        {messages.length > 0 && (
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
            <AnimatePresence>
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  msg={msg}
                  onSaveAsKonten={() => void handleSaveAsKonten(msg)}
                  onCopy={() => void handleCopy(msg.content)}
                />
              ))}
            </AnimatePresence>
            {loading && <ThinkingIndicator />}
          </div>
        )}

        {/* Input bar */}
        <div className={cn(
          'p-4 border-t border-slate-100 bg-slate-50/40',
          messages.length === 0 && 'border-t-0',
        )}>
          {/* Context type selector — pas bisa pilih jenis pertanyaan */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Mode:
            </span>
            {(['analytics', 'recommendation', 'copy', 'free'] as ContextType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setContextType(t)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                  contextType === t
                    ? 'bg-violet-600 text-white shadow'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-200',
                )}
              >
                {t === 'analytics' ? 'Analisa' : t === 'recommendation' ? 'Rekomendasi' : t === 'copy' ? 'Copy' : 'Bebas'}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={loading ? 'Menunggu respons…' : 'Ketik pertanyaan atau permintaan… (Enter untuk kirim, Shift+Enter ganti baris)'}
              rows={2}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-white rounded-xl border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 resize-none placeholder:text-slate-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={loading || !input.trim()}
              aria-label="Kirim"
              className={cn(
                'inline-flex items-center justify-center w-12 h-12 rounded-xl text-white transition-all',
                'bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-100',
                'disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed',
              )}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>

          {messages.length > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px] text-slate-400 font-medium">
                {messages.length} pesan dalam sesi ini
              </p>
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest"
              >
                Reset Percakapan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="bg-violet-50/40 rounded-2xl p-4 border border-violet-100">
        <div className="flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[11px] font-black text-violet-700 mb-1">
              Cara kerja Asisten AI
            </p>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              AI dapat akses ringkasan data dashboard kamu (overview stats,
              transaksi recent, paket per platform). Setiap pertanyaan dikirim
              ke Claude AI dengan konteks yang relevan. <strong>Untuk hasil copy
              iklan</strong>, kamu bisa langsung simpan ke{' '}
              <button
                type="button"
                onClick={() => setActiveTab?.('konten')}
                className="text-violet-700 underline-offset-2 hover:underline font-black"
              >
                Manajemen Konten
              </button> sebagai draft.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================
// Chat bubble
// ============================================================
function ChatBubble({ msg, onSaveAsKonten, onCopy }: {
  msg: ChatMessage;
  onSaveAsKonten: () => void;
  onCopy: () => void;
}) {
  const isUser = msg.role === 'user';
  const isCopy = msg.contextType === 'copy';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center flex-shrink-0 shadow">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={cn('max-w-[75%] space-y-1.5', isUser && 'items-end')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-violet-600 text-white'
            : 'bg-slate-50 text-slate-700 border border-slate-100',
        )}>
          {msg.content}
        </div>

        {!isUser && (
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
            >
              <Copy className="w-3 h-3" />
              Salin
            </button>
            {isCopy && (
              <button
                type="button"
                onClick={onSaveAsKonten}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all"
              >
                <FileText className="w-3 h-3" />
                Simpan ke Konten
              </button>
            )}
            {msg.meta?.model && (
              <span className="text-[9px] font-medium text-slate-300 ml-auto">
                {msg.meta.model.replace(/-\d{8}$/, '')}
              </span>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
          <UserIcon className="w-4 h-4 text-slate-600" />
        </div>
      )}
    </motion.div>
  );
}

// ============================================================
// Thinking indicator
// ============================================================
function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center flex-shrink-0 shadow">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              className="w-1.5 h-1.5 rounded-full bg-violet-500"
            />
          ))}
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          AI sedang berpikir…
        </span>
      </div>
    </motion.div>
  );
}

export default AsistenAISection;
