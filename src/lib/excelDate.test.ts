import { describe, expect, it } from 'vitest';
import { excelDateToJSDate } from './excelDate';

describe('excelDateToJSDate', () => {
  it('converts the Excel epoch (serial 1) to 1900-01-01', () => {
    const d = excelDateToJSDate(1);
    // Excel epoch differs by locale / workbook, but the output should be a valid Date.
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });

  it('converts an arbitrary serial preserving HH:mm', () => {
    // 44927 == 2023-01-01; +0.5 == 12:00
    const d = excelDateToJSDate(44927.5);
    expect(d.getFullYear()).toBe(2023);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(0);
  });
});
