// Manual "Fetch Sekarang" endpoint — dipanggil dari tombol di tab Settings.
// Auth: pakai Bearer access_token dari session Supabase user yang login.

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { syncAllEnabled, todayWIB } from '../_lib/markazClient';

export const config = { runtime: 'nodejs' };

interface SyncNowBody {
  date?: string;
  platforms?: string[];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  // ---------- Auth: validate user session ----------
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return Response.json({ ok: false, error: 'Missing Bearer token' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return Response.json(
      { ok: false, error: 'Missing SUPABASE_URL / SUPABASE_ANON_KEY' },
      { status: 500 },
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return Response.json({ ok: false, error: 'Invalid session' }, { status: 401 });
  }
  const userId = userData.user.id;

  // ---------- Parse body ----------
  let body: SyncNowBody = {};
  try {
    const raw = await req.text();
    if (raw) body = JSON.parse(raw) as SyncNowBody;
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : todayWIB();

  const platformsOverride = Array.isArray(body.platforms)
    ? body.platforms.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : undefined;

  // ---------- Run sync pakai admin client (bypass RLS untuk insert) ----------
  try {
    const admin = getSupabaseAdmin();
    const results = await syncAllEnabled({
      admin,
      userId,
      date,
      platformsOverride,
    });
    return Response.json({
      ok: true,
      date,
      totalPlatforms: results.length,
      successes: results.filter((r) => !r.error).length,
      errors: results.filter((r) => r.error).length,
      results,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
