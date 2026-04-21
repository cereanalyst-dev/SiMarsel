import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = (): boolean =>
  Boolean(url && anonKey && !url.includes('YOUR-PROJECT'));

// Lazily create the client. Dashboard still works with only localStorage if
// these env vars are missing, but auth + server sync will be disabled.
let _client: SupabaseClient | null = null;
export const getSupabase = (): SupabaseClient | null => {
  if (_client) return _client;
  if (!isSupabaseConfigured()) return null;
  _client = createClient(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
};
