'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { monthNameID } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface Props {
  period: { year: number; month: number };
}

export const Header = ({ period }: Props) => {
  const [now, setNow] = useState<string>('');
  const [isAuth, setIsAuth] = useState<boolean>(false);

  useEffect(() => {
    const tick = () => {
      const d = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date());
      setNow(d);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuth(!!data?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuth(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b-[3px] border-nb-black bg-nb-bg sticky top-0 z-30">
      <div className="max-w-screen mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge variant="black" className="!px-3 !py-1 !text-base">LIVE</Badge>
          <h1 className="font-display text-xl md:text-2xl tracking-tight">
            DASHBOARD
          </h1>
          <div className="hidden md:flex items-center gap-1.5 ml-2">
            <span className="w-2 h-2 rounded-full bg-nb-lime animate-pulse" />
            <span className="text-[10px] font-display uppercase tracking-wider text-nb-black/70">
              Realtime
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="yellow" className="!text-sm md:!text-base !py-1.5 !px-3">
            {monthNameID(period.month)} {period.year}
          </Badge>
          <code className="text-xs md:text-sm font-mono font-bold text-nb-black/80 hidden md:inline">
            {now}
          </code>
          {isAuth ? (
            <Link href="/settings/periode">
              <Button variant="cyan" size="sm">Setting</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="black" size="sm">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
