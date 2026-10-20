import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_A, BRAND_B, CUSTOMER_ADMIN, storeSession } from '../../test/session';
import { fill, rowAction, rowWith } from '../../test/admin';

const BRAND_C = { id: 'w3', name: 'Brand C', role: null, authorities: BRAND_A.authorities };

/** /users/me answers with the customer admin's brands, then (after a change) with {@code later}. */
function meThen(later: typeof CUSTOMER_ADMIN) {
  let n = 0;
  return {
    'GET /api/users/me': () => ({ status: 200, body: n++ === 0 ? CUSTOMER_ADMIN : later }),
  };
}

describe('brands page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists brands', async () => {
    mockFetch({
      ...meThen(CUSTOMER_ADMIN),
      'GET /api/workspaces': {
        status: 200,
        body: [
          { id: 'w1', name: 'Brand A' },
          { id: 'w2', name: 'Brand B' },
        ],
      },
    });
    renderApp('/brands');
    expect(await rowWith('Brand A')).toBeVisible();
    expect(await rowWith('Brand B')).toBeVisible();
  });

  it('create adds the brand and refreshes the switcher', async () => {
    const fetch = mockFetch({
      ...meThen({ ...CUSTOMER_ADMIN, workspaces: [BRAND_A, BRAND_B, BRAND_C] }),
      'GET /api/workspaces': { status: 200, body: [{ id: 'w1', name: 'Brand A' }] },
      'POST /api/workspaces': { status: 201, body: { id: 'w3', name: 'Brand C' } },
    });
    const { user } = renderApp('/brands');
    await user.click(await screen.findByRole('button', { name: 'Add brand' }));
    await fill(user, 'Name', 'Brand C');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await rowWith('Brand C')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/workspaces')?.body).toEqual({ name: 'Brand C' });
    await user.click(screen.getByRole('button', { name: 'Brand: Brand A' }));
    expect(await screen.findByRole('menuitem', { name: 'Brand C' })).toBeVisible();
  });

  it('a duplicate name shows a field error', async () => {
    mockFetch({
      ...meThen(CUSTOMER_ADMIN),
      'GET /api/workspaces': { status: 200, body: [{ id: 'w1', name: 'Brand A' }] },
      'POST /api/workspaces': { status: 409, body: { code: 'DUPLICATE', message: 'x', field: 'name' } },
    });
    const { user } = renderApp('/brands');
    await user.click(await screen.findByRole('button', { name: 'Add brand' }));
    await fill(user, 'Name', 'Brand A');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Name is already in use.')).toBeVisible();
  });

  it('rename updates the switcher', async () => {
    const renamed = { ...CUSTOMER_ADMIN, workspaces: [{ ...BRAND_A, name: 'Brand Alpha' }, BRAND_B] };
    const fetch = mockFetch({
      ...meThen(renamed),
      'GET /api/workspaces': {
        status: 200,
        body: [
          { id: 'w1', name: 'Brand A' },
          { id: 'w2', name: 'Brand B' },
        ],
      },
      'PUT /api/workspaces/w1': { status: 200, body: { id: 'w1', name: 'Brand Alpha' } },
    });
    const { user } = renderApp('/brands');
    await rowAction(user, 'Brand A', 'Rename');
    await fill(user, 'Name', 'Brand Alpha');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await rowWith('Brand Alpha')).toBeVisible();
    expect(requestTo(fetch, 'PUT /api/workspaces/w1')?.body).toEqual({ name: 'Brand Alpha' });
    expect(await screen.findByRole('button', { name: 'Brand: Brand Alpha' })).toBeVisible();
  });

  it('brandsPageDisablesBrand', async () => {
    const off = { by: 'ravi', level: 'COMPANY', at: '2026-10-20T10:00:00Z' };
    const fetch = mockFetch({
      ...meThen(CUSTOMER_ADMIN),
      'GET /api/workspaces': {
        status: 200,
        body: [
          { id: 'w1', name: 'Brand A', disabled: null },
          { id: 'w2', name: 'Brand B', disabled: null },
        ],
      },
      'POST /api/workspaces/w2/disable': { status: 200, body: { id: 'w2', name: 'Brand B', disabled: off } },
    });
    const { user } = renderApp('/brands');
    await rowAction(user, 'Brand B', 'Disable');
    await user.click(await screen.findByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Disabled')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/workspaces/w2/disable')).toBeDefined();
  });
});
