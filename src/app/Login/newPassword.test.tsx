import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { SESSION_KEY } from '@app/session/sessionStore';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { CUSTOMER_ADMIN, inMs, meAs } from '../../test/session';

const CHANGE = { status: 200, body: { passwordChangeRequired: true, passwordChangeToken: 'pc1' } };
const ISSUED = { status: 200, body: { token: 'tok', expiresAt: inMs(3600_000) } };

async function login(user: ReturnType<typeof renderApp>['user']) {
  await user.type(await screen.findByLabelText(/Username/), 'ravi');
  await user.type(screen.getByLabelText(/Password/), 'temporary-pw');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

async function choose(user: ReturnType<typeof renderApp>['user'], first: string, second = first) {
  await user.type(await screen.findByLabelText(/^New password/), first);
  await user.type(screen.getByLabelText(/^Confirm new password/), second);
  await user.click(screen.getByRole('button', { name: 'Save and continue' }));
}

describe('first-login password change', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('login with must-change goes to the new password page', async () => {
    mockFetch({ 'POST /api/auth/login': CHANGE });
    const { user } = renderApp('/login');
    await login(user);
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  });

  it('verify-otp with must-change goes to the new password page', async () => {
    mockFetch({
      'POST /api/auth/login': { status: 200, body: { twoFactorRequired: true, twoFactorToken: 'p1' } },
      'POST /api/auth/verify-otp': CHANGE,
    });
    const { user } = renderApp('/login');
    await login(user);
    await user.type(await screen.findByLabelText(/6-digit code/), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  });

  it('mismatch shows a field error without calling the server', async () => {
    const fetch = mockFetch({ 'POST /api/auth/login': CHANGE });
    const { user } = renderApp('/login');
    await login(user);
    await choose(user, 'long-enough-1', 'long-enough-2');
    expect(await screen.findByText("Passwords don't match.")).toBeVisible();
    expect(callsTo(fetch, 'POST /api/auth/initial-password')).toBe(0);
  });

  it('short password is blocked client side', async () => {
    const fetch = mockFetch({ 'POST /api/auth/login': CHANGE });
    const { user } = renderApp('/login');
    await login(user);
    await choose(user, 'short');
    expect(await screen.findByText('At least 10 characters.')).toBeVisible();
    expect(callsTo(fetch, 'POST /api/auth/initial-password')).toBe(0);
  });

  it('weak password from the server shows its message', async () => {
    mockFetch({
      'POST /api/auth/login': CHANGE,
      'POST /api/auth/initial-password': { status: 400, body: { code: 'WEAK_PASSWORD', message: 'x' } },
    });
    const { user } = renderApp('/login');
    await login(user);
    await choose(user, 'temporary-pw');
    expect(
      await screen.findByText('Use at least 10 characters, different from your temporary password.'),
    ).toBeVisible();
  });

  it('expired change token returns to login with a message', async () => {
    mockFetch({
      'POST /api/auth/login': CHANGE,
      'POST /api/auth/initial-password': { status: 401, body: { code: 'INVALID_TOKEN', message: 'x' } },
    });
    const { user } = renderApp('/login');
    await login(user);
    await choose(user, 'a-brand-new-pw');
    expect(await screen.findByRole('heading', { name: 'Log in to your account' })).toBeVisible();
    expect(screen.getByText('Your sign-in took too long. Please log in again.')).toBeVisible();
  });

  it('success signs in and goes to the page the user wanted', async () => {
    const fetch = mockFetch({
      'POST /api/auth/login': CHANGE,
      'POST /api/auth/initial-password': ISSUED,
      ...meAs(CUSTOMER_ADMIN),
    });
    const { user } = renderApp('/profile');
    await login(user);
    await choose(user, 'a-brand-new-pw');
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
    const req = requestTo(fetch, 'POST /api/auth/initial-password');
    expect(req?.headers.get('Authorization')).toBe('Bearer pc1');
    expect(req?.body).toEqual({ newPassword: 'a-brand-new-pw' });
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) as string).token).toBe('tok');
  });

  it('direct visit without a token redirects to login', async () => {
    mockFetch({});
    renderApp('/login/new-password');
    expect(await screen.findByRole('heading', { name: 'Log in to your account' })).toBeVisible();
  });

  it('never writes the change token to storage', async () => {
    mockFetch({ 'POST /api/auth/login': CHANGE });
    const { user } = renderApp('/login');
    await login(user);
    await screen.findByRole('heading', { name: 'Choose a new password' });
    const all = Object.keys(localStorage)
      .map((k) => localStorage.getItem(k))
      .join(' ');
    expect(all).not.toContain('pc1');
  });
});
