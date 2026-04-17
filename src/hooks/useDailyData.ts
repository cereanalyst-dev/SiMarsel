import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type DailyRow = Database['public']['Tables']['daily_data']['Row'];
type DailyInsert = Database['public']['Tables']['daily_data']['Insert'];

// Fetch all daily rows for an app in a given YYYY-MM.
export function useDailyData(appId: string | null | undefined, month: string | null | undefined) {
  return useQuery({
    queryKey: ['daily_data', appId, month],
    queryFn: async (): Promise<DailyRow[]> => {
      if (!appId || !month) return [];
      const start = `${month}-01`;
      // Range end = first day of next month (exclusive)
      const [y, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const { data, error } = await supabase
        .from('daily_data')
        .select('*')
        .eq('app_id', appId)
        .gte('date', start)
        .lt('date', nextMonth)
        .order('date');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(appId && month),
  });
}

export function useUpsertDailyData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DailyInsert) => {
      const { data, error } = await supabase
        .from('daily_data')
        .upsert(payload, { onConflict: 'app_id,date' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const month = data.date.slice(0, 7);
      qc.invalidateQueries({ queryKey: ['daily_data', data.app_id, month] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
