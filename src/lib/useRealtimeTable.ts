// ==============================================================
// Hook subscribe ke perubahan tabel via Supabase Realtime.
//
// Dua mode trigger:
//   1. onChange()        → DEBOUNCED, no payload — caller refetch sendiri.
//                          Cocok untuk tabel kecil / aggregate refetch.
//   2. onEvent(payload)  → PER-EVENT, payload included — caller apply
//                          incremental update sendiri (INSERT/UPDATE/DELETE).
//                          Cocok untuk tabel besar — gak full refetch.
//
// Filter optional: 'user_id=eq.<uuid>' untuk subscribe ke baris user
// tertentu saja (hemat bandwidth).
//
// Returned:
//   - status: 'connecting' | 'live' | 'error' | 'closed'
//
// ==============================================================
// Stability:
// - Auto-reconnect connection dengan exponential backoff kalau channel
//   CLOSED/TIMED_OUT/CHANNEL_ERROR. CONNECTION saja yang di-restore —
//   TIDAK trigger refetch buat hindari "ngaccak" state.
// - NO heartbeat (default off). User minta dashboard "diam" setelah load.
// - NO visibility-change refetch. Tab balik aktif → realtime tetap jalan
//   karena auto-reconnect, tapi state gak di-refetch.
// ==============================================================

import { useEffect, useState, useRef } from 'react';
import { getSupabase } from './supabase';
import { logger } from './logger';

export type RealtimeStatus = 'connecting' | 'live' | 'error' | 'closed';

// Payload shape dari Supabase Realtime (event INSERT/UPDATE/DELETE)
export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  schema: string;
  table: string;
}

interface UseRealtimeTableOptions<T = Record<string, unknown>> {
  table: string;
  filter?: string;          // mis. 'user_id=eq.abc-123'
  // Mode 1: full refetch trigger (debounced, no payload)
  onChange?: () => void;
  // Mode 2: per-event handler (instant, payload included)
  onEvent?: (payload: RealtimePayload<T>) => void;
  schema?: string;
  // Debounce buat onChange. onEvent gak di-debounce.
  debounceMs?: number;
}

export const useRealtimeTable = <T extends Record<string, unknown> = Record<string, unknown>>(
  options: UseRealtimeTableOptions<T>,
): { status: RealtimeStatus } => {
  const {
    table, filter, onChange, onEvent,
    schema = 'public',
    debounceMs = 200,
  } = options;

  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Simpan callback di ref supaya channel tidak di-recreate setiap render
  const onChangeRef = useRef(onChange);
  const onEventRef = useRef(onEvent);
  onChangeRef.current = onChange;
  onEventRef.current = onEvent;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus('error');
      return;
    }

    const channelName = `realtime:${schema}:${table}${filter ? ':' + filter : ''}`;

    const debouncedChange = () => {
      if (!onChangeRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onChangeRef.current?.(), debounceMs);
    };

    let cancelled = false;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;

    const setupChannel = () => {
      if (cancelled) return;
      setStatus('connecting');

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema, table, ...(filter ? { filter } : {}) },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            if (cancelled) return;
            // Mode 2: per-event handler (instant, no debounce)
            if (onEventRef.current) {
              try {
                onEventRef.current(payload as RealtimePayload<T>);
              } catch (err) {
                logger.warn(`[Realtime] ${channelName} onEvent threw:`, err);
              }
            }
            // Mode 1: debounced full refetch
            if (onChangeRef.current) {
              debouncedChange();
            }
          },
        )
        .subscribe((s: string) => {
          if (cancelled) return;
          logger.info(`[Realtime] ${channelName} → ${s}`);

          if (s === 'SUBSCRIBED') {
            setStatus('live');
            reconnectAttempt = 0;
            // CATATAN PENTING: TIDAK trigger refetch di sini.
            // User minta dashboard "diam" setelah initial load — kalau
            // reconnect trigger refetch otomatis, state bakal ngaccak.
            // Trade-off: event yang miss selama disconnect tidak ke-catch,
            // tapi koneksi tetap idup buat event berikutnya.
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
            setStatus(s === 'CLOSED' ? 'closed' : 'error');
            // Schedule reconnect dengan exponential backoff (1s → 30s)
            const delay = Math.min(30_000, 1000 * Math.pow(2, reconnectAttempt));
            reconnectAttempt += 1;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (cancelled) return;
              void supabase.removeChannel(channel);
              setupChannel();
            }, delay);
          }
        });

      currentChannel = channel;
    };

    setupChannel();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (currentChannel) void supabase.removeChannel(currentChannel);
    };
  }, [table, filter, schema, debounceMs]);

  return { status };
};
