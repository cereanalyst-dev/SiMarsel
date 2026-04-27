// Vercel Cron endpoint — dipanggil otomatis sesuai jadwal di vercel.json.
// Default: jam 12:00 & 23:59 WIB setiap hari.
//
// Auth: Vercel Cron kirim header `Authorization: Bearer ${CRON_SECRET}`.
// Kita verifikasi supaya endpoint ini gak bisa di-trigger orang random.

import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { syncAllEnabled, todayWIB } from '../_lib/markazClient.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req: Request): Promise<Response> {
  // ---------- Auth check ----------
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ---------- Env var guard ----------
  const targetUserId = process.env.SYNC_TARGET_USER_ID;
  if (!targetUserId) {
    return Response.json(
      { ok: false, error: 'Missing SYNC_TARGET_USER_ID env var' },
      { status: 500 },
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const date = todayWIB();
    const results = await syncAllEnabled({
      admin,
      userId: targetUserId,
      date,
    });

    const summary = {
      ok: true,
      ranAt: new Date().toISOString(),
      date,
      totalPlatforms: results.length,
      successes: results.filter((r) => !r.error).length,
      errors: results.filter((r) => r.error).length,
      results,
    };
    return Response.json(summary);
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
