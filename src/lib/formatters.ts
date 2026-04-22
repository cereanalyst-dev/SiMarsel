import {
  APP_NAME_STRIP_PREFIX, APP_SHORT_NAMES, CURRENCY, LOCALE,
} from '../config/app.config';

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat(LOCALE).format(value);

export const getShortAppName = (name: string): string => {
  const key = (name || '').toUpperCase();
  if (APP_SHORT_NAMES[key]) return APP_SHORT_NAMES[key];
  return (name || '').replace(APP_NAME_STRIP_PREFIX, '');
};
