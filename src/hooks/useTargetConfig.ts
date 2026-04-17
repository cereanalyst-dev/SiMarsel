import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type TargetRow = Database['public']['Tables']['target_configs']['Row'];
type TargetInsert = Database['public']['Tables']['target_configs']['Insert'];

export function useTargetConfigs(appId: string | null | undefined) {
  return useQuery({
    queryKey: ['target_configs', appId ?? 'all'],
    queryFn: async (): Promise<TargetRow[]> => {
      let q = supabase.from('target_configs').select('*');
      if (appId) q = q.eq('app_id', appId);
      const { data, error } = await q.order('target_month');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTargetConfig(appId: string | null | undefined, month: string | null | undefined) {
  return useQuery({
    queryKey: ['target_config', appId, month],
    queryFn: async (): Promise<TargetRow | null> => {
      if (!appId || !month) return null;
      const { data, error } = await supabase
        .from('target_configs')
        .select('*')
        .eq('app_id', appId)
        .eq('target_month', month)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(appId && month),
  });
}

export function useUpsertTargetConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TargetInsert) => {
      const { data, error } = await supabase
        .from('target_configs')
        .upsert(payload, { onConflict: 'app_id,target_month' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['target_config', data.app_id, data.target_month] });
      qc.invalidateQueries({ queryKey: ['target_configs', data.app_id] });
      qc.invalidateQueries({ queryKey: ['target_configs', 'all'] });
      toast.success('Target saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
