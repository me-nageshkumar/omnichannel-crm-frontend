import { afterEach, describe, expect, it, vi } from 'vitest';
import { login, logout, setInitialPassword, verifyOtp } from '@app/api/auth';
import { messageFor } from '@app/api/messages';
import { ApiError } from '@app/api/client';
import { mockFetch, rejectionOf, requestTo } from '../../test/fetchMock';

describe('auth api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('login without two-factor is signed in', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 200, body: { token: 't1', expiresAt: '2026-10-20T00:00:00Z' } } });
    await expect(login('nageshk', 'pw')).resolves.toEqual({
      kind: 'signedIn',
      token: 't1',
      expiresAt: '2026-10-20T00:00:00Z',
    });
  });

  it('login with two-factor needs a code', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 200, body: { twoFactorRequired: true, twoFactorToken: 'p1' } } });
    await expect(login('nageshk', 'pw')).resolves.toEqual({ kind: 'twoFactorRequired', twoFactorToken: 'p1' });
  });

  it('lockout carries retryAfterSeconds and a minutes message', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 429, body: { error: 'too_many_attempts', retryAfterSeconds: 1800 } } });
    const err = await rejectionOf<ApiError>(login('nageshk', 'pw'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.retryAfterSeconds).toBe(1800);
    expect(messageFor(err)).toBe('Too many attempts. Try again in 30 minutes.');
  });

  it('lockout under a minute says 1 minute', () => {
    const err = new ApiError(429, 'TOO_MANY_ATTEMPTS', 45);
    expect(messageFor(err)).toBe('Too many attempts. Try again in 1 minute.');
  });

  it('maps known codes to messages', () => {
    expect(messageFor(new ApiError(401, 'invalid_credentials'))).toBe('Invalid username or password.');
    expect(messageFor(new ApiError(401, 'account_inactive'))).toBe('This account is inactive.');
    expect(messageFor(new ApiError(401, 'invalid_otp'))).toBe('That code is not valid. Try again.');
    expect(messageFor(new ApiError(400, 'INVALID_OTP'))).toBe('That code is not valid. Try again.');
    expect(messageFor(new ApiError(401, 'invalid_token'))).toBe('Your sign-in took too long. Please log in again.');
    expect(messageFor(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });

  it('verifyOtp sends the pending token and code', async () => {
    const fetch = mockFetch({
      'POST /api/auth/verify-otp': { status: 200, body: { token: 't2', expiresAt: '2026-10-20T00:00:00Z' } },
    });
    await expect(verifyOtp('p1', '123456')).resolves.toEqual({
      kind: 'signedIn',
      token: 't2',
      expiresAt: '2026-10-20T00:00:00Z',
    });
    const req = requestTo(fetch, 'POST /api/auth/verify-otp');
    expect(req?.headers.get('Authorization')).toBe('Bearer p1');
    expect(req?.body).toEqual({ otp: '123456' });
  });

  it('logout posts with the bearer token', async () => {
    const fetch = mockFetch({ 'POST /api/auth/logout': { status: 204 } });
    await expect(logout('t1')).resolves.toBeUndefined();
    expect(requestTo(fetch, 'POST /api/auth/logout')?.headers.get('Authorization')).toBe('Bearer t1');
  });
});

describe('first-login password change API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('login reports passwordChangeRequired', async () => {
    mockFetch({
      'POST /api/auth/login': { status: 200, body: { passwordChangeRequired: true, passwordChangeToken: 'pc' } },
    });
    expect(await login('u', 'p')).toEqual({ kind: 'passwordChangeRequired', passwordChangeToken: 'pc' });
  });

  it('verifyOtp reports passwordChangeRequired', async () => {
    mockFetch({
      'POST /api/auth/verify-otp': { status: 200, body: { passwordChangeRequired: true, passwordChangeToken: 'pc' } },
    });
    expect(await verifyOtp('p', '123456')).toEqual({ kind: 'passwordChangeRequired', passwordChangeToken: 'pc' });
  });

  it('setInitialPassword posts with the change token', async () => {
    const fetch = mockFetch({
      'POST /api/auth/initial-password': { status: 200, body: { token: 't', expiresAt: '2030-01-01T00:00:00Z' } },
    });
    expect(await setInitialPassword('pc', 'new-password-1')).toEqual({ token: 't', expiresAt: '2030-01-01T00:00:00Z' });
    expect(requestTo(fetch, 'POST /api/auth/initial-password')?.headers.get('Authorization')).toBe('Bearer pc');
  });
});
