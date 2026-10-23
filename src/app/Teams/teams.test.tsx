import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_VIEWER, CUSTOMER_ADMIN, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith, summary } from '../../test/admin';

const AG_ROLE = { id: 'r-ag', name: 'AGENT' };
const person = (id: string, name: string, username: string) => ({
  ...summary({ id, name, username, workspaceRoles: [{ workspaceId: 'w1', workspaceName: 'Brand A', role: AG_ROLE }] }),
  allBrands: false,
  manageable: true,
});
const ARUN = person('u5', 'Arun Agent', 'arun');
const KIRAN = person('u8', 'Kiran', 'kiran');
const GENERAL = { id: 't1', name: 'General', members: [{ id: 'u5', name: 'Arun Agent', username: 'arun' }] };
const RETURNS = { id: 't2', name: 'Returns', members: [] };

function routes(extra = {}) {
  return {
    'GET /api/workspaces/w1/teams': { status: 200, body: [GENERAL, RETURNS] },
    'GET /api/workspaces/w1/users': { status: 200, body: [ARUN, KIRAN] },
    ...extra,
  };
}

describe('teams page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists teams with member counts', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...routes() });
    renderApp('/teams');
    expect(within(await rowWith('General')).getByText('1')).toBeVisible();
    expect(within(await rowWith('Returns')).getByText('0')).toBeVisible();
  });

  it('creates a team', async () => {
    const fetch = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes({ 'POST /api/workspaces/w1/teams': { status: 201, body: { id: 't3', name: 'Sales', members: [] } } }),
    });
    const { user } = renderApp('/teams');
    await user.click(await screen.findByRole('button', { name: 'Add team' }));
    await fill(user, 'Name', 'Sales');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await rowWith('Sales')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/workspaces/w1/teams')?.body).toEqual({ name: 'Sales' });
  });

  it('edit offers only people in the brand and sends name and members', async () => {
    const fetch = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes({
        'PUT /api/workspaces/w1/teams/t1': {
          status: 200,
          body: { ...GENERAL, members: [...GENERAL.members, { id: 'u8', name: 'Kiran', username: 'kiran' }] },
        },
      }),
    });
    const { user } = renderApp('/teams');
    await rowAction(user, 'General', 'Edit');
    const members = await screen.findByRole('group', { name: 'Members' });
    expect(
      within(members)
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('aria-label') ?? c.id),
    ).toHaveLength(2);
    expect(within(members).getByRole('checkbox', { name: /Arun Agent/ })).toBeChecked();
    await user.click(within(members).getByRole('checkbox', { name: /Kiran/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(await rowWith('General')).findByText('2')).toBeVisible();
    expect(requestTo(fetch, 'PUT /api/workspaces/w1/teams/t1')?.body).toEqual({
      name: 'General',
      memberIds: ['u5', 'u8'],
    });
  });

  it('shows the not-in-brand message', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes({
        'PUT /api/workspaces/w1/teams/t1': { status: 400, body: { code: 'NOT_IN_WORKSPACE', message: 'x' } },
      }),
    });
    const { user } = renderApp('/teams');
    await rowAction(user, 'General', 'Edit');
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Everyone in a team must have access to this brand.')).toBeVisible();
  });

  it('is read-only without team:manage', async () => {
    mockFetch({ ...meAs(BRAND_VIEWER), ...routes() });
    renderApp('/teams');
    await rowWith('General');
    expect(screen.queryByRole('button', { name: 'Add team' })).toBeNull();
    expect(within(await rowWith('General')).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });

  it('switching brand refetches', async () => {
    const fetch = mockFetch({
      ...meAs(CUSTOMER_ADMIN),
      ...routes({ 'GET /api/workspaces/w2/teams': { status: 200, body: [{ id: 't9', name: 'B Team', members: [] }] } }),
    });
    const { user } = renderApp('/teams');
    await rowWith('General');
    await user.click(screen.getByRole('button', { name: 'Brand: Brand A' }));
    await user.click(screen.getByRole('menuitem', { name: 'Brand B' }));
    expect(await rowWith('B Team')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('General')).toBeNull());
    expect(callsTo(fetch, 'GET /api/workspaces/w2/teams')).toBeGreaterThan(0);
  });
});
