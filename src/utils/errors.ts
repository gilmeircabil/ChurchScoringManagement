import { logError } from './logger';

/**
 * An error whose message is written for end users and is therefore safe to show
 * in a dialog.
 *
 * Any other `Error` is treated as an internal failure: its message can contain
 * SQL text, file paths, or library internals, so `getErrorMessage` replaces it
 * with a generic message and logs the real cause in development only.
 *
 * Throw this from repositories and services for conditions the user can act on
 * (locked round, invalid backup, missing record).
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
    // Required so `instanceof` survives TypeScript's ES5 class downlevelling.
    Object.setPrototypeOf(this, UserFacingError.prototype);
  }
}

export function userFacingError(message: string): UserFacingError {
  return new UserFacingError(message);
}

export function isUserFacingError(error: unknown): error is UserFacingError {
  return error instanceof UserFacingError;
}

/**
 * Returns a message that is safe to display to the user.
 *
 * @param error    The caught value.
 * @param fallback Generic message shown when the cause is internal.
 * @param context  Short label used for the development-only log entry.
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
  context = 'unknown'
): string {
  if (isUserFacingError(error)) {
    return error.message;
  }

  logError(context, error);
  return fallback;
}
