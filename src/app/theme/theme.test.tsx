import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { BRAND_KEY, CONTRAST_KEY, THEME_KEY } from '@app/theme/themeStore';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { CUSTOMER_ADMIN, meAs, storeSession } from '../../test/session';

const CLASSES = ['pf-v6-theme-dark', 'pf-v6-theme-felt', 'pf-v6-theme-glass', 'pf-v6-theme-high-contrast'];

/** Controllable prefers-color-scheme and prefers-contrast queries; setters fire their change listeners. */
function system({ dark = false, moreContrast = false } = {}) {
  const state = { dark, moreContrast };
  const listeners = new Map<string, Set<(e: { matches: boolean }) => void>>();
  const matches = (query: string) =>
    (query === '(prefers-color-scheme: dark)' && state.dark) ||
    (query === '(prefers-contrast: more)' && state.moreContrast);
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return matches(query);
      },
      media: query,
      addEventListener: (_: string, l: (e: { matches: boolean }) => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)?.add(l);
      },
      removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.get(query)?.delete(l),
    })),
  );
  const fire = (query: string) => act(() => listeners.get(query)?.forEach((l) => l({ matches: matches(query) })));
  return {
    setDark(next: boolean) {
      state.dark = next;
      fire('(prefers-color-scheme: dark)');
    },
    setMoreContrast(next: boolean) {
      state.moreContrast = next;
      fire('(prefers-contrast: more)');
    },
  };
}

const has = (cls: string) => document.documentElement.classList.contains(`pf-v6-theme-${cls}`);

async function openPanel(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Theme settings' }));
  return screen.findByRole('dialog', { name: 'Theme settings' });
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(...CLASSES);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults: default theme, colours follow the computer, glass contrast', async () => {
    system({ dark: true });
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme settings' });
    expect(has('dark')).toBe(true);
    expect(has('glass')).toBe(true);
    expect(has('felt')).toBe(false);
    expect(has('high-contrast')).toBe(false);
  });

  it('switches live when the computer changes while matching it', async () => {
    const sys = system({ dark: false });
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme settings' });
    expect(has('dark')).toBe(false);
    sys.setDark(true);
    expect(has('dark')).toBe(true);
  });

  it('the panel shows the three groups with the current choices pressed', async () => {
    system();
    mockFetch({});
    const { user } = renderApp('/login');
    const panel = await openPanel(user);
    for (const group of ['Theme', 'Color scheme', 'Contrast']) {
      expect(within(panel).getByRole('group', { name: group })).toBeVisible();
    }
    expect(within(panel).getByRole('button', { name: 'Default', pressed: true })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'System', pressed: true })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Glass', pressed: true })).toBeVisible();
  });

  it('dark can be chosen on the login page and is remembered', async () => {
    system({ dark: false });
    mockFetch({});
    const { user } = renderApp('/login');
    const panel = await openPanel(user);
    await user.click(
      within(within(panel).getByRole('group', { name: 'Color scheme' })).getByRole('button', { name: 'Dark' }),
    );
    expect(has('dark')).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('a stored colour choice beats the computer', async () => {
    const sys = system({ dark: true });
    localStorage.setItem(THEME_KEY, 'light');
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme settings' });
    expect(has('dark')).toBe(false);
    sys.setDark(true);
    expect(has('dark')).toBe(false);
  });

  it('treats unknown stored values as the defaults', async () => {
    system({ dark: true });
    localStorage.setItem(THEME_KEY, 'purple');
    localStorage.setItem(CONTRAST_KEY, 'sparkly');
    localStorage.setItem(BRAND_KEY, 'neon');
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme settings' });
    expect(has('dark')).toBe(true);
    expect(has('glass')).toBe(true);
    expect(has('felt')).toBe(false);
  });

  it('Project Felt is applied and remembered', async () => {
    system();
    mockFetch({});
    const { user } = renderApp('/login');
    const panel = await openPanel(user);
    await user.click(within(panel).getByRole('button', { name: 'Project Felt' }));
    expect(has('felt')).toBe(true);
    expect(localStorage.getItem(BRAND_KEY)).toBe('felt');
  });

  it('high contrast replaces glass and is remembered', async () => {
    system();
    mockFetch({});
    const { user } = renderApp('/login');
    const panel = await openPanel(user);
    await user.click(within(panel).getByRole('button', { name: 'High contrast' }));
    expect(has('high-contrast')).toBe(true);
    expect(has('glass')).toBe(false);
    expect(localStorage.getItem(CONTRAST_KEY)).toBe('high-contrast');
    await user.click(within(panel).getByRole('button', { name: 'Default', pressed: false }));
    expect(has('high-contrast')).toBe(false);
    expect(has('glass')).toBe(false);
  });

  it('contrast System follows the computer, live', async () => {
    const sys = system({ moreContrast: false });
    localStorage.setItem(CONTRAST_KEY, 'system');
    mockFetch({});
    renderApp('/login');
    await screen.findByRole('button', { name: 'Theme settings' });
    expect(has('high-contrast')).toBe(false);
    sys.setMoreContrast(true);
    expect(has('high-contrast')).toBe(true);
  });

  it('is in the top bar when signed in', async () => {
    system();
    storeSession();
    mockFetch(meAs(CUSTOMER_ADMIN));
    const { user } = renderApp('/');
    const panel = await openPanel(user);
    await user.click(
      within(within(panel).getByRole('group', { name: 'Color scheme' })).getByRole('button', { name: 'Dark' }),
    );
    expect(has('dark')).toBe(true);
  });
});
