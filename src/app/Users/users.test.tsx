import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { CUSTOMER_ADMIN, TEAM_LEAD, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith, summary } from '../../test/admin';

const CA_ROLE = { id: 'r-ca', name: 'CUSTOMER_ADMIN' };
const WM_ROLE = { id: 'r-wm', name: 'WORKSPACE_MANAGER' };
const TL_ROLE = { id: 'r-tl', name: 'TEAM_LEAD' };
const AG_ROLE = { id: 'r-ag', name: 'AGENT' };

const inA = (role: { id: string; name: string }) => [{ workspaceId: 'w1', workspaceName: 'Brand A', role }];

const RAVI = {
  ...summary({ id: 'u3', name: 'Ravi Owner', username: 'ravi', role: CA_ROLE }),
  allBrands: true,
  manageable: false,
};
const ARUN = {
  ...summary({ id: 'u5', name: 'Arun Agent', username: 'arun', workspaceRoles: inA(AG_ROLE) }),
  allBrands: false,
  manageable: true,
};
const PRIYA_B = {
  ...summary({
    id: 'u7',
    name: 'Priya',
    username: 'priya',
    workspaceRoles: [{ workspaceId: 'w2', workspaceName: 'Brand B', role: AG_ROLE }],
  }),
  allBrands: false,
  manageable: true,
};

function routes(extra = {}) {
  return {
    'GET /api/workspaces/w1/users': { status: 200, body: [RAVI, ARUN] },
    'GET /api/workspaces/w1/assignable-roles': { status: 200, body: [WM_ROLE, TL_ROLE, AG_ROLE] },
    ...extra,
  };
}

describe('brand users page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists users, marking all-brands people', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...routes() });
    renderApp('/users');
    expect(within(await rowWith('Ravi Owner')).getByText('All brands')).toBeVisible();
    expect(within(await rowWith('Arun Agent')).getByText('Agent')).toBeVisible();
    expect(within(await rowWith('Ravi Owner')).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });

  it('a team lead sees the list without actions', async () => {
    const fetch = mockFetch({ ...meAs(TEAM_LEAD), ...routes() });
    renderApp('/users');
    await rowWith('Arun Agent');
    expect(screen.queryByRole('button', { name: 'Add user' })).toBeNull();
    expect(within(await rowWith('Arun Agent')).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
    expect(callsTo(fetch, 'GET /api/workspaces/w1/assignable-roles')).toBe(0);
  });

  it('creating an agent shows the temporary password', async () => {
    const created = summary({
      id: 'u8',
      name: 'Kiran',
      username: 'kiran',
      workspaceRoles: inA(AG_ROLE),
      mustChangePassword: true,
    });
    const fetch = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes({
        'POST /api/workspaces/w1/users': { status: 201, body: { user: created, temporaryPassword: 'temp-pass-123' } },
      }),
    });
    const { user } = renderApp('/users');
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await fill(user, 'Name', 'Kiran');
    await fill(user, 'Username', 'kiran');
    await fill(user, 'Temporary password', 'temp-pass-123');
    await user.selectOptions(screen.getByLabelText(/^Role/), 'r-ag');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Temporary password for kiran')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/workspaces/w1/users')?.body).toEqual({
      name: 'Kiran',
      username: 'kiran',
      email: '',
      mobileNumber: '',
      temporaryPassword: 'temp-pass-123',
      roleId: 'r-ag',
    });
  });

  it('adds an existing person from another brand', async () => {
    const added = { ...PRIYA_B, workspaceRoles: [...PRIYA_B.workspaceRoles, ...inA(TL_ROLE)] };
    const fetch = mockFetch({
      ...meAs(CUSTOMER_ADMIN),
      ...routes({
        'GET /api/workspaces/w2/users': { status: 200, body: [RAVI, PRIYA_B] },
        'POST /api/workspaces/w1/users': { status: 201, body: { user: added, temporaryPassword: null } },
      }),
    });
    const { user } = renderApp('/users');
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await user.click(screen.getByRole('tab', { name: 'Existing person' }));
    await user.selectOptions(await screen.findByLabelText(/^Person/), 'u7');
    await user.selectOptions(screen.getByLabelText(/^Role/), 'r-tl');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await rowWith('Priya')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/workspaces/w1/users')?.body).toEqual({ userId: 'u7', roleId: 'r-tl' });
    expect(screen.queryByText(/Temporary password for/)).toBeNull();
  });

  it('changes a role, sending the full body', async () => {
    const fetch = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes({
        'PUT /api/workspaces/w1/users/u5': { status: 200, body: { ...ARUN, workspaceRoles: inA(TL_ROLE) } },
      }),
    });
    const { user } = renderApp('/users');
    await rowAction(user, 'Arun Agent', 'Edit');
    await user.selectOptions(await screen.findByLabelText(/^Role/), 'r-tl');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(await rowWith('Arun Agent')).findByText('Team lead')).toBeVisible();
    expect(requestTo(fetch, 'PUT /api/workspaces/w1/users/u5')?.body).toEqual({
      name: 'Arun Agent',
      email: '',
      mobileNumber: '',
      roleId: 'r-tl',
    });
  });

  it('removing the last brand shows the message', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes({ 'DELETE /api/workspaces/w1/users/u5': { status: 400, body: { code: 'LAST_ACCESS', message: 'x' } } }),
    });
    const { user } = renderApp('/users');
    await rowAction(user, 'Arun Agent', 'Remove from brand');
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(await screen.findByText("This is the person's only brand. Deactivate them instead.")).toBeVisible();
  });

  it('a forbidden reset shows the message', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes({
        'POST /api/workspaces/w1/users/u5/reset-password': { status: 403, body: { code: 'FORBIDDEN', message: 'x' } },
      }),
    });
    const { user } = renderApp('/users');
    await rowAction(user, 'Arun Agent', 'Reset password');
    await fill(user, 'Temporary password', 'reset-pass-11');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText("You don't have permission to do that.")).toBeVisible();
  });

  it('a reset shows the temporary password (server replies with the password only)', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes({
        'POST /api/workspaces/w1/users/u5/reset-password': {
          status: 200,
          body: { temporaryPassword: 'reset-pass-12' },
        },
      }),
    });
    const { user } = renderApp('/users');
    await rowAction(user, 'Arun Agent', 'Reset password');
    await fill(user, 'Temporary password', 'reset-pass-12');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Temporary password for arun')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await rowWith('Arun Agent')).toBeVisible();
  });

  it('editing an all-brands person has no role picker and keeps their role', async () => {
    const lesser = {
      ...RAVI,
      id: 'u10',
      name: 'Sita Deputy',
      username: 'sita',
      role: { id: 'r-dep', name: 'DEPUTY' },
      manageable: true,
    };
    const fetch = mockFetch({
      ...meAs(CUSTOMER_ADMIN),
      ...routes({
        'GET /api/workspaces/w1/users': { status: 200, body: [RAVI, ARUN, lesser] },
        'PUT /api/workspaces/w1/users/u10': { status: 200, body: { ...lesser, name: 'Sita D' } },
      }),
    });
    const { user } = renderApp('/users');
    await rowAction(user, 'Sita Deputy', 'Edit');
    await fill(user, 'Name', 'Sita D');
    expect(screen.queryByLabelText(/^Role/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await rowWith('Sita D')).toBeVisible();
    expect(requestTo(fetch, 'PUT /api/workspaces/w1/users/u10')?.body).toEqual({
      name: 'Sita D',
      email: '',
      mobileNumber: '',
      roleId: null,
    });
  });

  it('switching brand refetches', async () => {
    const fetch = mockFetch({
      ...meAs(CUSTOMER_ADMIN),
      ...routes({
        'GET /api/workspaces/w2/users': { status: 200, body: [RAVI, PRIYA_B] },
        'GET /api/workspaces/w2/assignable-roles': { status: 200, body: [AG_ROLE] },
      }),
    });
    const { user } = renderApp('/users');
    await rowWith('Arun Agent');
    await user.click(screen.getByRole('button', { name: 'Brand: Brand A' }));
    await user.click(screen.getByRole('menuitem', { name: 'Brand B' }));
    expect(await rowWith('Priya')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Arun Agent')).toBeNull());
    expect(callsTo(fetch, 'GET /api/workspaces/w2/users')).toBeGreaterThan(0);
  });

  it('deactivate is offered only with company-user:manage', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...routes() });
    const { user } = renderApp('/users');
    await user.click(within(await rowWith('Arun Agent')).getByRole('button', { name: 'Kebab toggle' }));
    expect(await screen.findByRole('menuitem', { name: 'Reset password' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('a customer admin can deactivate', async () => {
    const fetch = mockFetch({
      ...meAs(CUSTOMER_ADMIN),
      ...routes({ 'POST /api/users/u5/deactivate': { status: 200, body: { ...ARUN, active: false } } }),
    });
    const { user } = renderApp('/users');
    await rowAction(user, 'Arun Agent', 'Deactivate');
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    expect(await within(await rowWith('Arun Agent')).findByText('Inactive')).toBeVisible();
    expect(callsTo(fetch, 'POST /api/users/u5/deactivate')).toBe(1);
  });
});
