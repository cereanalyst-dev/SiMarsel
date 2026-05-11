import { useState } from 'react';
import { Eye, EyeOff, RefreshCw, UserPlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { RoleManagement } from './RoleManagement';
import { ROLE_LABELS, type UserRole } from '../../types';

interface SettingsSectionProps {
  canManageRoles?: boolean;
  canCreateAccount?: boolean;
}

export const SettingsSection = ({
  canManageRoles = false,
  canCreateAccount = false,
}: SettingsSectionProps) => {
  return (
    <div className="space-y-8">
      {/* Editorial header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              System
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Pengaturan
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1.5 max-w-xl">
            Kelola akun anggota tim dan role-nya.
          </p>
        </div>
      </div>

      {/* Buat Akun — hanya admin/manager/asst_manager */}
      {canCreateAccount && <CreateAccountCard />}

      {/* Role Management — hanya admin */}
      {canManageRoles && <RoleManagement />}

      {/* Empty state untuk staf yang tidak punya akses apa-apa */}
      {!canCreateAccount && !canManageRoles && (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center">
          <p className="text-sm font-bold text-slate-400">
            Pengaturan terbatas. Hubungi admin untuk akses lebih lanjut.
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================
// CreateAccountCard — form sign-up langsung di dalam dashboard.
// Pakai Supabase auth.signUp(); user akan terima email konfirmasi
// (kalau "Confirm email" di-enable di Supabase Auth settings).
// ============================================================
const CreateAccountCard = () => {
  const toast = useToast();
  const supabaseReady = isSupabaseConfigured();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('staf');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!fullName.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password tidak cocok dengan konfirmasi.');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase belum dikonfigurasi.');
      return;
    }
    setLoading(true);
    try {
      // Role & full_name disimpan di user_metadata. Trigger DB
      // (handle_new_user) akan auto-insert ke public.user_roles.
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), role },
        },
      });
      if (err) throw err;
      setMessage(`Akun untuk ${fullName} (${email}) berhasil dibuat sebagai ${ROLE_LABELS[role]}.`);
      toast.success('Akun berhasil dibuat');
      setEmail('');
      setFullName('');
      setRole('staf');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat akun.';
      setError(msg);
      toast.error('Gagal membuat akun', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-1 h-12 rounded-full bg-gradient-to-b from-cyan-500 to-violet-500" />
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">
            Akun Baru
          </p>
          <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-600" />
            Buat Akun
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-xl">
            Daftarkan akun baru untuk anggota tim. Mereka akan menerima email
            konfirmasi (kalau verifikasi email diaktifkan di Supabase).
          </p>
        </div>
      </div>

      {!supabaseReady ? (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] text-amber-700 font-bold">
          Supabase belum dikonfigurasi. Set <code>VITE_SUPABASE_URL</code> &amp;{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> di <code>.env.local</code>.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Nama Lengkap *
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Budi Santoso"
              className="form-input"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Role *
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="form-input"
            >
              <option value="staf">{ROLE_LABELS.staf}</option>
              <option value="asst_manager">{ROLE_LABELS.asst_manager}</option>
              <option value="manager">{ROLE_LABELS.manager}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Email *
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              placeholder="anggota@perusahaan.com"
              className="form-input"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Password *
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
                className="form-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan' : 'Lihat'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-cyan-600 hover:bg-slate-50 transition-all"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Konfirmasi Password *
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Ulangi password"
              className="form-input"
            />
          </label>

          {error && (
            <div className="md:col-span-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-600 font-bold">
              {error}
            </div>
          )}
          {message && (
            <div className="md:col-span-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-700 font-bold">
              {message}
            </div>
          )}

          <div className="md:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || !email || !password || !confirmPassword}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-cyan-100 transition-all',
                'bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-700 hover:to-violet-700',
                'disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed',
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Memproses…
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Buat Akun
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SettingsSection;
