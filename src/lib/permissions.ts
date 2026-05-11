// ==============================================================
// Permission helper berdasarkan hierarchy bertahap:
//   admin        → akses penuh
//   manager      → edit semua kecuali settings & role management
//   asst_manager → edit tasklist, insight, sosmed, konten (limited)
//   staf         → read-only, kecuali edit tasklist yang ditugaskan
// ==============================================================

import type { UserRole } from '../types';

export interface Permissions {
  canAccessSettings: boolean;
  canManageRoles: boolean;
  canUploadTransactions: boolean;
  canUploadKpi: boolean;
  canUploadInsight: boolean;
  canUploadSosmed: boolean;
  canEditTargets: boolean;
  canEditKpi: boolean;
  canEditPromoRules: boolean;
  canEditContent: boolean;
  canEditTasks: boolean;
  canEditOwnTasksOnly: boolean;
  canEditInsight: boolean;
  canEditSosmed: boolean;
  canDeleteData: boolean;
}

// Default permissions — kalau role belum di-set (user baru) treat sebagai 'staf'.
export const DEFAULT_PERMISSIONS: Permissions = {
  canAccessSettings: false,
  canManageRoles: false,
  canUploadTransactions: false,
  canUploadKpi: false,
  canUploadInsight: false,
  canUploadSosmed: false,
  canEditTargets: false,
  canEditKpi: false,
  canEditPromoRules: false,
  canEditContent: false,
  canEditTasks: false,
  canEditOwnTasksOnly: true,
  canEditInsight: false,
  canEditSosmed: false,
  canDeleteData: false,
};

export const permissionsFor = (role: UserRole | null): Permissions => {
  if (role === 'admin') {
    return {
      canAccessSettings: true,
      canManageRoles: true,
      canUploadTransactions: true,
      canUploadKpi: true,
      canUploadInsight: true,
      canUploadSosmed: true,
      canEditTargets: true,
      canEditKpi: true,
      canEditPromoRules: true,
      canEditContent: true,
      canEditTasks: true,
      canEditOwnTasksOnly: false,
      canEditInsight: true,
      canEditSosmed: true,
      canDeleteData: true,
    };
  }
  if (role === 'manager') {
    return {
      canAccessSettings: false,
      canManageRoles: false,
      canUploadTransactions: true,
      canUploadKpi: true,
      canUploadInsight: true,
      canUploadSosmed: true,
      canEditTargets: true,
      canEditKpi: true,
      canEditPromoRules: true,
      canEditContent: true,
      canEditTasks: true,
      canEditOwnTasksOnly: false,
      canEditInsight: true,
      canEditSosmed: true,
      canDeleteData: true,
    };
  }
  if (role === 'asst_manager') {
    return {
      canAccessSettings: false,
      canManageRoles: false,
      canUploadTransactions: false,
      canUploadKpi: false,
      canUploadInsight: true,
      canUploadSosmed: true,
      canEditTargets: false,
      canEditKpi: false,
      canEditPromoRules: false,
      canEditContent: true,
      canEditTasks: true,
      canEditOwnTasksOnly: false,
      canEditInsight: true,
      canEditSosmed: true,
      canDeleteData: false,
    };
  }
  // staf (default fallback)
  return DEFAULT_PERMISSIONS;
};
