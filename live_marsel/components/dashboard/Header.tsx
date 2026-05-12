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
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
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
    <header className="border-b-[3px] border-nb-black bg-nb-black sticky top-0 z-30">
      <div className="max-w-screen mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-4 flex-wrap">
        {/* Logo + brand */}
        <div className="flex items-center gap-3 md:gap-4">
          <Badge variant="yellow" className="!text-xl md:!text-2xl !px-4 md:!px-5 !py-2 md:!py-2.5 !tracking-wider">
            LIVE
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl xl:text-5xl tracking-tight text-white">
            DASHBOARD
          </h1>
          <div className="hidden md:flex items-center gap-2 ml-2 px-3 py-1.5 bg-nb-lime border-[2.5px] border-white">
            <span className="w-2.5 h-2.5 rounded-full bg-nb-black animate-pulse" />
            <span className="text-sm font-display uppercase tracking-wider text-nb-black">
              Realtime
            </span>
          </div>
        </div>

        {/* Period + clock + auth */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="yellow" className="!text-lg md:!text-xl !py-2 !px-4">
            {monthNameID(period.month).toUpperCase()} {period.year}
          </Badge>
          <code className="text-base md:text-lg font-mono font-bold text-white hidden md:inline px-3 py-2 bg-nb-black border-[2.5px] border-white">
            {now}
          </code>
          {isAuth ? (
            <Link href="/settings/periode">
              <Button variant="cyan" size="md">Setting</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="pink" size="md">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
