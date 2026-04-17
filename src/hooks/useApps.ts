import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type AppRow = Database['public']['Tables']['apps']['Row'];

export const APPS_KEY = ['apps'] as const;

export function useApps() {
  return useQuery({
    queryKey: APPS_KEY,
    queryFn: async (): Promise<AppRow[]> => {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      name: string;
      display_name?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('apps')
        .upsert(payload, { onConflict: 'name' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: APPS_KEY }),
  });
}
