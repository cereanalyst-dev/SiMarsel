// ==============================================================
// Admin UI untuk assign role ke user.
// Tampil di Settings — hanya admin yang bisa akses (gated di parent).
// ==============================================================

import { useCallback, useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '../../components/Toast';
import { fetchAllUserRoles, upsertUserRole } from '../../lib/dataAccess';
import { ROLE_LABELS, type UserRole, type UserRoleRow } from '../../types';
import { cn } from '../../lib/utils';

const ROLE_OPTIONS: UserRole[] = ['admin', 'manager', 'asst_manager', 'staf'];

const ROLE_TONE: Record<UserRole, { bg: string; text: string; ring: string }> = {
  admin:        { bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200' },
  manager:      { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200' },
  asst_manager: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  ring: 'ring-indigo-200' },
  staf:         { bg: 'bg-slate-50',   text: 'text-slate-700',   ring: 'ring-slate-200' },
};

export const RoleManagement = () => {
  const toast = useToast();
  const [rows, setRows] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staf');
  const [newName, setNewName] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllUserRoles();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    setSavingUserId(userId);
    const updated = await upsertUserRole({ user_id: userId, role });
    if (updated) {
      toast.success(`Role di-update ke ${ROLE_LABELS[role]}`);
      setRows((prev) => prev.map((r) => r.user_id === userId ? updated : r));
    } else {
      toast.error('Gagal update role');
    }
    setSavingUserId(null);
  };

  const handleAdd = async () => {
    if (!newUserId.trim()) {
      toast.error('User ID wajib diisi');
      return;
    }
    setSavingUserId('new');
    const created = await upsertUserRole({
      user_id: newUserId.trim(),
      role: newRole,
      full_name: newName.trim() || null,
    });
    if (created) {
      toast.success('User role ditambahkan');
      await reload();
      setNewUserId('');
      setNewName('');
      setNewRole('staf');
    } else {
      toast.error('Gagal tambah role. Pastikan User ID valid (UUID).');
    }
    setSavingUserId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-tile p-6 space-y-6"
    >
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2.5 bg-rose-50 rounded-xl">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight">Manajemen Role</h3>
          <p className="text-xs text-slate-400 font-medium">
            Atur role tiap user. Hierarchy: Admin → Manager → Asst. Manager → Staf
          </p>
        </div>
      </div>

      {/* Add new */}
      <div className="bg-slate-50 p-4 rounded-2xl">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
          Tambah / Update User
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="User ID (UUID dari auth.users)"
            className="md:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-300"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama lengkap (opsional)"
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-300"
          />
          <div className="flex items-center gap-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-rose-300"
            >
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={savingUserId === 'new'}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider"
            >
              {savingUserId === 'new' ? '...' : 'Simpan'}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 font-medium mt-2">
          User ID = UUID dari tabel auth.users. Bisa diambil dari Supabase Studio → Authentication → Users.
        </p>
      </div>

      {/* Existing roles */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="py-3 px-3">User</th>
              <th className="py-3 px-3">Email</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3">Update</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-8 text-center text-xs font-bold text-slate-400">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-xs font-bold text-slate-400">
                Belum ada user role. Tambah di atas.
              </td></tr>
            ) : rows.map((row) => {
              const tone = ROLE_TONE[row.role];
              return (
                <tr key={row.user_id} className="border-b border-slate-50 hover:bg-slate-50/40">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', tone.bg)}>
                        <UserIcon className={cn('w-4 h-4', tone.text)} />
                      </div>
                      <span className="text-xs font-black text-slate-700">
                        {row.full_name || <span className="text-slate-400 italic">(tanpa nama)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[11px] font-bold text-slate-600 truncate max-w-[240px]" title={row.email ?? ''}>
                    {row.email || <span className="text-slate-400 italic">(email belum di-set)</span>}
                  </td>
                  <td className="py-3 px-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider',
                      tone.bg, tone.text)}>
                      {row.role === 'admin' && <ShieldAlert className="w-2.5 h-2.5" />}
                      {row.role === 'manager' && <ShieldCheck className="w-2.5 h-2.5" />}
                      {row.role === 'asst_manager' && <Shield className="w-2.5 h-2.5" />}
                      {ROLE_LABELS[row.role]}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={row.role}
                      onChange={(e) => void handleUpdateRole(row.user_id, e.target.value as UserRole)}
                      disabled={savingUserId === row.user_id}
                      aria-label={`Ubah role ${row.full_name ?? row.user_id}`}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold uppercase tracking-wider outline-none"
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default RoleManagement;
