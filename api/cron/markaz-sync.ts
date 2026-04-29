// Vercel Cron endpoint — dipanggil otomatis sesuai jadwal di vercel.json.
//
// Auth: Vercel Cron kirim header `Authorization: Bearer ${CRON_SECRET}`.
// Kita verifikasi supaya endpoint ini gak bisa di-trigger orang random.
//
// Query params (optional):
//   ?daysAgo=N  → fetch data N hari ke belakang dari hari ini WIB.
//                 Default 0 (today). Pakai 1 untuk fetch data kemarin
//                 (cocok untuk cron jam 00:00 WIB yang mau ambil data
//                 hari sebelumnya yang sudah lengkap).
//   ?date=YYYY-MM-DD → fetch tanggal eksplisit (override daysAgo).

import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { syncAllEnabled, todayWIB } from '../_lib/markazClient.js';

export const config = { runtime: 'edge' };

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

  // ---------- Resolve target date ----------
  // Priority: explicit ?date=YYYY-MM-DD > ?daysAgo=N > today (WIB).
  const url = new URL(req.url);
  const explicitDate = url.searchParams.get('date');
  const daysAgoRaw = url.searchParams.get('daysAgo');
  let date: string;
  if (explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    date = explicitDate;
  } else {
    const daysAgo = daysAgoRaw ? Math.max(0, Math.min(365, Number(daysAgoRaw) || 0)) : 0;
    date = todayWIB(new Date(), daysAgo);
  }

  try {
    const admin = getSupabaseAdmin();
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
