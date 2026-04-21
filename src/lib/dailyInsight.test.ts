import { describe, expect, it } from 'vitest';
import { generateDailyInsight } from './dailyInsight';

describe('generateDailyInsight', () => {
  it('returns a placeholder when nothing happened', () => {
    expect(generateDailyInsight(0, 0, 0, [], [])).toMatch(/Tidak ada aktivitas/);
  });

  it('flags high-revenue day', () => {
    const text = generateDailyInsight(12_000_000, 80, 500, [], []);
    expect(text).toMatch(/High Revenue Day/);
  });
});
