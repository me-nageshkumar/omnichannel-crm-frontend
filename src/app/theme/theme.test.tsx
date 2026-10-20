import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { THEME_KEY } from '@app/theme/themeStore';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { CUSTOMER_ADMIN, meAs, storeSession } from '../../test/session';

const DARK_CLASS = 'pf-v6-theme-dark';

/** A controllable prefers-color-scheme query; {@code setDark} fires its change listeners. */
function systemPrefersDark(initial: boolean) {
  let matches = initial;
  const listeners = new Set<(e: { matches: boolean }) => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query === '(prefers-color-scheme: dark)' && matches;
      },
      media: query,
      addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.add(l),
      removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.delete(l),
    })),
  );
  return {
    setDark(next: boolean) {
      matches = next;
      act(() => listeners.forEach((l) => l({ matches: next })));
    },
  };
}

const isDark = () => document.documentElement.classList.contains(DARK_CLASS);

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('follows the computer by default', async () => {
    systemPrefersDark(true);
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme: Match my computer' });
    expect(isDark()).toBe(true);
  });

  it('switches live when the computer changes while matching it', async () => {
    const system = systemPrefersDark(false);
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme: Match my computer' });
    expect(isDark()).toBe(false);
    system.setDark(true);
    expect(isDark()).toBe(true);
    system.setDark(false);
    expect(isDark()).toBe(false);
  });

  it('can be chosen on the login page and is remembered', async () => {
    systemPrefersDark(false);
    mockFetch({});
    const { user } = renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Theme: Match my computer' }));
    await user.click(screen.getByRole('menuitem', { name: 'Dark' }));
    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(await screen.findByRole('button', { name: 'Theme: Dark' })).toBeVisible();
  });

  it('a stored choice beats the computer, and ignores its changes', async () => {
    const system = systemPrefersDark(true);
    localStorage.setItem(THEME_KEY, 'light');
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme: Light' });
    expect(isDark()).toBe(false);
    system.setDark(true);
    expect(isDark()).toBe(false);
  });

  it('treats an unknown stored value as matching the computer', async () => {
    systemPrefersDark(true);
    localStorage.setItem(THEME_KEY, 'purple');
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme: Match my computer' });
    expect(isDark()).toBe(true);
  });

  it('is in the top bar when signed in', async () => {
    systemPrefersDark(false);
    localStorage.setItem(THEME_KEY, 'dark');
    storeSession();
    mockFetch(meAs(CUSTOMER_ADMIN));
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Theme: Dark' }));
    await user.click(screen.getByRole('menuitem', { name: 'Light' }));
    expect(isDark()).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });
});
