import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { type MockRoute, mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../../test/session';
import { LEDGER, PROFILE, billingRoutes, order, subscription, wallet, walletRefundQuote } from '../../../test/billing';
import { urlsOf } from '../../../test/admin';

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
const WALLET = `GET ${BASE}/wallet`;
const ENTRIES = `GET ${BASE}/wallet/entries`;
const ADJUST = `POST ${BASE}/wallet/adjustments`;
const THRESHOLD = `PUT ${BASE}/wallet/threshold`;
const REFUND_QUOTE = `POST ${BASE}/wallet/refunds/quote`;
const REFUND = `POST ${BASE}/wallet/refunds`;
const REFUNDED = order({
  ...walletRefundQuote(),
  id: 'o7',
  number: 'ORD-000007',
  status: 'ACTIVATED',
  reason: 'Closing',
});

function routes(over: Record<string, MockRoute> = {}, me = SUPER_ADMIN): Record<string, MockRoute> {
  return {
    ...meAs(me),
    ...billingRoutes(),
    'GET /api/customers/c1': { status: 200, body: { customer: ACME, workspaces: [], admins: [] } },
    'GET /api/customers/c1/users': { status: 200, body: [] },
    [`GET ${BASE}/subscription`]: { status: 200, body: subscription() },
    [`GET ${BASE}/billing-profile`]: { status: 200, body: PROFILE },
    [`GET ${BASE}/orders`]: { status: 200, body: [] },
    [ENTRIES]: { status: 200, body: { items: LEDGER, total: LEDGER.length, page: 0 } },
    [ADJUST]: { status: 200, body: wallet({ balance: 999 }) },
    [THRESHOLD]: { status: 200, body: wallet({ lowBalanceAt: 200 }) },
    [REFUND_QUOTE]: { status: 200, body: walletRefundQuote() },
    [REFUND]: { status: 200, body: REFUNDED },
    ...over,
  };
}

async function more(user: ReturnType<typeof renderApp>['user'], item: string): Promise<HTMLElement> {
  const card = await screen.findByRole('region', { name: 'Wallet' });
  await user.click(await within(card).findByRole('button', { name: 'More' }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
  return screen.findByRole('dialog');
}

describe('staff actions on a wallet', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adjusts the wallet by the amount typed, with a note, and loads the card and the ledger again', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const billing = await screen.findByRole('region', { name: 'Orders and documents' });
    await user.click(within(billing).getByRole('tab', { name: 'Wallet' }));
    await waitFor(() => expect(urlsOf(fetch, ENTRIES)).toHaveLength(1));

    const dialog = await more(user, 'Adjust wallet');
    await user.click(within(dialog).getByRole('button', { name: 'Adjust' }));
    expect(await within(dialog).findByText('Enter an amount; a minus sign takes it out of the wallet')).toBeVisible();
    expect(within(dialog).getByText('Say why, for the record')).toBeVisible();
    expect(requestTo(fetch, ADJUST)).toBeUndefined();

    await user.type(within(dialog).getByLabelText(/^Amount/), '-0.25');
    await user.type(within(dialog).getByLabelText(/^Note/), 'Sent twice');
    const walletAsked = urlsOf(fetch, WALLET).length;
    await user.click(within(dialog).getByRole('button', { name: 'Adjust' }));
    await waitFor(() => expect(requestTo(fetch, ADJUST)?.body).toEqual({ amount: -0.25, note: 'Sent twice' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(urlsOf(fetch, WALLET).length).toBeGreaterThan(walletAsked));
    await waitFor(() => expect(urlsOf(fetch, ENTRIES).length).toBeGreaterThan(1));
  });

  it("shows the server's refusal of an adjustment under its field", async () => {
    mockFetch(
      routes({ [ADJUST]: { status: 400, body: { code: 'VALIDATION', fields: { amount: 'at most 4 decimals' } } } }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Adjust wallet');
    await user.type(within(dialog).getByLabelText(/^Amount/), '0.123456');
    await user.type(within(dialog).getByLabelText(/^Note/), 'Test');
    await user.click(within(dialog).getByRole('button', { name: 'Adjust' }));
    expect(await within(dialog).findByText('at most 4 decimals')).toBeVisible();
  });

  it('sets the low-balance warning, and removes it when the field is empty', async () => {
    const fetch = mockFetch(routes({ [WALLET]: { status: 200, body: wallet({ lowBalanceAt: 200 }) } }));
    const { user } = renderApp('/customers/c1');
    let dialog = await more(user, 'Low-balance warning');
    const level = within(dialog).getByLabelText(/^Warn below/) as HTMLInputElement;
    expect(level.value).toBe('200');
    await user.clear(level);
    await user.type(level, '500');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, THRESHOLD)?.body).toEqual({ lowBalanceAt: 500 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    dialog = await more(user, 'Low-balance warning');
    await user.clear(within(dialog).getByLabelText(/^Warn below/));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, THRESHOLD, 1)?.body).toEqual({ lowBalanceAt: null }));
  });

  it('refunds wallet money for the credit the server works out', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Refund wallet');
    expect(within(dialog).getByText(/Up to ₹999.25 can be refunded/)).toBeVisible();
    const confirm = within(dialog).getByRole('button', { name: 'Refund wallet' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/^Amount/), '400');
    const panel = within(dialog).getByRole('region', { name: 'Price' });
    expect(await within(panel).findByText('Credit to the account', {}, { timeout: 3000 })).toBeVisible();
    expect(within(panel).getAllByText('₹472.00').length).toBeGreaterThan(0);
    expect(within(panel).getByText('Credit for wallet money on INV/26-27/000006')).toBeVisible();
    const asked = urlsOf(fetch, REFUND_QUOTE).length;
    expect(requestTo(fetch, REFUND_QUOTE, asked - 1)?.body).toEqual({ amount: 400 });

    // a reason is part of the record
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    expect(await within(dialog).findByText('Say why, for the record')).toBeVisible();
    expect(requestTo(fetch, REFUND)).toBeUndefined();

    await user.type(within(dialog).getByLabelText(/^Reason/), 'Closing');
    await user.click(confirm);
    await waitFor(() => expect(requestTo(fetch, REFUND)?.body).toEqual({ amount: 400, reason: 'Closing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const card = screen.getByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText(/₹472.00 was added to the account credit/)).toBeVisible();
  });

  it('asks for the credit again when the amount changes, and says when the wallet does not hold it', async () => {
    const fetch = mockFetch(
      routes({
        [REFUND_QUOTE]: (req) =>
          req.body.amount === 5000
            ? {
                status: 409,
                body: { code: 'NOT_ENOUGH_WALLET', message: 'The wallet holds less than that' },
              }
            : { status: 200, body: walletRefundQuote() },
      }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Refund wallet');
    const amount = within(dialog).getByLabelText(/^Amount/);
    await user.type(amount, '400');
    const confirm = within(dialog).getByRole('button', { name: 'Refund wallet' });
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 });

    await user.clear(amount);
    await user.type(amount, '5000');
    expect(await within(dialog).findByText('The wallet holds less than that', {}, { timeout: 3000 })).toBeVisible();
    expect(confirm).toBeDisabled();
    const bodies = urlsOf(fetch, REFUND_QUOTE).map((_u, i) => requestTo(fetch, REFUND_QUOTE, i)?.body.amount);
    expect(bodies[0]).toBe(400);
    expect(bodies[bodies.length - 1]).toBe(5000);
  });

  it('offers an account manager the adjustment and the warning, not the refund', async () => {
    mockFetch(routes({}, ACCOUNT_MANAGER));
    const { user } = renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    await user.click(await within(card).findByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Adjust wallet' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Low-balance warning' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Refund wallet' })).toBeNull();
  });

  it('reads only plain digits as an amount', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    let dialog = await more(user, 'Adjust wallet');
    await user.type(within(dialog).getByLabelText(/^Amount/), '1e3');
    await user.type(within(dialog).getByLabelText(/^Note/), 'Goodwill');
    await user.click(within(dialog).getByRole('button', { name: 'Adjust' }));
    expect(await within(dialog).findByText('Enter an amount; a minus sign takes it out of the wallet')).toBeVisible();
    expect(requestTo(fetch, ADJUST)).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    dialog = await more(user, 'Refund wallet');
    await user.type(within(dialog).getByLabelText(/^Amount/), '1,000');
    expect(await within(dialog).findByText('Enter the amount in digits, for example 400')).toBeVisible();
    await new Promise((r) => setTimeout(r, 400));
    expect(requestTo(fetch, REFUND_QUOTE)).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    dialog = await more(user, 'Low-balance warning');
    await user.type(within(dialog).getByLabelText(/^Warn below/), '0x10');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Enter an amount, or leave it empty for no warning')).toBeVisible();
    expect(requestTo(fetch, THRESHOLD)).toBeUndefined();
  });
});
