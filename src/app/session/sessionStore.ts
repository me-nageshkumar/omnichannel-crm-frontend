export const SESSION_KEY = 'omnichannel.session';

export interface StoredSession {
  token: string;
  expiresAt: string;
}

/** The stored session, or null when missing, unreadable, malformed or already expired. */
export function readSession(now: Date = new Date()): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.token !== 'string' || typeof parsed?.expiresAt !== 'string') return null;
    const expires = new Date(parsed.expiresAt).getTime();
    if (Number.isNaN(expires) || expires <= now.getTime()) return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

/** True when something is stored under the key, valid or not (used to tell "expired" from "never signed in"). */
export function hasStoredValue(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) !== null;
  } catch {
    return false;
  }
}

export function writeSession(session: StoredSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // storage blocked (private mode, quota): the session lives only in memory for this tab
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing to clear
  }
}
