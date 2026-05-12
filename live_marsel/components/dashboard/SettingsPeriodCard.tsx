'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { MONTH_NAMES_ID } from '@/lib/utils';

interface Props {
  initialYear: number;
  initialMonth: number;
}

const YEAR_OPTIONS = (() => {
  const now = new Date().getFullYear();
  const arr: number[] = [];
  for (let y = now - 2; y <= now + 1; y++) arr.push(y);
  return arr;
})();

export const SettingsPeriodCard = ({ initialYear, initialMonth }: Props) => {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const periodParam = `${year}-${String(month).padStart(2, '0')}`;

  return (
    <Card variant="paper" className="space-y-5 max-w-2xl">
      <div>
        <h2 className="font-display text-2xl tracking-tight mb-1">Atur Periode</h2>
        <p className="text-sm text-nb-black/60">
          Pilih bulan dan tahun yang ingin ditampilkan di Live Dashboard.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider mb-1.5">Bulan</span>
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES_ID.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider mb-1.5">Tahun</span>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          variant="lime"
          onClick={() => router.push(`/?period=${periodParam}`)}
        >
          Tampilkan ke Dashboard
        </Button>
        <a href={`/?period=${periodParam}`} target="_blank" rel="noreferrer">
          <Button variant="cyan">Buka Tab Baru</Button>
        </a>
      </div>

      <p className="text-xs text-nb-black/50 pt-2 border-t-2 border-dashed border-nb-black/20">
        Tip untuk display TV: pakai tombol <strong>Buka Tab Baru</strong>, fullscreen-kan tab itu (F11),
        dan biarkan terbuka. Data update realtime tanpa reload manual.
      </p>
    </Card>
  );
};
