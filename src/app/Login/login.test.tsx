import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { SESSION_KEY } from '@app/session/sessionStore';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { inMs, meRoute, storeSession } from '../../test/session';

const LOGIN_HEADING = 'Log in to your account';

async function submitLogin(user: ReturnType<typeof renderApp>['user']) {
  await user.type(await screen.findByLabelText(/Username/), 'nageshk');
  await user.type(screen.getByLabelText(/Password/), 'pw');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

function stored() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('sign-in', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('redirects to login when signed out', async () => {
    mockFetch({});
    renderApp('/profile');
    expect(await screen.findByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
  });

  it('password can be shown and hidden', async () => {
    mockFetch({});
    const { user } = renderApp('/login');
    const password = await screen.findByLabelText(/Password/);
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('signs in without two-factor', async () => {
    mockFetch({
      'POST /api/auth/login': { status: 200, body: { token: 't1', expiresAt: inMs(3600_000) } },
      ...meRoute(),
    });
    const { user } = renderApp('/login');
    await submitLogin(user);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(stored()?.token).toBe('t1');
  });

  it('returns to the page that was asked for', async () => {
    mockFetch({
      'POST /api/auth/login': { status: 200, body: { token: 't1', expiresAt: inMs(3600_000) } },
      ...meRoute(),
    });
    const { user } = renderApp('/profile');
    await submitLogin(user);
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  it('signs in with a code', async () => {
    const fetch = mockFetch({
      'POST /api/auth/login': { status: 200, body: { twoFactorRequired: true, twoFactorToken: 'p1' } },
      'POST /api/auth/verify-otp': { status: 200, body: { token: 't2', expiresAt: inMs(3600_000) } },
      ...meRoute(),
    });
    const { user } = renderApp('/login');
    await submitLogin(user);
    await user.type(await screen.findByLabelText(/6-digit code/), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const req = requestTo(fetch, 'POST /api/auth/verify-otp');
    expect(req?.headers.get('Authorization')).toBe('Bearer p1');
    expect(req?.body).toEqual({ otp: '123456' });
    expect(stored()?.token).toBe('t2');
  });

  it('wrong code stays on the code screen', async () => {
    mockFetch({
      'POST /api/auth/login': { status: 200, body: { twoFactorRequired: true, twoFactorToken: 'p1' } },
      'POST /api/auth/verify-otp': { status: 401, body: { error: 'invalid_otp' } },
    });
    const { user } = renderApp('/login');
    await submitLogin(user);
    await user.type(await screen.findByLabelText(/6-digit code/), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('That code is not valid. Try again.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Enter your verification code' })).toBeVisible();
  });

  it('expired pending token goes back to login', async () => {
    mockFetch({
      'POST /api/auth/login': { status: 200, body: { twoFactorRequired: true, twoFactorToken: 'p1' } },
      'POST /api/auth/verify-otp': { status: 401, body: { error: 'invalid_token' } },
    });
    const { user } = renderApp('/login');
    await submitLogin(user);
    await user.type(await screen.findByLabelText(/6-digit code/), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Your sign-in took too long. Please log in again.')).toBeVisible();
    expect(screen.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
  });

  it('shows invalid credentials', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 401, body: { error: 'invalid_credentials' } } });
    const { user } = renderApp('/login');
    await submitLogin(user);
    expect(await screen.findByText('Invalid username or password.')).toBeVisible();
  });

  it('shows lockout minutes', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 429, body: { error: 'too_many_attempts', retryAfterSeconds: 1800 } } });
    const { user } = renderApp('/login');
    await submitLogin(user);
    expect(await screen.findByText('Too many attempts. Try again in 30 minutes.')).toBeVisible();
  });

  it('me 401 during sign-in leaves no session', async () => {
    mockFetch({
      'POST /api/auth/login': { status: 200, body: { token: 't1', expiresAt: inMs(3600_000) } },
      'GET /api/users/me': { status: 401 },
    });
    const { user } = renderApp('/login');
    await submitLogin(user);
    expect(await screen.findByText('Your session has expired. Please log in again.')).toBeVisible();
    expect(screen.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).toBeNull();
    expect(stored()).toBeNull();
  });

  it('verify page without pending token goes to login', async () => {
    mockFetch({});
    renderApp('/login/verify');
    expect(await screen.findByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
  });

  it('restores a stored session', async () => {
    storeSession('t9');
    const fetch = mockFetch({ ...meRoute() });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(requestTo(fetch, 'GET /api/users/me')?.headers.get('Authorization')).toBe('Bearer t9');
    expect(callsTo(fetch, 'POST /api/auth/login')).toBe(0);
  });

  it('stored session rejected by server shows expired', async () => {
    storeSession('t9');
    mockFetch({ 'GET /api/users/me': { status: 401 } });
    renderApp('/');
    expect(await screen.findByText('Your session has expired. Please log in again.')).toBeVisible();
    expect(screen.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
    expect(stored()).toBeNull();
  });
});
