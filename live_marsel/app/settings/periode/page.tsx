import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Header } from '@/components/dashboard/Header';
import { SettingsPeriodCard } from '@/components/dashboard/SettingsPeriodCard';
import { parsePeriodParam } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function SettingsPeriodePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/settings/periode${sp.period ? `?period=${sp.period}` : ''}`);

  const period = parsePeriodParam(sp.period);

  return (
    <>
      <Header period={period} />
      <main className="max-w-screen mx-auto px-4 md:px-6 py-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/" className="text-sm font-bold text-nb-black/70 hover:text-nb-black">
            ← Dashboard
          </Link>
          <span className="text-sm font-bold text-nb-black/40">/</span>
          <span className="text-sm font-bold">Pengaturan Periode</span>
        </div>
        <SettingsPeriodCard initialYear={period.year} initialMonth={period.month} />
      </main>
    </>
  );
}
