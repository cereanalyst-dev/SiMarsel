import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type DownloaderRow = Database['public']['Tables']['downloaders']['Row'];

export interface DownloaderFilters {
  sourceApp?: string | null;
  yearMonth?: string | null;
}

export function useDownloaders(filters: DownloaderFilters = {}) {
  return useQuery({
    queryKey: ['downloaders', filters],
    queryFn: async (): Promise<DownloaderRow[]> => {
      let q = supabase.from('downloaders').select('*');
      if (filters.sourceApp && filters.sourceApp !== 'All') {
        q = q.eq('source_app', filters.sourceApp);
      }
      if (filters.yearMonth) {
        q = q.eq('year_month', filters.yearMonth);
      }
      const { data, error } = await q.order('date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
