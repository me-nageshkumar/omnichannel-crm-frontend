import { ApiError } from '@app/api/client';

export const MESSAGES = {
  sessionExpired: 'Your session has expired. Please log in again.',
  loggedOutElsewhere: 'You were logged out in another tab.',
  generic: 'Something went wrong. Please try again.',
};

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Invalid username or password.',
  account_inactive: 'This account is inactive.',
  invalid_otp: 'That code is not valid. Try again.',
  invalid_token: 'Your sign-in took too long. Please log in again.',
};

/** The user-facing sentence for an error from the API layer. */
export function messageFor(error: unknown): string {
  if (!(error instanceof ApiError) || !error.code) return MESSAGES.generic;
  const code = error.code.toLowerCase();
  if (code === 'too_many_attempts') {
    const minutes = Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60));
    return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
  }
  return BY_CODE[code] ?? MESSAGES.generic;
}
