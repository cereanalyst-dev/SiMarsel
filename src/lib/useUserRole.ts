// ==============================================================
// Hook untuk fetch role user yang sedang login + derived permissions.
// Dipakai di seluruh feature untuk gating UI dan action.
// ==============================================================

import { useEffect, useState } from 'react';
import { fetchMyRole } from './dataAccess';
import { permissionsFor, type Permissions } from './permissions';
import type { UserRole } from '../types';

export interface UseUserRoleResult {
  role: UserRole | null;
  permissions: Permissions;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useUserRole = (userId: string | null): UseUserRoleResult => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await fetchMyRole(userId);
    setRole(r);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    role,
    permissions: permissionsFor(role),
    loading,
    refresh: load,
  };
};
