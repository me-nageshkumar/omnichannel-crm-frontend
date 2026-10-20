import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith } from '../../test/admin';
import { authority } from '../../test/authorities';

const AUTHORITIES = [
  authority('customer:view', { description: 'See the customer list and details', builtIn: true }),
  authority('workspace:create', { level: 'COMPANY', description: 'Create workspaces', builtIn: true }),
  authority('user:view', { level: 'BRAND', description: 'See users with access to the workspace', builtIn: true }),
  authority('user:manage', { level: 'BRAND', description: 'Create users in the workspace', builtIn: true }),
  authority('team:manage', { level: 'BRAND', description: 'Create and rename teams', builtIn: true }),
  authority('order:refnd', { level: 'BRAND', description: 'Refund an order', status: 'NOT_CHECKED' }),
];

const role = (id: string, name: string, level: string, authorities: string[], builtIn = true, userCount = 0) => ({
  id,
  name,
  description: `${name} role`,
  level,
  authorities,
  builtIn,
  userCount,
});

const SA = role('r-sa', 'SUPER_ADMIN', 'PLATFORM', [], true, 1);
const AM = role('r-am', 'ACCOUNT_MANAGER', 'PLATFORM', ['customer:view'], true, 2);
const CA = role('r-ca', 'CUSTOMER_ADMIN', 'COMPANY', ['workspace:create', 'user:view', 'user:manage', 'team:manage']);
const WM = role('r-wm', 'WORKSPACE_MANAGER', 'BRAND', ['user:view', 'user:manage', 'team:manage'], true, 5);
const AGENT = role('r-ag', 'AGENT', 'BRAND', []);
const SENIOR = role('r-sr', 'SENIOR_AGENT', 'BRAND', ['user:view'], false, 0);
const HELD = role('r-held', 'VIEWER', 'BRAND', ['user:view'], false, 4);

function routes(extra = {}) {
  return {
    ...meAs(SUPER_ADMIN),
    'GET /api/authorities': { status: 200, body: AUTHORITIES },
    'GET /api/roles': { status: 200, body: [SA, AM, CA, WM, AGENT, SENIOR, HELD] },
    ...extra,
  };
}

describe('roles page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists roles grouped by level', async () => {
    mockFetch(routes());
    renderApp('/roles');
    expect(await screen.findByRole('heading', { name: 'Platform roles' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Company roles' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Brand roles' })).toBeVisible();
    const wm = await rowWith('Workspace manager');
    expect(within(wm).getByText('Built-in')).toBeVisible();
    expect(within(wm).getByText('5')).toBeVisible();
    expect(within(await rowWith('Senior agent')).queryByText('Built-in')).toBeNull();
  });

  it('a new brand role only offers brand authorities', async () => {
    mockFetch(routes());
    const { user } = renderApp('/roles');
    await user.click(await screen.findByRole('button', { name: 'Add role' }));
    await user.selectOptions(screen.getByLabelText(/^Level/), 'BRAND');
    expect(screen.getByRole('checkbox', { name: /See users with access/ })).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: /Create workspaces/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /See the customer list/ })).toBeNull();
  });

  it('a company role offers company and brand authorities', async () => {
    const fetch = mockFetch(
      routes({ 'POST /api/roles': { status: 201, body: role('r-new', 'OWNER_LITE', 'COMPANY', []) } }),
    );
    const { user } = renderApp('/roles');
    await user.click(await screen.findByRole('button', { name: 'Add role' }));
    await user.selectOptions(screen.getByLabelText(/^Level/), 'COMPANY');
    expect(screen.getByRole('checkbox', { name: /Create workspaces/ })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /See users with access/ })).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: /See the customer list/ })).toBeNull();
    await fill(user, 'Name', 'OWNER_LITE');
    await user.click(screen.getByRole('checkbox', { name: /Create workspaces/ }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await rowWith('Owner lite')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/roles')?.body).toEqual({
      name: 'OWNER_LITE',
      description: '',
      level: 'COMPANY',
      authorities: ['workspace:create'],
    });
  });

  it('a built-in name is read only', async () => {
    mockFetch(routes());
    const { user } = renderApp('/roles');
    await rowAction(user, 'Workspace manager', 'Edit');
    expect(await screen.findByLabelText(/^Name/)).toBeDisabled();
  });

  it('super admin cannot be edited', async () => {
    mockFetch(routes());
    renderApp('/roles');
    const row = await rowWith('Super admin');
    expect(within(row).getByText('All authorities')).toBeVisible();
    expect(within(row).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });

  it('an edit with changes shows a warning and saves on confirm', async () => {
    const fetch = mockFetch(
      routes({
        'POST /api/roles/r-wm/preview': {
          status: 200,
          body: { changes: [{ assigner: 'CUSTOMER_ADMIN', assigned: 'WORKSPACE_MANAGER', nowAssignable: false }] },
        },
        'PUT /api/roles/r-wm': { status: 200, body: { ...WM, authorities: ['user:view', 'user:manage'] } },
      }),
    );
    const { user } = renderApp('/roles');
    await rowAction(user, 'Workspace manager', 'Edit');
    await user.click(await screen.findByRole('checkbox', { name: /Create and rename teams/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Customer admin will no longer be able to assign Workspace manager.')).toBeVisible();
    expect(callsTo(fetch, 'PUT /api/roles/r-wm')).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Save anyway' }));
    await screen.findByRole('heading', { name: 'Brand roles' });
    expect(requestTo(fetch, 'PUT /api/roles/r-wm')?.body).toEqual({
      name: 'WORKSPACE_MANAGER',
      description: 'WORKSPACE_MANAGER role',
      authorities: ['user:view', 'user:manage'],
    });
  });

  it('an edit without changes saves directly', async () => {
    const fetch = mockFetch(
      routes({
        'POST /api/roles/r-sr/preview': { status: 200, body: { changes: [] } },
        'PUT /api/roles/r-sr': { status: 200, body: { ...SENIOR, description: 'Senior' } },
      }),
    );
    const { user } = renderApp('/roles');
    await rowAction(user, 'Senior agent', 'Edit');
    await fill(user, 'Description', 'Senior');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Brand roles' });
    expect(callsTo(fetch, 'PUT /api/roles/r-sr')).toBe(1);
  });

  it('cancelling the warning does not save', async () => {
    const fetch = mockFetch(
      routes({
        'POST /api/roles/r-wm/preview': {
          status: 200,
          body: { changes: [{ assigner: 'CUSTOMER_ADMIN', assigned: 'WORKSPACE_MANAGER', nowAssignable: true }] },
        },
      }),
    );
    const { user } = renderApp('/roles');
    await rowAction(user, 'Workspace manager', 'Edit');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Customer admin will now be able to assign Workspace manager.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(callsTo(fetch, 'PUT /api/roles/r-wm')).toBe(0);
  });

  it('delete is offered only for unused custom roles', async () => {
    mockFetch(routes());
    const { user } = renderApp('/roles');
    await user.click(within(await rowWith('Senior agent')).getByRole('button', { name: 'Kebab toggle' }));
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeVisible();
    await user.keyboard('{Escape}');
    await user.click(within(await rowWith('Viewer')).getByRole('button', { name: 'Kebab toggle' }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(within(await rowWith('Agent')).getByRole('button', { name: 'Kebab toggle' }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
  });

  it('deleting a role that became used shows the message', async () => {
    mockFetch(routes({ 'DELETE /api/roles/r-sr': { status: 409, body: { code: 'ROLE_IN_USE', message: 'x' } } }));
    const { user } = renderApp('/roles');
    await rowAction(user, 'Senior agent', 'Delete');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('This role is assigned to users. Move them to another role first.')).toBeVisible();
  });

  it('the editor will not save without the authority catalogue', async () => {
    const fetch = mockFetch(
      routes({ 'GET /api/authorities': { status: 500, body: { code: 'INTERNAL', message: 'x' } } }),
    );
    const { user } = renderApp('/roles');
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeVisible();
    await rowAction(user, 'Senior agent', 'Edit');
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled();
    expect(callsTo(fetch, 'PUT /api/roles/r-sr')).toBe(0);
  });

  it('a server error on a field the form lacks still shows', async () => {
    mockFetch(
      routes({
        'POST /api/roles/r-sr/preview': {
          status: 400,
          body: { code: 'VALIDATION', message: 'x', fields: { description: 'size must be between 0 and 500' } },
        },
      }),
    );
    const { user } = renderApp('/roles');
    await rowAction(user, 'Senior agent', 'Edit');
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/description: size must be between 0 and 500/)).toBeVisible();
  });

  it('a duplicate name after the warning returns to the editor with the field error', async () => {
    mockFetch(
      routes({
        'POST /api/roles/r-sr/preview': {
          status: 200,
          body: { changes: [{ assigner: 'WORKSPACE_MANAGER', assigned: 'SENIOR_AGENT', nowAssignable: false }] },
        },
        'PUT /api/roles/r-sr': { status: 409, body: { code: 'DUPLICATE', message: 'x', field: 'name' } },
      }),
    );
    const { user } = renderApp('/roles');
    await rowAction(user, 'Senior agent', 'Edit');
    await fill(user, 'Name', 'VIEWER');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Save anyway' }));
    expect(await screen.findByText('Name is already in use.')).toBeVisible();
    expect(screen.getByLabelText(/^Name/)).toBeVisible();
  });

  it('history lists changes', async () => {
    mockFetch(
      routes({
        'GET /api/roles/r-wm/changes': {
          status: 200,
          body: [
            {
              roleId: 'r-wm',
              roleName: 'WORKSPACE_MANAGER',
              changedBy: 'nageshk',
              at: '2026-10-20T10:00:00Z',
              action: 'UPDATED',
              added: ['team:manage'],
              removed: ['user:view'],
              descriptionBefore: 'a',
              descriptionAfter: 'a',
            },
          ],
        },
      }),
    );
    const { user } = renderApp('/roles');
    await rowAction(user, 'Workspace manager', 'History');
    expect(await screen.findByText(/nageshk · added team:manage · removed user:view/)).toBeVisible();
  });

  describe('authority groups in the editor', () => {
    const groupsShown = () =>
      screen
        .getAllByRole('region')
        .map((r) => [r.getAttribute('aria-label'), within(r).getByText(/of \d+ selected/).textContent]);

    it('groupsWithCounts', async () => {
      mockFetch(routes());
      const { user } = renderApp('/roles');
      await rowAction(user, 'Workspace manager', 'Edit');
      await screen.findByRole('checkbox', { name: /Create and rename teams/ });
      expect(groupsShown()).toEqual([
        ['order', '0 of 1 selected'],
        ['team', '1 of 1 selected'],
        ['user', '2 of 2 selected'],
      ]);
    });

    it('searchFiltersAcrossGroupCodeDescription', async () => {
      mockFetch(routes());
      const { user } = renderApp('/roles');
      await rowAction(user, 'Workspace manager', 'Edit');
      const search = await screen.findByRole('textbox', { name: 'Search authorities' });
      await user.type(search, 'team');
      expect(groupsShown().map(([g]) => g)).toEqual(['team']);
      await user.clear(search);
      await user.type(search, 'See users');
      expect(groupsShown().map(([g]) => g)).toEqual(['user']);
      expect(screen.queryByRole('checkbox', { name: /Create users in the workspace/ })).toBeNull();
      await user.clear(search);
      await user.type(search, 'user');
      expect(screen.getByRole('checkbox', { name: /Create users in the workspace/ })).toBeVisible();
      expect(screen.getByRole('checkbox', { name: /See users with access/ })).toBeVisible();
    });

    it('statusLabelInEditor', async () => {
      mockFetch(routes());
      const { user } = renderApp('/roles');
      await rowAction(user, 'Workspace manager', 'Edit');
      const order = await screen.findByRole('region', { name: 'order' });
      expect(within(order).getByText('Not checked')).toBeVisible();
    });

    it('savingWhileFilteredKeepsHiddenSelections', async () => {
      const fetch = mockFetch(
        routes({
          'POST /api/roles/r-wm/preview': { status: 200, body: { changes: [] } },
          'PUT /api/roles/r-wm': { status: 200, body: { ...WM, authorities: ['user:view', 'user:manage'] } },
        }),
      );
      const { user } = renderApp('/roles');
      await rowAction(user, 'Workspace manager', 'Edit');
      await user.type(await screen.findByRole('textbox', { name: 'Search authorities' }), 'team');
      await user.click(screen.getByRole('checkbox', { name: /Create and rename teams/ }));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await vi.waitFor(() => expect(callsTo(fetch, 'PUT /api/roles/r-wm')).toBe(1));
      expect(requestTo(fetch, 'PUT /api/roles/r-wm')?.body.authorities).toEqual(['user:view', 'user:manage']);
    });

    it('dropsCodesMissingFromCatalogue', async () => {
      const ghost = { ...WM, authorities: ['user:view', 'gone:code'] };
      const fetch = mockFetch(
        routes({
          'GET /api/roles': { status: 200, body: [SA, AM, CA, ghost, AGENT, SENIOR, HELD] },
          'POST /api/roles/r-wm/preview': { status: 200, body: { changes: [] } },
          'PUT /api/roles/r-wm': { status: 200, body: { ...WM, authorities: ['user:view'] } },
        }),
      );
      const { user } = renderApp('/roles');
      await rowAction(user, 'Workspace manager', 'Edit');
      await screen.findByRole('checkbox', { name: /See users with access/ });
      expect(screen.queryByText('gone:code')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await vi.waitFor(() => expect(callsTo(fetch, 'PUT /api/roles/r-wm')).toBe(1));
      expect(requestTo(fetch, 'PUT /api/roles/r-wm')?.body.authorities).toEqual(['user:view']);
    });
  });
});
