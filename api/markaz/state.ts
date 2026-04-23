// CRUD api_sync_state dari dashboard (tab Settings).
//   GET  → list semua platform config untuk user yang login
//   POST → upsert satu platform config (platform, enabled)
//   DELETE?platform=xxx → hapus config platform
//
// Auth: pakai Bearer access_token dari Supabase session.

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'nodejs' };

async function resolveUser(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return { error: 'Missing Bearer token', status: 401 };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { error: 'Missing SUPABASE_URL / SUPABASE_ANON_KEY', status: 500 };
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return { error: 'Invalid session', status: 401 };
  return { client, userId: data.user.id };
}

export default async function handler(req: Request): Promise<Response> {
  const auth = await resolveUser(req);
  if ('error' in auth) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { client, userId } = auth;

  try {
    if (req.method === 'GET') {
      const { data, error } = await client
        .from('api_sync_state')
        .select('*')
        .eq('user_id', userId)
        .order('platform', { ascending: true });
      if (error) throw error;
      return Response.json({ ok: true, data: data ?? [] });
    }

    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { platform?: string; enabled?: boolean };
      const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
      if (!platform) {
        return Response.json({ ok: false, error: 'platform wajib diisi' }, { status: 400 });
      }
      const enabled = body.enabled !== false;
      const { error } = await client
        .from('api_sync_state')
        .upsert({ user_id: userId, platform, enabled }, { onConflict: 'user_id,platform' });
      if (error) throw error;
      return Response.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const platform = (url.searchParams.get('platform') || '').trim().toLowerCase();
      if (!platform) {
        return Response.json({ ok: false, error: 'platform query param wajib' }, { status: 400 });
      }
      const { error } = await client
        .from('api_sync_state')
        .delete()
        .eq('user_id', userId)
        .eq('platform', platform);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
