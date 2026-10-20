import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch } from '../../test/fetchMock';
import { ACCOUNT_MANAGER, meAs, storeSession } from '../../test/session';
import { rowAction, rowWith, urlsOf } from '../../test/admin';
import { phoneNumber } from '../../test/phoneNumbers';

const A = phoneNumber({ id: 'p1', number: '919928088743', status: 'CONNECTED' });
const B = phoneNumber({
  id: 'p2',
  number: '910000000002',
  customerId: 'c2',
  customerName: 'Globex',
  workspaceId: 'w9',
  workspaceName: 'Globex Shop',
});
const page = (items: unknown[], total = items.length, n = 0) => ({ status: 200, body: { items, total, page: n } });

describe('all phone numbers page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsAcrossCustomers', async () => {
    mockFetch({ ...meAs(ACCOUNT_MANAGER), 'GET /api/phone-numbers': page([A, B]) });
    renderApp('/platform/phone-numbers');
    const row = await rowWith('+910000000002');
    expect(within(row).getByText('Globex')).toBeVisible();
    expect(within(row).getByText('Globex Shop')).toBeVisible();
    expect(within(await rowWith('+919928088743')).getByText('Connected')).toBeVisible();
    expect(within(row).getByText('WhatsApp Web')).toBeVisible();
  });

  it('searchSendsQ', async () => {
    const fetch = mockFetch({ ...meAs(ACCOUNT_MANAGER), 'GET /api/phone-numbers': page([A]) });
    const { user } = renderApp('/platform/phone-numbers');
    await rowWith('+919928088743');
    await user.type(screen.getByRole('textbox', { name: 'Search phone numbers' }), 'acme');
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/phone-numbers').some((u) => u.includes('q=acme'))).toBe(true));
  });

  it('statusFilterSendsStatus', async () => {
    const fetch = mockFetch({ ...meAs(ACCOUNT_MANAGER), 'GET /api/phone-numbers': page([A]) });
    const { user } = renderApp('/platform/phone-numbers');
    await rowWith('+919928088743');
    await user.click(screen.getByRole('button', { name: 'Status: All' }));
    await user.click(screen.getByRole('option', { name: 'Wrong number' }));
    await waitFor(() =>
      expect(urlsOf(fetch, 'GET /api/phone-numbers').some((u) => u.includes('status=WRONG_NUMBER'))).toBe(true),
    );
  });

  it('pagination', async () => {
    const fetch = mockFetch({ ...meAs(ACCOUNT_MANAGER), 'GET /api/phone-numbers': page([A], 120) });
    const { user } = renderApp('/platform/phone-numbers');
    await rowWith('+919928088743');
    await user.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/phone-numbers').some((u) => u.includes('page=1'))).toBe(true));
  });

  it('disableAsPlatform', async () => {
    const off = { by: 'asha', level: 'PLATFORM', at: '2026-10-20T10:00:00Z' };
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/phone-numbers': page([A]),
      'POST /api/phone-numbers/p1/disable': {
        status: 200,
        body: { ...A, status: 'DISABLED', disabledBecause: 'NUMBER', disabled: off },
      },
    });
    const { user } = renderApp('/platform/phone-numbers');
    await rowAction(user, '+919928088743', 'Disable');
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disable' }));
    expect(await within(await rowWith('+919928088743')).findByText('Disabled (number)')).toBeVisible();
    expect(callsTo(fetch, 'POST /api/phone-numbers/p1/disable')).toBe(1);
  });

  it('viewOnlyHasNoActions', async () => {
    mockFetch({
      ...meAs({ ...ACCOUNT_MANAGER, authorities: ['customer:view', 'phone-number:view-all'] }),
      'GET /api/phone-numbers': page([A]),
    });
    renderApp('/platform/phone-numbers');
    const row = await rowWith('+919928088743');
    expect(within(row).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });
});
