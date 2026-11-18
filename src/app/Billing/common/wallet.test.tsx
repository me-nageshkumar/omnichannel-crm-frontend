import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { type MockRoute, mockFetch } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, CUSTOMER_ADMIN, meAs, storeSession } from '../../../test/session';
import {
  LEDGER,
  NO_WALLET,
  OPTIONS,
  PROFILE,
  USAGE_DAYS,
  billingRoutes,
  myBillingRoutes,
  subscription,
  summaryIn,
  wallet,
} from '../../../test/billing';
import { rowWith, urlsOf } from '../../../test/admin';

const ACME = {
  id: 'c1',
  name: 'Acme',
  active: true,
  disabled: null,
  creationTime: '2026-10-20T10:00:00Z',
  planName: 'Gold',
  subscriptionState: 'ACTIVE',
};
const BASE = '/api/billing/customers/c1';
const crmOff = { 'GET /api/workspaces/w1/crm/status': { status: 402, body: { code: 'CRM_NOT_ENABLED' } } };

function staff(over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    ...meAs(ACCOUNT_MANAGER),
    ...billingRoutes(),
    'GET /api/customers/c1': { status: 200, body: { customer: ACME, workspaces: [], admins: [] } },
    'GET /api/customers/c1/users': { status: 200, body: [] },
    [`GET ${BASE}/subscription`]: { status: 200, body: subscription() },
    [`GET ${BASE}/billing-profile`]: { status: 200, body: PROFILE },
    [`GET ${BASE}/orders`]: { status: 200, body: [] },
    [`GET ${BASE}/wallet/entries`]: { status: 200, body: { items: LEDGER, total: LEDGER.length, page: 0 } },
    [`GET ${BASE}/wallet/usage`]: { status: 200, body: USAGE_DAYS },
    ...over,
  };
}

function mine(over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    ...meAs({ ...CUSTOMER_ADMIN, subscription: summaryIn('ACTIVE') }),
    ...crmOff,
    ...myBillingRoutes(),
    'GET /api/my/billing/wallet/entries': {
      status: 200,
      body: { items: LEDGER.map((e) => ({ ...e, byName: null })), total: LEDGER.length, page: 0 },
    },
    'GET /api/my/billing/wallet/usage': { status: 200, body: USAGE_DAYS },
    ...over,
  };
}

describe('the wallet', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the balance and the message rate of a charged plan', async () => {
    mockFetch(staff());
    renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText('₹999.25')).toBeVisible();
    expect(within(card).getByText('₹0.25 per message')).toBeVisible();
    expect(within(card).queryByText(/below/)).toBeNull();
  });

  it('says that messages are not charged on a plan without a rate, for a wallet that does not exist yet', async () => {
    mockFetch(
      staff({
        [`GET ${BASE}/wallet`]: { status: 200, body: NO_WALLET },
        [`GET ${BASE}/options`]: {
          status: 200,
          body: {
            ...OPTIONS,
            messageRate: null,
            topUp: { allowed: false, reason: 'Messages are not charged on this plan', min: 100, max: 1000000 },
          },
        },
        [`GET ${BASE}/wallet/entries`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      }),
    );
    const { user } = renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText('₹0.00')).toBeVisible();
    expect(within(card).getByText('Messages are not charged on this plan.')).toBeVisible();
    expect(within(card).queryByRole('button', { name: 'Top up' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    const billing = await screen.findByRole('region', { name: 'Orders and documents' });
    await user.click(within(billing).getByRole('tab', { name: 'Wallet' }));
    expect(await within(billing).findByText('Nothing has gone in or out of the wallet yet.')).toBeVisible();
  });

  it('warns when the balance is below the warning level', async () => {
    mockFetch(
      staff({ [`GET ${BASE}/wallet`]: { status: 200, body: wallet({ balance: 50, lowBalanceAt: 200, low: true }) } }),
    );
    renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText('The balance is below the warning level.')).toBeVisible();
    expect(within(card).getByText('₹200.00')).toBeVisible();
  });

  it('lists the ledger with signed amounts of up to four decimals, and asks for the next page', async () => {
    const fetch = mockFetch(
      staff({ [`GET ${BASE}/wallet/entries`]: { status: 200, body: { items: LEDGER, total: 120, page: 0 } } }),
    );
    const { user } = renderApp('/customers/c1');
    const billing = await screen.findByRole('region', { name: 'Orders and documents' });
    await user.click(within(billing).getByRole('tab', { name: 'Wallet' }));

    const topUp = await rowWith('ORD-000006');
    expect(within(topUp).getByText('Top-up')).toBeVisible();
    expect(within(topUp).getByText('+₹1,000.00')).toBeVisible();
    expect(within(topUp).getByText('₹1,000.00')).toBeVisible();
    expect(within(topUp).getByText('1 Dec 2026, 10:30 am')).toBeVisible();
    expect(within(topUp).getByText('Asha Manager')).toBeVisible();

    const refund = await rowWith('ORD-000007');
    expect(within(refund).getByText('Refund')).toBeVisible();
    expect(within(refund).getByText('-₹400.00')).toBeVisible();
    expect(within(refund).getByText('₹599.50')).toBeVisible();
    expect(within(refund).getByText(/Closing the account/)).toBeVisible();

    const returned = await rowWith('Returned');
    expect(within(returned).getByText('+₹0.25')).toBeVisible();
    expect(within(returned).getByText('Campaign')).toBeVisible();
    expect(within(returned).getByText('the phone refused it')).toBeVisible();
    // the id of the entry it returns is not for people
    expect(within(returned).queryByText('e4')).toBeNull();

    const message = await rowWith('Chatbot');
    expect(within(message).getByText('Message')).toBeVisible();
    expect(within(message).getByText('-₹0.25')).toBeVisible();
    expect(within(message).getByText('Brand A')).toBeVisible();

    await user.click(within(billing).getByRole('button', { name: 'Go to next page' }));
    await waitFor(() =>
      expect(urlsOf(fetch, `GET ${BASE}/wallet/entries`)).toEqual([
        `${BASE}/wallet/entries?page=0`,
        `${BASE}/wallet/entries?page=1`,
      ]),
    );
  });

  it('shows usage by day and source, and asks again for another span', async () => {
    const fetch = mockFetch(staff());
    const { user } = renderApp('/customers/c1');
    const billing = await screen.findByRole('region', { name: 'Orders and documents' });
    await user.click(within(billing).getByRole('tab', { name: 'Usage' }));

    const campaign = await rowWith('2 Dec 2026');
    expect(within(campaign).getByText('Campaign')).toBeVisible();
    expect(within(campaign).getByText('120')).toBeVisible();
    expect(within(campaign).getByText('₹30.00')).toBeVisible();
    expect(within(billing).getByText('₹0.7575')).toBeVisible();

    await user.click(within(billing).getByRole('button', { name: '7 days' }));
    await waitFor(() =>
      expect(urlsOf(fetch, `GET ${BASE}/wallet/usage`)).toEqual([
        `${BASE}/wallet/usage?days=30`,
        `${BASE}/wallet/usage?days=7`,
      ]),
    );
  });

  it('shows a customer its own wallet, ledger and usage, without who did what', async () => {
    mockFetch(mine());
    const { user } = renderApp('/billing');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText('₹999.25')).toBeVisible();
    expect(within(card).getByText('₹0.25 per message')).toBeVisible();

    const documents = await screen.findByRole('region', { name: 'Invoices, credit and wallet' });
    await user.click(within(documents).getByRole('tab', { name: 'Wallet' }));
    expect(await rowWith('ORD-000006')).toBeVisible();
    expect(within(documents).queryByRole('columnheader', { name: 'By' })).toBeNull();
    expect(within(documents).queryByText('Asha Manager')).toBeNull();

    await user.click(within(documents).getByRole('tab', { name: 'Usage' }));
    expect(await rowWith('2 Dec 2026')).toBeVisible();
  });

  it('does not warn about a low balance on a plan that charges nothing', async () => {
    mockFetch(
      staff({
        [`GET ${BASE}/wallet`]: {
          status: 200,
          body: wallet({ balance: 0, lowBalanceAt: 100, low: true, messageRate: null, refundable: 0 }),
        },
      }),
    );
    renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText('Messages are not charged on this plan.')).toBeVisible();
    expect(within(card).queryByText(/below the warning level/)).toBeNull();
    expect(within(card).queryByText('Warning level')).toBeNull();
  });

  it('drops the low-wallet notice once the wallet it shows is no longer low', async () => {
    // the session learned the wallet was low before the top-up was paid; only asking again after the wallet
    // was read says otherwise
    let walletRead = false;
    let askedAfter = 0;
    mockFetch(
      mine({
        // not a 402 here: that alone makes the session ask again
        'GET /api/workspaces/w1/crm/status': { status: 404, body: { code: 'NOT_FOUND' } },
        'GET /api/my/billing/wallet': () => {
          walletRead = true;
          return { status: 200, body: wallet() };
        },
        'GET /api/users/me': () => {
          if (walletRead) askedAfter += 1;
          return {
            status: 200,
            body: { ...CUSTOMER_ADMIN, subscription: { ...summaryIn('ACTIVE'), lowWallet: !walletRead } },
          };
        },
      }),
    );
    renderApp('/billing');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText('₹999.25')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Wallet notice' })).toBeNull());
    expect(askedAfter).toBeGreaterThan(0);
  });
});
