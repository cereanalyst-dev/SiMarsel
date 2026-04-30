// AI Chat endpoint — Asisten AI di SiMarsel.
//
// Pakai Anthropic Claude API. Bisa diganti provider lain tinggal swap
// callLLM() function (misal OpenAI, Gemini, dll).
//
// Auth: pakai Bearer access_token dari Supabase session user.
// Context: di-fetch dari Supabase server-side (bypass RLS pakai admin
// supaya AI bisa lihat overview stats + data summary tanpa expose
// service_role key ke browser).

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

export const config = { runtime: 'edge' };

type ContextType = 'analytics' | 'recommendation' | 'copy' | 'free';

interface ChatRequest {
  query: string;
  contextType: ContextType;
  platform?: string;        // optional: filter context by platform
}

const SYSTEM_PROMPTS: Record<ContextType, string> = {
  analytics: `Kamu adalah analis marketing senior untuk SiMarsel — dashboard analytics
multi-platform (JADIASN, JADIBUMN, CEREBRUM, JADIPOLISI, JADIPRAJURIT, JADISEKDIN).

Tugas: jawab pertanyaan tentang trend revenue, conversion, kinerja platform.
Berikan analisis yang konkret dengan angka, identifikasi 2-3 faktor
penyebab utama, dan saran actionable.

Format jawaban: ringkas, pakai bullet/heading, bahasa Indonesia profesional.
Selalu cantumkan angka + persen dari data yang dikasih.`,

  recommendation: `Kamu adalah strategist produk untuk platform edukasi/bimbel online.
Tugas: kasih rekomendasi paket baru, pricing, atau strategi promo berdasarkan
data historis yang dilampirkan.

Format: 2-3 ide spesifik, masing-masing punya: nama paket, harga estimasi,
target audience, alasan based on data. Bahasa Indonesia, fokus actionable.`,

  copy: `Kamu adalah copywriter untuk platform edukasi (try out, bimbel CPNS/BUMN/dll)
yang fokus ke audience Indonesia gen-Z + millennial.

Tugas: buat copy untuk konten sosial media (TikTok/Instagram/Twitter).
Style: punchy hook, 3-5 kalimat, ada CTA jelas, gunakan tone yang
relate ke target (mahasiswa/freshgraduate yang lagi prep tes).

Format: kasih 2-3 variasi (untuk A/B test). Bahasa Indonesia santai
tapi engaging, hindari klise.`,

  free: `Kamu asisten AI untuk SiMarsel marketing dashboard. Jawab pertanyaan
user dengan menggunakan context data yang dilampirkan. Bahasa Indonesia.`,
};

// Build context dari Supabase berdasarkan tipe pertanyaan.
//
// Strategi: pakai SQL views yang sudah pre-aggregated supaya AI dapet
// FULL history tanpa kena token limit. Daily / monthly / paket views
// hasilnya kompak (ratusan row max), bukan ratusan ribu raw transactions.
async function buildContext(
  type: ContextType,
  platform?: string,
): Promise<string> {
  const admin = getSupabaseAdmin();

  if (type === 'analytics') {
    // FULL history per bulan per app + global stats.
    // View transactions_monthly_by_app return ~24 bulan × 7 app = ~168 row.
    // Aman di token budget Claude (200K).
    const [{ data: stats }, { data: monthly }] = await Promise.all([
      admin.from('overview_stats').select('*').maybeSingle(),
      admin
        .from('transactions_monthly_by_app')
        .select('*')
        .order('year_month', { ascending: true }),  // oldest → newest
    ]);

    const filtered = platform
      ? (monthly ?? []).filter((m) => String(m.source_app ?? '').toLowerCase() === platform.toLowerCase())
      : monthly ?? [];

    return `# Overview Stats (all-time)\n${JSON.stringify(stats, null, 2)}\n\n` +
      `# Revenue & transaksi per bulan per app (FULL HISTORY, paling lama → terbaru)\n` +
      `Total ${filtered.length} baris.\n${JSON.stringify(filtered, null, 2)}`;
  }

  if (type === 'recommendation') {
    // Aggregate FULL history per paket per app.
    // packages_summary view sudah aggregated — top paket berdasar revenue.
    let query = admin
      .from('packages_summary')
      .select('*')
      .order('total_revenue', { ascending: false })
      .limit(200); // top 200 paket buat keep token reasonable
    if (platform) query = query.eq('source_app', platform.toUpperCase());
    const [
      { data: packages },
      { data: monthly },
    ] = await Promise.all([
      query,
      // Plus monthly trend untuk konteks tambahan
      admin
        .from('transactions_monthly_by_app')
        .select('*')
        .order('year_month', { ascending: true }),
    ]);

    const filteredMonthly = platform
      ? (monthly ?? []).filter((m) => String(m.source_app ?? '').toLowerCase() === platform.toLowerCase())
      : monthly ?? [];

    return `# Top Paket berdasarkan revenue (FULL HISTORY)\n` +
      `Total ${(packages ?? []).length} paket.\n${JSON.stringify(packages ?? [], null, 2)}\n\n` +
      `# Trend bulanan per app (untuk konteks musiman)\n${JSON.stringify(filteredMonthly, null, 2)}`;
  }

  if (type === 'copy') {
    // Untuk generate copy: AI butuh tahu nama paket, harga rata-rata,
    // dan popularitas — bukan trend. Top 50 paket cukup.
    let query = admin
      .from('packages_summary')
      .select('source_app, content_name, transaction_count, avg_price, min_price, max_price, total_revenue')
      .order('transaction_count', { ascending: false })
      .limit(50);
    if (platform) query = query.eq('source_app', platform.toUpperCase());
    const { data } = await query;

    const platforms = platform ? [platform.toUpperCase()] : ['SEMUA PLATFORM'];
    return `# Konteks platform: ${platforms.join(', ')}\n\n` +
      `# Top 50 paket terlaris (FULL HISTORY)\n${JSON.stringify(data ?? [], null, 2)}`;
  }

  // type === 'free' — overview + monthly summary
  const [{ data: stats }, { data: monthly }] = await Promise.all([
    admin.from('overview_stats').select('*').maybeSingle(),
    admin
      .from('transactions_monthly_by_app')
      .select('*')
      .order('year_month', { ascending: true }),
  ]);
  return `# Overview Stats (all-time)\n${JSON.stringify(stats, null, 2)}\n\n` +
    `# Revenue & transaksi per bulan per app (full history)\n${JSON.stringify(monthly ?? [], null, 2)}`;
}

// Call Anthropic Claude API
async function callClaude(systemPrompt: string, context: string, userQuery: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY env var. Set di Vercel Settings.');
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const maxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS) || 1024;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Data konteks dari dashboard:\n${context}\n\n---\n\nPertanyaan: ${userQuery}`,
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
    model: string;
  };

  // Concatenate all text blocks
  const text = data.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  return {
    text,
    model: data.model,
    usage: data.usage,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  // Auth check
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

  // Parse body
  let body: ChatRequest;
  try {
    body = await req.json() as ChatRequest;
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.query || typeof body.query !== 'string') {
    return Response.json({ ok: false, error: 'Field "query" wajib' }, { status: 400 });
  }
  const contextType = (body.contextType ?? 'free') as ContextType;
  if (!SYSTEM_PROMPTS[contextType]) {
    return Response.json({ ok: false, error: 'Invalid contextType' }, { status: 400 });
  }

  try {
    const context = await buildContext(contextType, body.platform);
    const result = await callClaude(SYSTEM_PROMPTS[contextType], context, body.query);

    return Response.json({
      ok: true,
      content: result.text,
      model: result.model,
      usage: result.usage,
      contextType,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
