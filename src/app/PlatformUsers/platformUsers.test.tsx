import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith, summary } from '../../test/admin';

const OFF = { by: 'am', level: 'PLATFORM', at: '2026-10-20T10:00:00Z' };

const AM_ROLE = { id: 'r-am', name: 'ACCOUNT_MANAGER' };
const DEV_ROLE = { id: 'r-dev', name: 'WHATSAPP_DEVICE' };
const ASHA = summary({ id: 'p1', name: 'Asha Manager', username: 'asha', role: AM_ROLE });
const BRIDGE = summary({ id: 'p2', name: 'WhatsApp Bridge', username: 'wabridge', role: DEV_ROLE });

function routes(extra = {}) {
  return {
    ...meAs(SUPER_ADMIN),
    'GET /api/platform-users': { status: 200, body: [ASHA, BRIDGE] },
    'GET /api/platform-users/assignable-roles': { status: 200, body: [AM_ROLE, DEV_ROLE] },
    ...extra,
  };
}

describe('platform users page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists users', async () => {
    mockFetch(routes());
    renderApp('/platform-users');
    const row = await rowWith('Asha Manager');
    expect(within(row).getByText('asha')).toBeVisible();
    expect(within(row).getByText('Account manager')).toBeVisible();
    expect(within(row).getByText('Enabled')).toBeVisible();
    expect(await rowWith('WhatsApp Bridge')).toBeVisible();
  });

  it('create shows the temporary password once', async () => {
    const created = summary({ id: 'p3', name: 'Neha', username: 'neha', role: AM_ROLE, mustChangePassword: true });
    const fetch = mockFetch(
      routes({
        'POST /api/platform-users': { status: 201, body: { user: created, temporaryPassword: 'temp-pass-123' } },
      }),
    );
    const { user } = renderApp('/platform-users');
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await fill(user, 'Name', 'Neha');
    await fill(user, 'Username', 'neha');
    await fill(user, 'Temporary password', 'temp-pass-123');
    await user.selectOptions(screen.getByLabelText(/^Role/), 'r-am');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Temporary password for neha')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/platform-users')?.body).toEqual({
      name: 'Neha',
      username: 'neha',
      email: '',
      mobileNumber: '',
      roleId: 'r-am',
      temporaryPassword: 'temp-pass-123',
    });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByDisplayValue('temp-pass-123')).toBeNull();
    expect(await rowWith('Neha')).toBeVisible();
  });

  it('a duplicate username shows a field error', async () => {
    mockFetch(
      routes({
        'POST /api/platform-users': { status: 409, body: { code: 'DUPLICATE', message: 'x', field: 'username' } },
      }),
    );
    const { user } = renderApp('/platform-users');
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    await fill(user, 'Name', 'Asha 2');
    await fill(user, 'Username', 'asha');
    await fill(user, 'Temporary password', 'temp-pass-123');
    await user.selectOptions(screen.getByLabelText(/^Role/), 'r-am');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Username is already in use.')).toBeVisible();
  });

  it('the role select offers assignable roles only', async () => {
    mockFetch(routes({ 'GET /api/platform-users/assignable-roles': { status: 200, body: [AM_ROLE] } }));
    const { user } = renderApp('/platform-users');
    await user.click(await screen.findByRole('button', { name: 'Add user' }));
    const select = await screen.findByLabelText(/^Role/);
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['Select a role', 'Account manager']);
  });

  it('reset password asks for a temporary password, then shows it', async () => {
    const fetch = mockFetch(
      routes({
        'POST /api/platform-users/p1/reset-password': {
          status: 200,
          body: { temporaryPassword: 'reset-pass-99' },
        },
      }),
    );
    const { user } = renderApp('/platform-users');
    await rowAction(user, 'Asha Manager', 'Reset password');
    await fill(user, 'Temporary password', 'reset-pass-99');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Temporary password for asha')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/platform-users/p1/reset-password')?.body).toEqual({
      temporaryPassword: 'reset-pass-99',
    });
  });

  it('disable confirms and updates the row', async () => {
    mockFetch(
      routes({
        'POST /api/platform-users/p1/disable': { status: 200, body: { ...ASHA, active: false, disabled: OFF } },
      }),
    );
    const { user } = renderApp('/platform-users');
    await rowAction(user, 'Asha Manager', 'Disable');
    await user.click(await screen.findByRole('button', { name: 'Disable' }));
    const row = await rowWith('Asha Manager');
    expect(await within(row).findByText('Disabled')).toBeVisible();
  });

  it('forbidden shows a message', async () => {
    mockFetch(
      routes({ 'POST /api/platform-users/p1/disable': { status: 403, body: { code: 'FORBIDDEN', message: 'x' } } }),
    );
    const { user } = renderApp('/platform-users');
    await rowAction(user, 'Asha Manager', 'Disable');
    await user.click(await screen.findByRole('button', { name: 'Disable' }));
    expect(await screen.findByText("You don't have permission to do that.")).toBeVisible();
  });

  it('enableRefusedShowsServerMessage', async () => {
    const off = { ...ASHA, active: false, disabled: OFF };
    mockFetch({
      ...routes({
        'POST /api/platform-users/p1/enable': {
          status: 403,
          body: {
            code: 'DISABLED_AT_HIGHER_LEVEL',
            level: 'PLATFORM',
            message: 'Disabled by platform staff. Only platform staff can enable it.',
          },
        },
      }),
      'GET /api/platform-users': { status: 200, body: [off, BRIDGE] },
    });
    const { user } = renderApp('/platform-users');
    await rowAction(user, 'Asha Manager', 'Enable');
    await user.click(await screen.findByRole('button', { name: 'Enable' }));
    expect(await screen.findByText('Disabled by platform staff. Only platform staff can enable it.')).toBeVisible();
  });
});
