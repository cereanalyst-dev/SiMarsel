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
//
// ==============================================================
// Stability features (penting buat dashboard yang nyala lama):
//
// 1. Auto-reconnect dengan exponential backoff — kalau channel CLOSED
//    / TIMED_OUT / CHANNEL_ERROR, recreate channel otomatis (1s → 2s
//    → 4s → ... max 30s). User gak perlu reload manual.
//
// 2. Visibility change handler — pas tab balik ke foreground (user dari
//    tab lain / device sleep), langsung refetch + verify connection.
//    WebSocket sering "zombie" (state masih connected tapi event mati)
//    setelah tab idle lama — handler ini paksa fresh state.
//
// 3. Online event — pas network balik dari offline, refetch + reconnect.
//
// 4. Heartbeat refetch — tiap N menit panggil onChange() sebagai safety
//    net (kalau realtime miss event karena suatu hal). Default 3 menit.
//
// 5. On (re)connect, langsung trigger 1 kali onChange — biar data fresh
//    setelah down time.
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
  // Heartbeat — periodic safety-net refetch. Set 0 untuk disable.
  heartbeatMs?: number;
}

export const useRealtimeTable = ({
  table,
  filter,
  onChange,
  schema = 'public',
  debounceMs = 200,
  heartbeatMs = 3 * 60 * 1000,   // default 3 menit
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

    const debouncedTrigger = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    let cancelled = false;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempt = 0;

    const setupChannel = () => {
      if (cancelled) return;
      setStatus('connecting');

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema, table, ...(filter ? { filter } : {}) },
          () => debouncedTrigger(),
        )
        .subscribe((s: string) => {
          if (cancelled) return;
          logger.info(`[Realtime] ${channelName} → ${s}`);

          if (s === 'SUBSCRIBED') {
            setStatus('live');
            reconnectAttempt = 0;
            // Catch missed events selama down time
            onChangeRef.current();
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
            setStatus(s === 'CLOSED' ? 'closed' : 'error');
            // Schedule reconnect dengan exponential backoff
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

    // Heartbeat — safety net refetch (cuma kalau tab visible)
    if (heartbeatMs > 0) {
      heartbeatTimer = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          onChangeRef.current();
        }
      }, heartbeatMs);
    }

    // Visibility change — tab balik ke foreground
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        onChangeRef.current();
        // Verify channel masih hidup; kalau zombie, paksa reconnect
        const chan = currentChannel as unknown as { state?: string } | null;
        if (chan && chan.state && chan.state !== 'joined') {
          logger.info(`[Realtime] ${channelName} → forcing reconnect on visibility change (state=${chan.state})`);
          if (currentChannel) void supabase.removeChannel(currentChannel);
          setupChannel();
        }
      }
    };

    // Online — network kembali
    const handleOnline = () => {
      logger.info(`[Realtime] ${channelName} → network online, refetching`);
      onChangeRef.current();
      const chan = currentChannel as unknown as { state?: string } | null;
      if (chan && chan.state && chan.state !== 'joined') {
        if (currentChannel) void supabase.removeChannel(currentChannel);
        setupChannel();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      if (currentChannel) void supabase.removeChannel(currentChannel);
    };
  }, [table, filter, schema, debounceMs, heartbeatMs]);

  return { status };
};
