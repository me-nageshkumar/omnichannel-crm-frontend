import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { ACCOUNT_MANAGER, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith, summary, urlsOf } from '../../test/admin';

const OFF = { by: 'am', level: 'PLATFORM', at: '2026-10-20T10:00:00Z' };

const ACME = { id: 'c1', name: 'Acme', active: true, disabled: null, creationTime: '2026-10-20T10:00:00Z' };
const GLOBEX = { id: 'c2', name: 'Globex', active: false, disabled: OFF, creationTime: '2026-10-19T10:00:00Z' };
const CA_ROLE = { id: 'r-ca', name: 'CUSTOMER_ADMIN' };
const RAVI = summary({ id: 'u3', name: 'Ravi Owner', username: 'ravi', role: CA_ROLE });
const DETAIL = { customer: ACME, workspaces: [{ id: 'w1', name: 'Acme Retail', disabled: null }], admins: [RAVI] };
const ARUN = summary({
  id: 'u5',
  name: 'Arun Agent',
  username: 'arun',
  workspaceRoles: [{ workspaceId: 'w1', workspaceName: 'Acme Retail', role: { id: 'r-ag', name: 'AGENT' } }],
});

const page = (items: unknown[], total = items.length, n = 0) => ({ status: 200, body: { items, total, page: n } });

describe('customers', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('searches and filters', async () => {
    const fetch = mockFetch({ ...meAs(ACCOUNT_MANAGER), 'GET /api/customers': page([ACME, GLOBEX]) });
    const { user } = renderApp('/customers');
    expect(await rowWith('Acme')).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'acm');
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/customers').some((u) => u.includes('q=acm'))).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    await waitFor(() =>
      expect(urlsOf(fetch, 'GET /api/customers').some((u) => u.includes('active=false') && u.includes('q=acm'))).toBe(
        true,
      ),
    );
  });

  it('pages through results', async () => {
    const fetch = mockFetch({ ...meAs(ACCOUNT_MANAGER), 'GET /api/customers': page([ACME], 120) });
    const { user } = renderApp('/customers');
    await rowWith('Acme');
    await user.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/customers').some((u) => u.includes('page=1'))).toBe(true));
  });

  it('create shows the password, then opens the detail page', async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers': page([]),
      'POST /api/customers': { status: 201, body: { customer: ACME, user: RAVI, temporaryPassword: 'temp-pass-123' } },
      'GET /api/customers/c1': { status: 200, body: DETAIL },
      'GET /api/customers/c1/users': { status: 200, body: [] },
    });
    const { user } = renderApp('/customers');
    await user.click(await screen.findByRole('button', { name: 'Add customer' }));
    await fill(user, 'Company name', 'Acme');
    await fill(user, 'Name', 'Ravi Owner');
    await fill(user, 'Username', 'ravi');
    await fill(user, 'Temporary password', 'temp-pass-123');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Temporary password for ravi')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/customers')?.body).toEqual({
      name: 'Acme',
      workspaceName: null,
      admin: { name: 'Ravi Owner', username: 'ravi', email: '', mobileNumber: '', temporaryPassword: 'temp-pass-123' },
    });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeVisible();
  });

  it('a duplicate owner username shows a field error', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers': page([]),
      'POST /api/customers': { status: 409, body: { code: 'DUPLICATE', message: 'x', field: 'username' } },
    });
    const { user } = renderApp('/customers');
    await user.click(await screen.findByRole('button', { name: 'Add customer' }));
    await fill(user, 'Company name', 'Acme');
    await fill(user, 'Name', 'Ravi Owner');
    await fill(user, 'Username', 'ravi');
    await fill(user, 'Temporary password', 'temp-pass-123');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Username is already in use.')).toBeVisible();
  });

  it('detail shows brands and owners', async () => {
    mockFetch({ ...meAs(ACCOUNT_MANAGER), 'GET /api/customers/c1': { status: 200, body: DETAIL } });
    renderApp('/customers/c1');
    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(screen.getByText('Acme Retail')).toBeVisible();
    expect(within(await rowWith('Ravi Owner')).getByText('ravi')).toBeVisible();
  });

  it('deactivating a customer asks first', async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers/c1': { status: 200, body: DETAIL },
      'GET /api/customers/c1/users': { status: 200, body: [] },
      'POST /api/customers/c1/disable': { status: 200, body: { ...ACME, active: false, disabled: OFF } },
    });
    const { user } = renderApp('/customers/c1');
    await user.click(await screen.findByRole('button', { name: 'Disable' }));
    expect(screen.getByText("All of Acme's users will be logged out and unable to log in.")).toBeVisible();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Disabled')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/customers/c1/disable')).toBeDefined();
  });

  it('adds an owner', async () => {
    const neha = summary({ id: 'u9', name: 'Neha', username: 'neha', role: CA_ROLE, mustChangePassword: true });
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers/c1': { status: 200, body: DETAIL },
      'GET /api/customers/c1/users': { status: 200, body: [] },
      'POST /api/customers/c1/admins': { status: 201, body: { user: neha, temporaryPassword: 'temp-pass-456' } },
    });
    const { user } = renderApp('/customers/c1');
    await user.click(await screen.findByRole('button', { name: 'Add owner' }));
    await fill(user, 'Name', 'Neha');
    await fill(user, 'Username', 'neha');
    await fill(user, 'Temporary password', 'temp-pass-456');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Temporary password for neha')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await rowWith('Neha')).toBeVisible();
  });

  it("resets an owner's password", async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers/c1': { status: 200, body: DETAIL },
      'GET /api/customers/c1/users': { status: 200, body: [] },
      'POST /api/customers/c1/admins/u3/reset-password': {
        status: 200,
        body: { temporaryPassword: 'reset-pass-77' },
      },
    });
    const { user } = renderApp('/customers/c1');
    await rowAction(user, 'Ravi Owner', 'Reset password');
    await fill(user, 'Temporary password', 'reset-pass-77');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Temporary password for ravi')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/customers/c1/admins/u3/reset-password')?.body).toEqual({
      temporaryPassword: 'reset-pass-77',
    });
  });

  it('without customer:manage there are no actions', async () => {
    mockFetch({
      ...meAs({ ...ACCOUNT_MANAGER, authorities: ['customer:view'] }),
      'GET /api/customers': page([ACME]),
      'GET /api/customers/c1': { status: 200, body: DETAIL },
      'GET /api/customers/c1/users': { status: 200, body: [] },
    });
    renderApp('/customers/c1');
    await screen.findByRole('heading', { name: 'Acme' });
    expect(screen.queryByRole('button', { name: 'Add owner' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Disable' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit name' })).toBeNull();
    expect(within(await rowWith('Ravi Owner')).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });

  it('an unknown customer shows the not-found message', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers/zz': { status: 404, body: { code: 'NOT_FOUND', message: 'x' } },
    });
    renderApp('/customers/zz');
    expect(await screen.findByText("That item no longer exists or you can't see it.")).toBeVisible();
  });

  it('usersTabListsAllCustomerUsers', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers/c1': { status: 200, body: DETAIL },
      'GET /api/customers/c1/users': { status: 200, body: [RAVI, ARUN] },
    });
    renderApp('/customers/c1');
    const users = await screen.findByRole('grid', { name: 'Users' });
    const row = within(users).getByText('Arun Agent').closest('tr') as HTMLElement;
    expect(within(row).getByText('arun')).toBeVisible();
    expect(within(row).getByText('Acme Retail: Agent')).toBeVisible();
    expect(within(users).getByText('Ravi Owner')).toBeVisible();
  });

  it('accountManagerDisablesAgent', async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers/c1': { status: 200, body: DETAIL },
      'GET /api/customers/c1/users': { status: 200, body: [RAVI, ARUN] },
      'POST /api/customers/c1/users/u5/disable': { status: 200, body: { ...ARUN, active: false, disabled: OFF } },
    });
    const { user } = renderApp('/customers/c1');
    await rowAction(user, 'Arun Agent', 'Disable');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable' }));
    expect(await within(await rowWith('Arun Agent')).findByText('Disabled')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/customers/c1/users/u5/disable')).toBeDefined();
  });

  it('brandDisableFromCustomerDetail', async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers/c1': { status: 200, body: DETAIL },
      'GET /api/customers/c1/users': { status: 200, body: [] },
      'POST /api/customers/c1/workspaces/w1/disable': {
        status: 200,
        body: { id: 'w1', name: 'Acme Retail', disabled: OFF },
      },
    });
    const { user } = renderApp('/customers/c1');
    await rowAction(user, 'Acme Retail', 'Disable');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable' }));
    expect(await within(await rowWith('Acme Retail')).findByText('Disabled')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/customers/c1/workspaces/w1/disable')).toBeDefined();
  });
});
