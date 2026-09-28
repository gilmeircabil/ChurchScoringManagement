/**
 * Development-only logging.
 *
 * Production builds must never write diagnostics to the device console: logs can
 * leak user data (player names, scores) into OS log collectors and into
 * third-party crash tooling. Every call here is a no-op outside development.
 */

const isDev: boolean =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

/**
 * Tests deliberately exercise error paths, which would otherwise bury real
 * failures under expected console output. Set LOG_ERRORS_IN_TESTS=1 to re-enable.
 */
const shouldLog: boolean =
  isDev && (process.env.NODE_ENV !== 'test' || process.env.LOG_ERRORS_IN_TESTS === '1');

export const isDevelopment = isDev;

function stringify(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[unserializable value]';
  }
}

export function logError(context: string, error?: unknown): void {
  if (!shouldLog) return;
  if (error === undefined) {
    console.error(`[${context}]`);
  } else {
    console.error(`[${context}] ${stringify(error)}`);
  }
}

export function logWarn(context: string, error?: unknown): void {
  if (!shouldLog) return;
  if (error === undefined) {
    console.warn(`[${context}]`);
  } else {
    console.warn(`[${context}] ${stringify(error)}`);
  }
}

export function logInfo(context: string, message?: unknown): void {
  if (!shouldLog) return;
  if (message === undefined) {
    console.log(`[${context}]`);
  } else {
    console.log(`[${context}] ${stringify(message)}`);
  }
}
