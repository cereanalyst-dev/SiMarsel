import { describe, expect, it } from 'vitest';
import { formatCurrency, formatNumber, getShortAppName } from './formatters';

describe('formatCurrency', () => {
  it('formats Rupiah with thousand separators and no decimals', () => {
    expect(formatCurrency(1500000)).toMatch(/Rp\s?1\.500\.000/);
  });
  it('handles zero', () => {
    expect(formatCurrency(0)).toMatch(/Rp\s?0/);
  });
});

describe('formatNumber', () => {
  it('formats with id-ID locale grouping', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
  });
});

describe('getShortAppName', () => {
  it.each([
    ['JADIASN', 'ASN'],
    ['JADIBUMN', 'BUMN'],
    ['JADIPOLRI', 'Polri'],
    ['JADIPPPK', 'PPPK'],
    ['JADITNI', 'TNI'],
    ['JADICPNS', 'CPNS'],
    ['CEREBRUM', 'Cerebrum'],
  ])('maps %s to %s', (input, expected) => {
    expect(getShortAppName(input)).toBe(expected);
  });

  it('strips generic JADI prefix', () => {
    expect(getShortAppName('JADIXYZ')).toBe('XYZ');
  });

  it('is safe for undefined / empty input', () => {
    expect(getShortAppName('')).toBe('');
  });
});
