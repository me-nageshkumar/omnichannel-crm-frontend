import type { CurrentUser } from '@app/api/users';
import { SESSION_KEY } from '@app/session/sessionStore';
import type { MockRoute } from './fetchMock';

export const SUPER_ADMIN: CurrentUser = {
  id: 'u1',
  name: 'Nagesh Kumar',
  username: 'nageshk',
  email: 'me@example.in',
  mobileNumber: '9928088743',
  role: 'SUPER_ADMIN',
  twoFactorEnabled: false,
};

export const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

/** Stores a session as if the user had logged in earlier; returns its token. */
export function storeSession(token = 'stored-token', expiresAt = inMs(3600_000)): string {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
  return token;
}

/** The GET /api/users/me route answering with {@code user} (default: the super admin). */
export function meRoute(user: Partial<CurrentUser> = {}): Record<string, MockRoute> {
  return { 'GET /api/users/me': { status: 200, body: { ...SUPER_ADMIN, ...user } } };
}
