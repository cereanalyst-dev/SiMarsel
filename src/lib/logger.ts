// Logger gated by environment.
// Production build: no-op untuk log/info (console.error/warn tetap keluar
// supaya critical issues tetap terlihat di Sentry/log aggregator).
// Dev build: forwarded ke console.* dengan prefix [SiMarsel].
//
// Usage:
//   import { logger } from '@/lib/logger';
//   logger.info('Fetching...', { userId });
//   logger.warn('Slow query');
//   logger.error('Failed upload', err);

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
const PREFIX = '[SiMarsel]';

type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => {};

export const logger = {
  info:  (isDev ? ((...args: unknown[]) => console.log(PREFIX, ...args)) : noop) as LogFn,
  debug: (isDev ? ((...args: unknown[]) => console.debug(PREFIX, ...args)) : noop) as LogFn,
  warn:  ((...args: unknown[]) => console.warn(PREFIX, ...args)) as LogFn,
  error: ((...args: unknown[]) => console.error(PREFIX, ...args)) as LogFn,
};
