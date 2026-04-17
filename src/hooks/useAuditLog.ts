import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database, AuditAction } from '@/types/database';

type AuditRow = Database['public']['Tables']['audit_logs']['Row'];

export interface AuditFilters {
  tableName?: string | null;
  action?: AuditAction | null;
  userId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  pageSize?: number;
}

export function useAuditLog(filters: AuditFilters = {}) {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 50;
  return useQuery({
    queryKey: ['audit_logs', filters],
    queryFn: async (): Promise<{ rows: AuditRow[]; total: number }> => {
      let q = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters.tableName) q = q.eq('table_name', filters.tableName);
      if (filters.action) q = q.eq('action', filters.action);
      if (filters.userId) q = q.eq('user_id', filters.userId);
      if (filters.startDate) q = q.gte('created_at', filters.startDate);
      if (filters.endDate) q = q.lte('created_at', filters.endDate);

      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
    },
  });
}
