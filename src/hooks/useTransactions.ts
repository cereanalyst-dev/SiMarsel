import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

export interface TransactionFilters {
  sourceApp?: string | null;
  yearMonth?: string | null;
  paymentMethod?: string | null;
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async (): Promise<TransactionRow[]> => {
      let q = supabase.from('transactions').select('*');
      if (filters.sourceApp && filters.sourceApp !== 'All') {
        q = q.eq('source_app', filters.sourceApp);
      }
      if (filters.yearMonth) {
        q = q.eq('year_month', filters.yearMonth);
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'All') {
        q = q.eq('methode_name', filters.paymentMethod);
      }
      // Cap per query — dashboards rarely need more than this per view.
      const { data, error } = await q
        .order('payment_date', { ascending: false })
        .limit(50_000);
      if (error) throw error;
      return data ?? [];
    },
  });
}
