import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SESSION_KEY } from '@app/session/sessionStore';
import { useSession } from '@app/session/SessionContext';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { SUPER_ADMIN, inMs, meRoute, storeSession } from '../../test/session';

const LOGIN_HEADING = 'Log in to your account';
const EXPIRED = 'Your session has expired. Please log in again.';

async function openUserMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Nagesh Kumar/ }));
}

describe('session lifecycle', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dashboard welcomes the user', async () => {
    storeSession();
    mockFetch({ ...meRoute() });
    renderApp('/');
    expect(await screen.findByText('Welcome, Nagesh Kumar')).toBeVisible();
  });

  it('user menu shows name and logs out', async () => {
    storeSession('t1');
    const fetch = mockFetch({ ...meRoute(), 'POST /api/auth/logout': { status: 204 } });
    const { user } = renderApp('/');
    await openUserMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
    expect(requestTo(fetch, 'POST /api/auth/logout')?.headers.get('Authorization')).toBe('Bearer t1');
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it.each([500, 401])('logout still signs out when server answers %i', async (status) => {
    storeSession('t1');
    const fetch = mockFetch({ ...meRoute(), 'POST /api/auth/logout': { status } });
    const { user } = renderApp('/');
    await openUserMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(callsTo(fetch, 'POST /api/auth/logout')).toBe(1);
  });

  it('logout still signs out when the network is down', async () => {
    storeSession('t1');
    mockFetch({ ...meRoute() }); // logout route missing: fetch rejects
    const { user } = renderApp('/');
    await openUserMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('profile item navigates', async () => {
    storeSession();
    mockFetch({ ...meRoute() });
    const { user } = renderApp('/');
    await openUserMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }));
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  it('401 from an API call signs out', async () => {
    storeSession();
    let meCalls = 0;
    const fetch = mockFetch({
      'GET /api/users/me': () => (++meCalls === 1 ? { status: 200, body: SUPER_ADMIN } : { status: 401 }),
    });
    let refresh: (() => Promise<void>) | null = null;
    const Probe = () => {
      refresh = useSession().refreshUser;
      return null;
    };
    renderApp('/', <Probe />);
    expect(await screen.findByText('Welcome, Nagesh Kumar')).toBeVisible();
    await act(async () => {
      await refresh?.().catch(() => undefined);
    });
    expect(await screen.findByText(EXPIRED)).toBeVisible();
    expect(screen.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
    expect(callsTo(fetch, 'POST /api/auth/logout')).toBe(0);
  });

  it('expires at expiresAt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    storeSession('t1', inMs(60_000));
    mockFetch({ ...meRoute() });
    renderApp('/');
    expect(await screen.findByText('Welcome, Nagesh Kumar')).toBeVisible();
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(await screen.findByText(EXPIRED)).toBeVisible();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('a session longer than the timer limit (~24.8 days) is not signed out early', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const day = 24 * 3600_000;
    storeSession('t1', inMs(30 * day));
    mockFetch({ ...meRoute() });
    renderApp('/');
    expect(await screen.findByText('Welcome, Nagesh Kumar')).toBeVisible();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Welcome, Nagesh Kumar')).toBeVisible();
    await act(async () => {
      vi.advanceTimersByTime(29 * day);
    });
    expect(screen.getByText('Welcome, Nagesh Kumar')).toBeVisible();
    await act(async () => {
      vi.advanceTimersByTime(day + 1000);
    });
    expect(await screen.findByText(EXPIRED)).toBeVisible();
  });

  it('already-expired stored session goes to login without asking the server', async () => {
    storeSession('t1', inMs(-60_000));
    const fetch = mockFetch({ ...meRoute() });
    renderApp('/');
    expect(await screen.findByText(EXPIRED)).toBeVisible();
    expect(screen.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible();
    expect(callsTo(fetch, 'GET /api/users/me')).toBe(0);
  });

  it('logout in another tab', async () => {
    storeSession();
    mockFetch({ ...meRoute() });
    renderApp('/');
    expect(await screen.findByText('Welcome, Nagesh Kumar')).toBeVisible();
    act(() => {
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, newValue: null }));
    });
    expect(await screen.findByText('You were logged out in another tab.')).toBeVisible();
    await waitFor(() => expect(screen.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible());
  });
});
