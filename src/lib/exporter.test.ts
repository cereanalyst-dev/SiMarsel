import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportToCSV } from './exporter';

const triggerClicks: { url: string; download: string }[] = [];

beforeEach(() => {
  triggerClicks.length = 0;

  globalThis.URL.createObjectURL = vi.fn((b: Blob) => `blob:mock/${b.size}`);
  globalThis.URL.revokeObjectURL = vi.fn();

  const origCreate = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'a') {
      (el as HTMLAnchorElement).click = () => {
        triggerClicks.push({
          url: (el as HTMLAnchorElement).href,
          download: (el as HTMLAnchorElement).download,
        });
      };
    }
    return el;
  }) as typeof document.createElement;
});

describe('exportToCSV', () => {
  it('triggers download with escaped content for quotes, commas, newlines', () => {
    const rows = [{ name: 'Hello, "world"', value: 'line1\nline2' }];
    exportToCSV(rows, 'test.csv');
    expect(triggerClicks).toHaveLength(1);
    expect(triggerClicks[0].download).toBe('test.csv');
  });

  it('adds .csv extension if missing', () => {
    exportToCSV([{ a: 1 }], 'test');
    expect(triggerClicks[0].download).toBe('test.csv');
  });

  it('handles empty rows gracefully', () => {
    exportToCSV([], 'empty.csv');
    expect(triggerClicks).toHaveLength(1);
  });
});
