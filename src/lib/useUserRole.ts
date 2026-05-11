// ==============================================================
// Hook untuk fetch role user yang sedang login + derived permissions.
// Dipakai di seluruh feature untuk gating UI dan action.
// ==============================================================

import { useEffect, useState } from 'react';
import { getSupabase } from './supabase';
import { logger } from './logger';
import { permissionsFor, type Permissions } from './permissions';
import type { UserRole } from '../types';

export interface UseUserRoleResult {
  role: UserRole | null;
  fullName: string | null;
  email: string | null;
  permissions: Permissions;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useUserRole = (userId: string | null): UseUserRoleResult => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!userId) {
      setRole(null);
      setFullName(null);
      setEmail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, full_name, email')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      logger.warn('Failed to fetch user role:', error.message);
    }
    setRole((data?.role as UserRole) ?? null);
    setFullName((data?.full_name as string | null) ?? null);
    setEmail((data?.email as string | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    role,
    fullName,
    email,
    permissions: permissionsFor(role),
    loading,
    refresh: load,
  };
};
