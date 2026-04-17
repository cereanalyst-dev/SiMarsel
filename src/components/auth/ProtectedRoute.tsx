import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types/database';

interface Props {
  children: ReactNode;
  requireRole?: UserRole | UserRole[];
}

export default function ProtectedRoute({ children, requireRole }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireRole && profile) {
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!allowed.includes(profile.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Access denied</h2>
            <p className="text-sm text-slate-600">
              This page requires the {allowed.join(' or ')} role.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
