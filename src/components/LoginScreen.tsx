import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  APP_ACCENT_SUFFIX, APP_NAME, COMPANY_NAME, LOGO_PATH,
} from '../config/app.config';

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
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
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
    <div className="min-h-screen flex relative overflow-hidden bg-[#0b1424]">
      {/* Ambient gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-indigo-600/20 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] bg-amber-400/15 rounded-full blur-[140px]" />
        <div className="absolute top-[40%] left-[40%] w-[35%] h-[35%] bg-rose-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Left column — brand */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] px-16 py-14 relative">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 blur-[2px] opacity-70" />
            <img
              src={LOGO_PATH}
              alt={APP_NAME}
              className="relative w-full h-full object-contain rounded-xl ring-2 ring-white/10"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {APP_NAME}
            {APP_ACCENT_SUFFIX && (
              <span className="text-amber-400">{APP_ACCENT_SUFFIX}</span>
            )}
          </h1>
        </div>

        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em]">
                Dashboard Intelligence
              </span>
            </div>
            <h2 className="text-5xl font-black text-white leading-[1.05] tracking-tight">
              Lihat semua transaksi,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-rose-400">
                putuskan dengan data.
              </span>
            </h2>
            <p className="text-[15px] text-slate-300 mt-5 leading-relaxed max-w-md">
              Analitik konsolidasi lintas aplikasi — transaksi, downloader, paket,
              target operasional dan konten sosial media. Dalam satu dashboard.
            </p>
          </motion.div>

          <div className="grid grid-cols-3 gap-4 max-w-md">
            <StatBadge value="7" label="Modul" />
            <StatBadge value="∞" label="Skala Data" />
            <StatBadge value="RLS" label="Aman" />
          </div>
        </div>

        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.25em]">
          {COMPANY_NAME}
        </p>
      </div>

      {/* Right column — form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-md"
        >
          {/* Mobile brand (shown only on small screens) */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <img
              src={LOGO_PATH}
              alt={APP_NAME}
              className="w-11 h-11 object-contain rounded-xl ring-2 ring-white/10"
              referrerPolicy="no-referrer"
            />
            <h1 className="text-2xl font-black text-white tracking-tight">
              {APP_NAME}
              {APP_ACCENT_SUFFIX && <span className="text-amber-400">{APP_ACCENT_SUFFIX}</span>}
            </h1>
          </div>

          <div className="bg-white rounded-[2rem] p-10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white/10">
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.25em] mb-2">
              {mode === 'sign_in' ? 'Selamat Datang' : 'Buat Akun'}
            </p>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              {mode === 'sign_in' ? 'Masuk ke Dashboard' : 'Daftar Akun Baru'}
            </h2>
            <p className="text-sm text-slate-400 font-medium mb-8">
              {mode === 'sign_in'
                ? 'Gunakan akun yang terdaftar di Supabase project.'
                : 'Isi email + password. Konfirmasi mungkin dikirim via email.'}
            </p>

            {!configured ? (
              <div className="space-y-5">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <p className="text-[11px] text-amber-700 font-bold">
                    Supabase belum dikonfigurasi. Tetapkan <code>VITE_SUPABASE_URL</code> dan{' '}
                    <code>VITE_SUPABASE_ANON_KEY</code> di <code>.env.local</code> untuk
                    mengaktifkan auth &amp; cloud sync.
                  </p>
                </div>
                {onGuestContinue && (
                  <button
                    onClick={onGuestContinue}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    Lanjut dalam mode lokal
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <FormField label="Email" htmlFor="email">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-400 focus:bg-white outline-none transition-all font-bold text-sm"
                    placeholder="nama@perusahaan.com"
                  />
                </FormField>
                <FormField label="Password" htmlFor="password">
                  <input
                    id="password"
                    type="password"
                    autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-400 focus:bg-white outline-none transition-all font-bold text-sm"
                    placeholder="Minimal 6 karakter"
                  />
                </FormField>

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
                  className="w-full py-4 bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:from-slate-800 hover:to-indigo-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  {loading ? 'Memproses…' : mode === 'sign_in' ? 'Masuk' : 'Daftar'}
                  {!loading && (
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  )}
                </button>

                <div className="relative py-2">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-slate-100" />
                  <span className="relative block w-fit mx-auto px-3 bg-white text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">
                    atau
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in');
                    setError(null);
                    setMessage(null);
                  }}
                  className="w-full text-center text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors py-2"
                >
                  {mode === 'sign_in' ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Masuk'}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-[0.25em] mt-6">
            Dilindungi oleh Supabase RLS
          </p>
        </motion.div>
      </div>
    </div>
  );
};

const StatBadge = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center p-3 rounded-2xl bg-white/[0.03] border border-white/10">
    <p className="text-xl font-black text-white leading-none">{value}</p>
    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">
      {label}
    </p>
  </div>
);

const FormField = ({
  label, htmlFor, children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) => (
  <div>
    <label
      htmlFor={htmlFor}
      className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-0.5"
    >
      {label}
    </label>
    {children}
  </div>
);

export default LoginScreen;
