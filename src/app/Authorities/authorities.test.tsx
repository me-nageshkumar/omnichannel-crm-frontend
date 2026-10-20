import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { rowWith } from '../../test/admin';
import { AUTHORITY_LIST, PROBE } from '../../test/authorities';

function routes(extra = {}) {
  return {
    ...meAs(SUPER_ADMIN),
    'GET /api/authorities': { status: 200, body: AUTHORITY_LIST },
    'GET /api/authorities/needs-creating': { status: 200, body: [PROBE] },
    ...extra,
  };
}

const codeRows = () =>
  within(screen.getByRole('grid', { name: 'Authorities' }))
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.querySelector('code')?.textContent);

describe('authorities page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('navShowsAuthoritiesForSuperAdminOnly', async () => {
    mockFetch(routes());
    renderApp('/');
    await screen.findByRole('link', { name: 'Dashboard', hidden: true });
    const labels = screen.getAllByRole('link', { hidden: true }).map((l) => l.textContent);
    expect(labels.indexOf('Authorities')).toBe(labels.indexOf('Roles') + 1);
  });

  it('is not found for an account manager', async () => {
    mockFetch(meAs(ACCOUNT_MANAGER));
    renderApp('/authorities');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });

  it('listsAuthoritiesWithStatus', async () => {
    mockFetch(routes());
    renderApp('/authorities');
    const view = await rowWith('customer:view');
    expect(within(view).getByText('customer')).toBeVisible();
    expect(within(view).getByText('Platform')).toBeVisible();
    expect(within(view).getByText('See the customer list and details')).toBeVisible();
    expect(within(view).getByText('Built-in')).toBeVisible();
    expect(within(view).getByText('1')).toBeVisible();
    expect(within(await rowWith('order:refnd')).getByText('Not checked')).toBeVisible();
    expect(within(await rowWith('report:run')).getByText('Wrong level')).toBeVisible();
    expect(within(await rowWith('user:manage')).queryByText('Not checked')).toBeNull();
  });

  it('searchMatchesCodeGroupAndDescription', async () => {
    mockFetch(routes());
    const { user } = renderApp('/authorities');
    await rowWith('customer:view');
    const search = screen.getByRole('textbox', { name: 'Search authorities' });
    await user.type(search, 'customer');
    expect(codeRows()).toEqual(['customer:create', 'customer:view']);
    await user.clear(search);
    await user.type(search, 'refnd');
    expect(codeRows()).toEqual(['order:refnd']);
    await user.clear(search);
    await user.type(search, 'See the customer');
    expect(codeRows()).toEqual(['customer:view']);
  });

  it('statusFilter', async () => {
    mockFetch(routes());
    const { user } = renderApp('/authorities');
    await rowWith('customer:view');
    await user.click(screen.getByRole('button', { name: /Status: All/ }));
    await user.click(screen.getByRole('option', { name: 'Not checked' }));
    expect(codeRows()).toEqual(['order:refnd']);
  });

  it('needsCreatingPanel', async () => {
    mockFetch(routes());
    renderApp('/authorities');
    const panel = await screen.findByRole('region', { name: 'Checked in code, not created yet (1)' });
    expect(within(panel).getByText('test:probe')).toBeVisible();
    expect(within(panel).getByText('ProbeController.probe')).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Create' })).toBeVisible();
  });

  it('hides the panel when nothing needs creating', async () => {
    mockFetch(routes({ 'GET /api/authorities/needs-creating': { status: 200, body: [] } }));
    renderApp('/authorities');
    await rowWith('customer:view');
    expect(screen.queryByText(/Checked in code, not created yet/)).toBeNull();
  });
});
