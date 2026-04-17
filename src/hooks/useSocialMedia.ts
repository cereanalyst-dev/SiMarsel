import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type SocialRow = Database['public']['Tables']['social_media_contents']['Row'];
type SocialInsert = Database['public']['Tables']['social_media_contents']['Insert'];

export function useSocialMediaForDaily(dailyDataId: string | null | undefined) {
  return useQuery({
    queryKey: ['social_media', dailyDataId],
    queryFn: async (): Promise<SocialRow[]> => {
      if (!dailyDataId) return [];
      const { data, error } = await supabase
        .from('social_media_contents')
        .select('*')
        .eq('daily_data_id', dailyDataId)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(dailyDataId),
  });
}

export function useUpsertSocialMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SocialInsert) => {
      const { data, error } = await supabase
        .from('social_media_contents')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['social_media', data.daily_data_id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSocialMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('social_media_contents').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social_media'] }),
    onError: (err: Error) => toast.error(err.message),
  });
}
