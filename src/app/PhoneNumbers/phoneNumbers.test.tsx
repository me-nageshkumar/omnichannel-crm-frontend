import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_VIEWER, CUSTOMER_ADMIN, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith } from '../../test/admin';
import { phoneNumber } from '../../test/phoneNumbers';
import { normaliseNumber } from '@app/api/phoneNumbers';

const BASE = '/api/workspaces/w1/phone-numbers';
const OFF = { by: 'am', level: 'PLATFORM' as const, at: '2026-10-20T10:00:00Z' };
const MAIN = phoneNumber({ id: 'p1', number: '919928088743', label: 'Main line' });

function routes(list = [MAIN], extra = {}) {
  return { ...meAs(WORKSPACE_MANAGER), [`GET ${BASE}`]: { status: 200, body: list }, ...extra };
}

describe('brand phone numbers page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('listsNumbersWithStatus', async () => {
    const list = [
      phoneNumber({ id: 'a', number: '910000000001', status: 'NOT_CONNECTED_YET' }),
      phoneNumber({ id: 'b', number: '910000000002', status: 'WAITING_FOR_LOGIN' }),
      phoneNumber({ id: 'c', number: '910000000003', status: 'CONNECTED' }),
      phoneNumber({ id: 'd', number: '910000000004', status: 'WRONG_NUMBER', wrongNumber: '911111111111' }),
      phoneNumber({ id: 'e', number: '910000000005', status: 'DISCONNECTED', lastSeenAt: '2026-10-20T09:00:00Z' }),
      phoneNumber({ id: 'f', number: '910000000006', status: 'DISABLED', disabledBecause: 'BRAND', disabled: OFF }),
    ];
    mockFetch(routes(list));
    renderApp('/phone-numbers');
    expect(within(await rowWith('+910000000001')).getByText('Not connected yet')).toBeVisible();
    expect(within(await rowWith('+910000000002')).getByText('Waiting for WhatsApp login')).toBeVisible();
    expect(within(await rowWith('+910000000003')).getByText('Connected')).toBeVisible();
    expect(within(await rowWith('+910000000004')).getByText('Wrong number: +911111111111')).toBeVisible();
    expect(within(await rowWith('+910000000005')).getByText(/^Disconnected · last seen/)).toBeVisible();
    expect(within(await rowWith('+910000000006')).getByText('Disabled (brand)')).toBeVisible();
  });

  it('showsConnectionType', async () => {
    mockFetch(routes([MAIN, phoneNumber({ id: 'p9', number: '910000000009', connectionType: 'WHATSAPP_CLOUD_API' })]));
    renderApp('/phone-numbers');
    expect(within(await rowWith('+919928088743')).getByText('WhatsApp Web')).toBeVisible();
    expect(within(await rowWith('+910000000009')).getByText('Cloud API')).toBeVisible();
  });

  it('addNumberValidates', async () => {
    mockFetch(routes([]));
    const { user } = renderApp('/phone-numbers');
    await user.click(await screen.findByRole('button', { name: 'Add number' }));
    await fill(user, 'WhatsApp number', '12345');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Use 8 to 15 digits, country code first.')).toBeVisible();
  });

  it('numberInputNormalises', async () => {
    const fetch = mockFetch(routes([], { [`POST ${BASE}`]: { status: 201, body: MAIN } }));
    const { user } = renderApp('/phone-numbers');
    await user.click(await screen.findByRole('button', { name: 'Add number' }));
    await fill(user, 'WhatsApp number', '+91 99280-88743');
    await fill(user, 'Label', 'Main line');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await rowWith('+919928088743')).toBeVisible();
    expect(requestTo(fetch, `POST ${BASE}`)?.body).toEqual({ number: '919928088743', label: 'Main line' });
    expect(normaliseNumber(' +91 (992) 808-8743 ')).toBe('919928088743');
  });

  it('duplicateShowsFieldError', async () => {
    mockFetch(
      routes([], {
        [`POST ${BASE}`]: { status: 409, body: { code: 'DUPLICATE', field: 'number', message: 'x' } },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await user.click(await screen.findByRole('button', { name: 'Add number' }));
    await fill(user, 'WhatsApp number', '919928088743');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('This number is already onboarded.')).toBeVisible();
  });

  it('connectCodeModalShowsCodeAndExpiry', async () => {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    mockFetch(
      routes([MAIN], { [`POST ${BASE}/p1/connect-code`]: { status: 200, body: { code: 'ABCD-EFGH', expiresAt } } }),
    );
    const { user } = renderApp('/phone-numbers');
    await rowAction(user, '+919928088743', 'Get connect code');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('ABCD-EFGH')).toBeVisible();
    expect(within(dialog).getByText(/Expires in 1[45]:\d\d/)).toBeVisible();
    expect(within(dialog).getByText(/log in to \+919928088743/)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Copy' })).toBeVisible();
    expect(within(dialog).getByText('Any earlier code for this number has stopped working.')).toBeVisible();
  });

  it('newCodeWarnsOldStops', async () => {
    const withDevice = { ...MAIN, hasDevice: true, status: 'CONNECTED' as const };
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const fetch = mockFetch(
      routes([withDevice], {
        [`POST ${BASE}/p1/connect-code`]: { status: 200, body: { code: 'WXYZ-2345', expiresAt } },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await rowAction(user, '+919928088743', 'Get connect code');
    expect(await screen.findByText(/replaces the connected device/)).toBeVisible();
    expect(callsTo(fetch, `POST ${BASE}/p1/connect-code`)).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Get code' }));
    expect(await screen.findByText('WXYZ-2345')).toBeVisible();
  });

  it('revokeOnlyWhenDevice', async () => {
    const fetch = mockFetch(
      routes([MAIN, phoneNumber({ id: 'p2', number: '910000000002', hasDevice: true })], {
        [`POST ${BASE}/p2/revoke-device`]: { status: 200, body: phoneNumber({ id: 'p2', number: '910000000002' }) },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await user.click(within(await rowWith('+919928088743')).getByRole('button', { name: 'Kebab toggle' }));
    expect(screen.queryByRole('menuitem', { name: 'Revoke device' })).toBeNull();
    await user.keyboard('{Escape}');
    await rowAction(user, '+910000000002', 'Revoke device');
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(callsTo(fetch, `POST ${BASE}/p2/revoke-device`)).toBe(1));
  });

  it('disable and delete', async () => {
    const fetch = mockFetch(
      routes([MAIN], {
        [`POST ${BASE}/p1/disable`]: {
          status: 200,
          body: { ...MAIN, status: 'DISABLED', disabledBecause: 'NUMBER', disabled: { ...OFF, level: 'BRAND' } },
        },
        [`DELETE ${BASE}/p1`]: { status: 204 },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await rowAction(user, '+919928088743', 'Disable');
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disable' }));
    expect(await within(await rowWith('+919928088743')).findByText('Disabled (number)')).toBeVisible();
    await rowAction(user, '+919928088743', 'Delete');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Its device is disconnected/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('+919928088743')).toBeNull());
    expect(callsTo(fetch, `DELETE ${BASE}/p1`)).toBe(1);
  });

  it('viewerSeesNoActions', async () => {
    mockFetch({ ...meAs(BRAND_VIEWER), [`GET ${BASE}`]: { status: 200, body: [MAIN] } });
    renderApp('/phone-numbers');
    const row = await rowWith('+919928088743');
    expect(within(row).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add number' })).toBeNull();
  });

  it('pollsStatusAndStopsOnUnmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = mockFetch(routes());
    const { unmount } = renderApp('/phone-numbers');
    await rowWith('+919928088743');
    expect(callsTo(fetch, `GET ${BASE}`)).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(callsTo(fetch, `GET ${BASE}`)).toBe(2));
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(callsTo(fetch, `GET ${BASE}`)).toBe(2);
  });

  it('routeVisibleWithPhoneNumberView', async () => {
    mockFetch({ ...meAs(CUSTOMER_ADMIN), [`GET ${BASE}`]: { status: 200, body: [] } });
    renderApp('/phone-numbers');
    expect(await screen.findByRole('heading', { name: 'Phone numbers' })).toBeVisible();
  });

  // --- owning team (chat-assignment design §3.1) --------------------------------------------------------------

  const TEAMS = 'GET /api/workspaces/w1/teams';
  const SALES = { id: 't1', name: 'Sales', members: [], phoneNumbers: [] };
  const SUPPORT = { id: 't2', name: 'Support', members: [], phoneNumbers: [] };

  it('showsTeamColumnAndWarningForUnowned', async () => {
    const owned = phoneNumber({ id: 'p2', number: '910000000002', team: { id: 't1', name: 'Sales' } });
    mockFetch(routes([MAIN, owned], { [TEAMS]: { status: 200, body: [SALES, SUPPORT] } }));
    renderApp('/phone-numbers');
    const unowned = await rowWith('+919928088743');
    expect(within(unowned).getByText('No team')).toBeVisible();
    expect(within(unowned).getByLabelText('No team — nobody but admins sees this number')).toBeVisible();
    expect(within(await rowWith('+910000000002')).getByText('Sales')).toBeVisible();
  });

  it('setTeamSavesAndRefreshes', async () => {
    const fetch = mockFetch(
      routes([MAIN], {
        [TEAMS]: { status: 200, body: [SALES, SUPPORT] },
        [`PUT ${BASE}/p1/team`]: { status: 200, body: { ...MAIN, team: { id: 't2', name: 'Support' } } },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await rowAction(user, '+919928088743', 'Set team');
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Team'), 'Support');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(fetch, `PUT ${BASE}/p1/team`)?.body).toEqual({ teamId: 't2' });
    expect(within(await rowWith('+919928088743')).getByText('Support')).toBeVisible();
  });

  it('setTeamShowsTheServersFieldError', async () => {
    mockFetch(
      routes([MAIN], {
        [TEAMS]: { status: 200, body: [SALES, SUPPORT] },
        [`PUT ${BASE}/p1/team`]: {
          status: 400,
          body: { code: 'VALIDATION', message: 'Invalid request', fields: { teamId: 'is not a team of this brand' } },
        },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await rowAction(user, '+919928088743', 'Set team');
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Team'), 'Support');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('is not a team of this brand')).toBeVisible();
  });

  it('clearTeamSendsNull', async () => {
    const owned = phoneNumber({ id: 'p2', number: '910000000002', team: { id: 't1', name: 'Sales' } });
    const fetch = mockFetch(
      routes([owned], {
        [TEAMS]: { status: 200, body: [SALES, SUPPORT] },
        [`PUT ${BASE}/p2/team`]: { status: 200, body: { ...owned, team: null } },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await rowAction(user, '+910000000002', 'Set team');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Team')).toHaveValue('t1');
    await user.selectOptions(within(dialog).getByLabelText('Team'), 'No team');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(fetch, `PUT ${BASE}/p2/team`)?.body).toEqual({ teamId: null });
    expect(within(await rowWith('+910000000002')).getByText('No team')).toBeVisible();
  });
});
