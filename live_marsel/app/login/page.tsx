'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/settings/periode';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card variant="paper" className="w-full max-w-md !shadow-nb">
        <div className="space-y-1 mb-6">
          <Badge variant="black" className="!text-base !px-3 !py-1">LIVE</Badge>
          <h1 className="font-display text-3xl tracking-tight pt-3">Login</h1>
          <p className="text-sm text-nb-black/60">
            Untuk mengakses pengaturan periode dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-display uppercase tracking-wider mb-1.5">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="anda@email.com"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-display uppercase tracking-wider mb-1.5">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && (
            <div className="border-2 border-nb-black bg-nb-red/10 px-3 py-2 text-sm font-bold text-nb-red">
              {error}
            </div>
          )}

          <Button type="submit" variant="lime" className="w-full" disabled={loading}>
            {loading ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>

        <div className="text-center pt-4 mt-4 border-t-2 border-dashed border-nb-black/20">
          <Link href="/" className="text-xs font-bold text-nb-black/60 hover:text-nb-black">
            ← Kembali ke Dashboard
          </Link>
        </div>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
