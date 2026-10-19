import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_KEY, clearSession, readSession, writeSession } from '@app/session/sessionStore';

const inOneHour = () => new Date(Date.now() + 3600_000).toISOString();

describe('sessionStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a session', () => {
    const s = { token: 't1', expiresAt: inOneHour() };
    writeSession(s);
    expect(readSession()).toEqual(s);
  });

  it('returns null for expired session', () => {
    writeSession({ token: 't1', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(readSession()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    localStorage.setItem(SESSION_KEY, '{oops');
    expect(readSession()).toBeNull();
  });

  it('returns null for missing fields', () => {
    localStorage.setItem(SESSION_KEY, '{"token":"x"}');
    expect(readSession()).toBeNull();
  });

  it('clearSession removes the key', () => {
    writeSession({ token: 't1', expiresAt: inOneHour() });
    clearSession();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readSession()).toBeNull();
    expect(() => writeSession({ token: 't1', expiresAt: inOneHour() })).not.toThrow();
    expect(() => clearSession()).not.toThrow();
  });
});
