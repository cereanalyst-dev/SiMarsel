import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type DailyInsert = Database['public']['Tables']['daily_data']['Insert'];
type TargetInsert = Database['public']['Tables']['target_configs']['Insert'];
type SocialInsert = Database['public']['Tables']['social_media_contents']['Insert'];

// These shapes match the in-memory AppData structure used by Dashboard.tsx.
// They're intentionally loose (Record-based) so this hook doesn't depend on
// the full Dashboard type file.
export interface SyncableSocialContent {
  id?: string;
  platform?: string;
  postingTime?: string;
  contentType?: string;
  title?: string;
  caption?: string;
  cta?: string;
  topic?: string;
  reach?: number;
  engagement?: number;
  views?: number;
  link?: string;
  objective?: string;
}

export interface SyncableDailyData {
  targetDownloader?: number;
  targetSales?: number;
  targetUserPremium?: number;
  actualDownloader?: number;
  actualSales?: number;
  actualUserPremium?: number;
  estimasiHarga?: number;
  channel?: string;
  promo?: string;
  premium?: string;
  benefit?: string;
  benefit2?: string;
  event?: string;
  activity?: string;
  extra?: string;
  bcan?: string;
  story?: string;
  chat?: string;
  live?: string;
  ads?: string;
  manualTargetSales?: number;
  manualTargetDownloader?: number;
  manualTargetPremium?: number;
  socialContent?: SyncableSocialContent[];
  dailyInsight?: string;
  [key: string]: unknown;
}

export interface SyncableTargetConfig {
  targetDownloader?: number;
  targetUserPremium?: number;
  targetSales?: number;
  targetConversion?: number;
  avgPrice?: number;
  [key: string]: unknown;
}

export interface SyncableApp {
  id: string;
  name: string;
  targetConfig: Record<string, SyncableTargetConfig>;
  dailyData: Record<string, SyncableDailyData>;
  isTargetSet: Record<string, boolean>;
}

// --- Hydration: load everything from Supabase into the AppData[] shape ---

export async function loadAppsFromSupabase(): Promise<SyncableApp[]> {
  const [appsRes, targetsRes, dailyRes, socialRes] = await Promise.all([
    supabase.from('apps').select('*').order('name'),
    supabase.from('target_configs').select('*'),
    supabase.from('daily_data').select('*'),
    supabase.from('social_media_contents').select('*'),
  ]);

  if (appsRes.error) throw appsRes.error;
  if (targetsRes.error) throw targetsRes.error;
  if (dailyRes.error) throw dailyRes.error;
  if (socialRes.error) throw socialRes.error;

  const socialByDailyId = new Map<string, SyncableSocialContent[]>();
  for (const s of socialRes.data ?? []) {
    const arr = socialByDailyId.get(s.daily_data_id) ?? [];
    arr.push({
      id: s.id,
      platform: s.platform ?? '',
      postingTime: s.posting_time ?? '',
      contentType: s.content_type ?? '',
      title: s.title ?? '',
      caption: s.caption ?? '',
      cta: s.cta ?? '',
      topic: s.topic ?? '',
      reach: s.reach ?? 0,
      engagement: s.engagement ?? 0,
      views: s.views ?? 0,
      link: s.link ?? '',
      objective: s.objective ?? '',
    });
    socialByDailyId.set(s.daily_data_id, arr);
  }

  const dailyById = new Map<string, (typeof dailyRes.data)[number]>();
  for (const d of dailyRes.data ?? []) dailyById.set(d.id, d);

  return (appsRes.data ?? []).map((app) => {
    const targetConfig: Record<string, SyncableTargetConfig> = {};
    const isTargetSet: Record<string, boolean> = {};
    for (const t of targetsRes.data ?? []) {
      if (t.app_id !== app.id) continue;
      targetConfig[t.target_month] = {
        targetDownloader: t.target_downloader,
        targetUserPremium: t.target_user_premium,
        targetSales: t.target_sales,
        targetConversion: t.target_conversion,
        avgPrice: t.avg_price,
      };
      isTargetSet[t.target_month] = t.is_target_set;
    }

    const dailyData: Record<string, SyncableDailyData> = {};
    for (const d of dailyRes.data ?? []) {
      if (d.app_id !== app.id) continue;
      dailyData[d.date] = {
        targetDownloader: d.target_downloader,
        targetSales: d.target_sales,
        targetUserPremium: d.target_user_premium,
        manualTargetDownloader: d.manual_target_downloader ?? undefined,
        manualTargetSales: d.manual_target_sales ?? undefined,
        manualTargetPremium: d.manual_target_premium ?? undefined,
        actualDownloader: d.actual_downloader ?? undefined,
        actualSales: d.actual_sales ?? undefined,
        actualUserPremium: d.actual_user_premium ?? undefined,
        estimasiHarga: d.estimasi_harga,
        channel: d.channel ?? '',
        promo: d.promo ?? '',
        premium: d.premium ?? '',
        benefit: d.benefit ?? '',
        benefit2: d.benefit2 ?? '',
        event: d.event ?? '',
        activity: d.activity ?? '',
        extra: d.extra ?? '',
        bcan: d.bcan ?? '',
        story: d.story ?? '',
        chat: d.chat ?? '',
        live: d.live ?? '',
        ads: d.ads ?? '',
        dailyInsight: d.daily_insight ?? '',
        socialContent: socialByDailyId.get(d.id) ?? [],
      };
    }

    return {
      id: app.id,
      name: app.name,
      targetConfig,
      dailyData,
      isTargetSet,
    };
  });
}

// --- Delta-based debounced sync ---

// Maps UI DailyData keys → DB column names.
const DAILY_TEXT_FIELDS: Array<[keyof SyncableDailyData, string]> = [
  ['channel', 'channel'],
  ['promo', 'promo'],
  ['premium', 'premium'],
  ['benefit', 'benefit'],
  ['benefit2', 'benefit2'],
  ['event', 'event'],
  ['activity', 'activity'],
  ['extra', 'extra'],
  ['bcan', 'bcan'],
  ['story', 'story'],
  ['chat', 'chat'],
  ['live', 'live'],
  ['ads', 'ads'],
  ['dailyInsight', 'daily_insight'],
];

function dailyToRow(
  appId: string,
  date: string,
  d: SyncableDailyData,
  updatedBy: string | null
): DailyInsert {
  const row: Record<string, unknown> = {
    app_id: appId,
    date,
    target_downloader: d.targetDownloader ?? 0,
    target_sales: d.targetSales ?? 0,
    target_user_premium: d.targetUserPremium ?? 0,
    manual_target_downloader: d.manualTargetDownloader ?? null,
    manual_target_sales: d.manualTargetSales ?? null,
    manual_target_premium: d.manualTargetPremium ?? null,
    actual_downloader: d.actualDownloader ?? null,
    actual_sales: d.actualSales ?? null,
    actual_user_premium: d.actualUserPremium ?? null,
    estimasi_harga: d.estimasiHarga ?? 0,
    updated_by: updatedBy,
  };
  for (const [uiKey, dbKey] of DAILY_TEXT_FIELDS) {
    const v = d[uiKey];
    row[dbKey] = v == null ? null : v;
  }
  return row as DailyInsert;
}

function targetToRow(
  appId: string,
  month: string,
  t: SyncableTargetConfig,
  isTargetSet: boolean,
  updatedBy: string | null
): TargetInsert {
  return {
    app_id: appId,
    target_month: month,
    target_downloader: t.targetDownloader ?? 0,
    target_user_premium: t.targetUserPremium ?? 0,
    target_sales: t.targetSales ?? 0,
    target_conversion: t.targetConversion ?? 0,
    avg_price: t.avgPrice ?? 0,
    is_target_set: isTargetSet,
    updated_by: updatedBy,
  };
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) {
      return false;
    }
  }
  return true;
}

export interface UseAppsSyncOptions {
  apps: SyncableApp[];
  enabled: boolean;
  userId: string | null;
  debounceMs?: number;
}

// Watches `apps` and, on a debounce, upserts any target_config / daily_data /
// social_media row that has changed since the last successful sync. The first
// snapshot is captured once `enabled` flips true (i.e. after hydration), so
// the very first render after load doesn't trigger writes.
export function useAppsSync({ apps, enabled, userId, debounceMs = 1500 }: UseAppsSyncOptions) {
  const snapshotRef = useRef<Map<string, SyncableApp> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!snapshotRef.current) {
      snapshotRef.current = new Map(apps.map((a) => [a.id, structuredClone(a)]));
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      await syncDeltas(apps, snapshotRef.current!, userId);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [apps, enabled, userId, debounceMs]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!snapshotRef.current) return;
    await syncDeltas(apps, snapshotRef.current, userId);
  }, [apps, userId]);

  return { flush };
}

async function syncDeltas(
  apps: SyncableApp[],
  snapshot: Map<string, SyncableApp>,
  userId: string | null
) {
  const targetRows: TargetInsert[] = [];
  const dailyRows: DailyInsert[] = [];
  const socialInserts: Array<Omit<SocialInsert, 'daily_data_id'>> = [];

  for (const app of apps) {
    const prev = snapshot.get(app.id);

    // Targets
    for (const [month, cfg] of Object.entries(app.targetConfig)) {
      const prevCfg = prev?.targetConfig?.[month];
      const prevFlag = prev?.isTargetSet?.[month] ?? false;
      const curFlag = app.isTargetSet[month] ?? false;
      if (!shallowEqual(prevCfg, cfg) || prevFlag !== curFlag) {
        targetRows.push(targetToRow(app.id, month, cfg, curFlag, userId));
      }
    }

    // Daily data — skip the socialContent array; sent separately
    for (const [date, d] of Object.entries(app.dailyData)) {
      const { socialContent: _s, ...rest } = d;
      const prevD = prev?.dailyData?.[date];
      const { socialContent: _ps, ...prevRest } = prevD ?? {};
      if (!shallowEqual(prevRest, rest)) {
        dailyRows.push(dailyToRow(app.id, date, rest as SyncableDailyData, userId));
      }

      // Social content — only insert rows without an id yet (newly added)
      for (const s of d.socialContent ?? []) {
        if (s.id) continue;
        socialInserts.push({
          app_id: app.id,
          date,
          platform: s.platform ?? 'Instagram',
          posting_time: s.postingTime ?? null,
          content_type: s.contentType ?? null,
          title: s.title ?? null,
          caption: s.caption ?? null,
          cta: s.cta ?? null,
          topic: s.topic ?? null,
          objective: s.objective ?? null,
          link: s.link ?? null,
          reach: s.reach ?? 0,
          engagement: s.engagement ?? 0,
          views: s.views ?? 0,
          updated_by: userId,
        } as Omit<SocialInsert, 'daily_data_id'>);
      }
    }
  }

  try {
    if (targetRows.length) {
      const { error } = await supabase
        .from('target_configs')
        .upsert(targetRows, { onConflict: 'app_id,target_month' });
      if (error) throw error;
    }
    if (dailyRows.length) {
      const { data, error } = await supabase
        .from('daily_data')
        .upsert(dailyRows, { onConflict: 'app_id,date' })
        .select('id, app_id, date');
      if (error) throw error;

      // For any new social rows, we need the parent daily_data_id. Map by (app_id,date).
      if (socialInserts.length && data) {
        const byKey = new Map<string, string>();
        for (const row of data) byKey.set(`${row.app_id}|${row.date}`, row.id);
        // Also hit existing rows that weren't just upserted.
        const missingKeys = socialInserts
          .map((s) => `${s.app_id}|${s.date}`)
          .filter((k) => !byKey.has(k));
        if (missingKeys.length) {
          const keys = Array.from(new Set(missingKeys));
          const fetches = await Promise.all(
            keys.map(async (k) => {
              const [appId, date] = k.split('|');
              const { data: row } = await supabase
                .from('daily_data')
                .select('id, app_id, date')
                .eq('app_id', appId)
                .eq('date', date)
                .maybeSingle();
              return row;
            })
          );
          for (const row of fetches) {
            if (row) byKey.set(`${row.app_id}|${row.date}`, row.id);
          }
        }
        const withParent: SocialInsert[] = socialInserts
          .map((s) => {
            const parentId = byKey.get(`${s.app_id}|${s.date}`);
            if (!parentId) return null;
            return { ...s, daily_data_id: parentId } as SocialInsert;
          })
          .filter((r): r is SocialInsert => r !== null);
        if (withParent.length) {
          const { error: socErr } = await supabase
            .from('social_media_contents')
            .insert(withParent);
          if (socErr) throw socErr;
        }
      }
    }

    // Update snapshot to reflect latest state
    snapshot.clear();
    for (const a of apps) snapshot.set(a.id, structuredClone(a));
  } catch (err) {
    console.error('[apps-sync] failed', err);
    toast.error((err as Error).message || 'Sync failed');
  }
}
