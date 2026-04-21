import { useState } from 'react';
import { motion } from 'motion/react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

type Mode = 'sign_in' | 'sign_up';

interface Props {
  onGuestContinue?: () => void;
}

export const LoginScreen = ({ onGuestContinue }: Props) => {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabase();
  const configured = isSupabaseConfigured();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'sign_in') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setMessage('Cek email Anda untuk konfirmasi akun, lalu masuk kembali.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-12 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.08)] border border-slate-100 max-w-md w-full relative z-10"
      >
        <div className="w-20 h-20 mx-auto mb-8 flex items-center justify-center">
          <img
            src="/maungmarsel.jpeg"
            alt="SiMarsel"
            className="w-full h-full object-contain rounded-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-3xl font-black text-slate-900 text-center mb-2 tracking-tight">
          SiMarsel<span className="text-indigo-600">.</span>
        </h1>
        <p className="text-sm text-slate-400 text-center mb-10 font-medium">
          Masuk untuk mengakses dashboard.
        </p>

        {!configured ? (
          <div className="space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] text-amber-700 font-bold">
              Supabase belum dikonfigurasi. Tetapkan{' '}
              <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di{' '}
              <code>.env.local</code> untuk mengaktifkan auth &amp; cloud sync.
            </div>
            {onGuestContinue && (
              <button
                onClick={onGuestContinue}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Lanjut dalam mode lokal
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-sm"
                placeholder="nama@perusahaan.com"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Password
              </label>
              <input
                type="password"
                autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1 w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-600 font-bold">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-700 font-bold">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Memproses…' : mode === 'sign_in' ? 'Masuk' : 'Daftar'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in');
                setError(null);
                setMessage(null);
              }}
              className="w-full text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
            >
              {mode === 'sign_in' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default LoginScreen;
