// ==============================================================
// Hook subscribe ke perubahan tabel via Supabase Realtime.
// Auto-call `onChange` setiap ada INSERT / UPDATE / DELETE di table
// yang dipilih. Tidak mengirim data — caller refetch sendiri.
//
// Filter optional: 'user_id=eq.<uuid>' untuk subscribe ke baris user
// tertentu saja (hemat bandwidth).
//
// Returned:
//   - status: 'connecting' | 'live' | 'error' | 'closed'
//     UI bisa pakai ini untuk tampilkan badge Live.
// ==============================================================

import { useEffect, useState, useRef } from 'react';
import { getSupabase } from './supabase';
import { logger } from './logger';

export type RealtimeStatus = 'connecting' | 'live' | 'error' | 'closed';

interface UseRealtimeTableOptions {
  table: string;
  filter?: string;          // mis. 'user_id=eq.abc-123'
  onChange: () => void;     // dipanggil setiap event — caller refetch
  // schema default 'public'
  schema?: string;
  // Debounce trigger (ms). Hindari spam refetch kalau banyak event burst.
  debounceMs?: number;
}

export const useRealtimeTable = ({
  table,
  filter,
  onChange,
  schema = 'public',
  debounceMs = 200,
}: UseRealtimeTableOptions): { status: RealtimeStatus } => {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Simpan onChange di ref supaya channel tidak di-recreate setiap render
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus('error');
      return;
    }

    const channelName = `realtime:${schema}:${table}${filter ? ':' + filter : ''}`;
    setStatus('connecting');

    const debouncedTrigger = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema, table, ...(filter ? { filter } : {}) },
        () => debouncedTrigger(),
      )
      .subscribe((s: string) => {
        if (s === 'SUBSCRIBED') setStatus('live');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error');
        else if (s === 'CLOSED') setStatus('closed');
        logger.info(`[Realtime] ${channelName} → ${s}`);
      });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void supabase.removeChannel(channel);
    };
  }, [table, filter, schema, debounceMs]);

  return { status };
};
