import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { WORKSPACE_KEY } from '@app/session/workspaceStore';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { AGENT_NO_BRANDS, CUSTOMER_ADMIN, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

describe('brand switcher', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('is hidden without workspaces', async () => {
    storeSession();
    mockFetch(meAs(AGENT_NO_BRANDS));
    renderApp('/');
    expect(await screen.findByText('Welcome, Arun Agent')).toBeVisible();
    expect(screen.queryByText(/^Brand:/)).toBeNull();
  });

  it('lists brands and switches', async () => {
    storeSession();
    mockFetch(meAs(CUSTOMER_ADMIN));
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Brand: Brand A' }));
    await user.click(screen.getByRole('menuitem', { name: 'Brand B' }));
    expect(await screen.findByRole('button', { name: 'Brand: Brand B' })).toBeVisible();
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe('w2');
  });

  it('shows a single brand as a label, not a menu', async () => {
    storeSession();
    mockFetch(meAs(WORKSPACE_MANAGER));
    renderApp('/');
    expect(await screen.findByText('Brand: Brand A')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Brand: Brand A' })).toBeNull();
  });

  it('switcherSkipsDisabledBrand', async () => {
    storeSession();
    localStorage.setItem(WORKSPACE_KEY, 'w1');
    const off = { by: 'am', level: 'PLATFORM' as const, at: '2026-10-20T10:00:00Z' };
    mockFetch(
      meAs({
        ...CUSTOMER_ADMIN,
        workspaces: [{ ...CUSTOMER_ADMIN.workspaces[0], disabled: off, authorities: [] }, CUSTOMER_ADMIN.workspaces[1]],
      }),
    );
    renderApp('/');
    expect(await screen.findByText('Brand: Brand B')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Brand:/ })).toBeNull();
  });
});
