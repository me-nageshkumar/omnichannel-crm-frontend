import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { type MockRoute, mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../../test/session';
import { PROFILE, billingRoutes, order, refund, subscription, upgradeQuote } from '../../../test/billing';
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
const CREDIT = upgradeQuote().credits[1];
/** What cancelling the automations add-on on 16 Dec gives back. */
const CANCEL_QUOTE = upgradeQuote({
  kind: 'CANCEL_ADDON',
  lines: [],
  taxable: 0,
  total: 0,
  payable: 0,
  accountCreditUsed: 0,
  credits: [CREDIT],
  creditFromNotes: 182.71,
});
const DONE = order({ kind: 'ADJUST', status: 'ACTIVATED', lines: [], total: 0, payable: 0 });

function routes(over: Record<string, MockRoute> = {}, me = SUPER_ADMIN): Record<string, MockRoute> {
  return {
    ...meAs(me),
    ...billingRoutes(),
    'GET /api/customers/c1': { status: 200, body: { customer: ACME, workspaces: [], admins: [] } },
    'GET /api/customers/c1/users': { status: 200, body: [] },
    [`GET ${BASE}/subscription`]: { status: 200, body: subscription({ creditBalance: 182.71 }) },
    [`GET ${BASE}/billing-profile`]: { status: 200, body: PROFILE },
    [`GET ${BASE}/orders`]: { status: 200, body: [] },
    [`POST ${BASE}/cancellations/quote`]: { status: 200, body: CANCEL_QUOTE },
    [`POST ${BASE}/cancellations`]: { status: 200, body: DONE },
    [`POST ${BASE}/adjustments`]: { status: 200, body: DONE },
    [`POST ${BASE}/refunds`]: { status: 201, body: refund() },
    ...over,
  };
}

async function more(user: ReturnType<typeof renderApp>['user'], item: string): Promise<HTMLElement> {
  const card = await screen.findByRole('region', { name: 'Subscription' });
  await user.click(await within(card).findByRole('button', { name: 'More' }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
  return screen.findByRole('dialog');
}

describe('credit actions on a subscription', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('cancels an add-on with the credit the server works out, or another amount', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Cancel add-on: Automations');
    const panel = await within(dialog).findByRole('region', { name: 'Price' });
    expect(await within(panel).findByText('Credit to the account', {}, { timeout: 3000 })).toBeVisible();
    expect(within(panel).getByText('Credit for unused time on INV/2026-27/000002')).toBeVisible();
    expect(requestTo(fetch, `POST ${BASE}/cancellations/quote`)?.body).toEqual({ addOnId: 'a1' });

    await user.type(within(dialog).getByLabelText(/^Credit a different taxable amount/), '203.23');
    await waitFor(
      () => {
        const asked = urlsOf(fetch, `POST ${BASE}/cancellations/quote`).length;
        expect(requestTo(fetch, `POST ${BASE}/cancellations/quote`, asked - 1)?.body).toEqual({
          addOnId: 'a1',
          creditTaxable: 203.23,
        });
      },
      { timeout: 3000 },
    );
    const confirm = within(dialog).getByRole('button', { name: 'Cancel the add-on' });
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 });
    await user.click(confirm);
    expect(await within(dialog).findByText('Say why')).toBeVisible();
    expect(requestTo(fetch, `POST ${BASE}/cancellations`)).toBeUndefined();

    await user.type(within(dialog).getByLabelText(/^Reason/), 'Never worked for them');
    await user.click(confirm);
    await waitFor(() =>
      expect(requestTo(fetch, `POST ${BASE}/cancellations`)?.body).toEqual({
        addOnId: 'a1',
        creditTaxable: 203.23,
        reason: 'Never worked for them',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(urlsOf(fetch, `GET ${BASE}/subscription`)).toHaveLength(2));
  });

  it('cancels the plan after saying what that does', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Cancel plan');
    expect(within(dialog).getByText(/the customer becomes read-only at once/)).toBeVisible();
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Closing the account');
    const confirm = within(dialog).getByRole('button', { name: 'Cancel the plan' });
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 });
    await user.click(confirm);
    await waitFor(() =>
      expect(requestTo(fetch, `POST ${BASE}/cancellations`)?.body).toEqual({
        addOnId: null,
        reason: 'Closing the account',
      }),
    );
  });

  it('shows why a cancellation cannot be priced', async () => {
    mockFetch(
      routes({
        [`POST ${BASE}/cancellations/quote`]: {
          status: 400,
          body: { code: 'VALIDATION', fields: { creditTaxable: 'At most 203.23 was paid for this' } },
        },
      }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Cancel add-on: Automations');
    expect(await within(dialog).findByText('At most 203.23 was paid for this', {}, { timeout: 3000 })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel the add-on' })).toBeDisabled();
  });

  it('extends a term to a new last day', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Extend term');
    const last = within(dialog).getByLabelText(/^New last day/) as HTMLInputElement;
    expect(last).toHaveValue('2026-12-31');
    await user.clear(last);
    await user.type(last, '2027-01-10');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Say why')).toBeVisible();
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Ten days for the outage');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, `POST ${BASE}/adjustments`)?.body).toEqual({
        termEnd: '2027-01-11',
        reason: 'Ten days for the outage',
      }),
    );
  });

  it('posts account credit as typed', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Post account credit');
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Goodwill');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Enter an amount')).toBeVisible();
    expect(requestTo(fetch, `POST ${BASE}/adjustments`)).toBeUndefined();
    await user.type(within(dialog).getByLabelText(/^Amount/), '-50.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, `POST ${BASE}/adjustments`)?.body).toEqual({ creditAmount: -50.5, reason: 'Goodwill' }),
    );
  });

  it('records a refund and says so when there is not enough credit', async () => {
    const fetch = mockFetch(
      routes({ [`POST ${BASE}/refunds`]: { status: 409, body: { code: 'NOT_ENOUGH_CREDIT', message: 'x' } } }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await more(user, 'Record refund');
    expect(within(dialog).getByText('Account credit ₹182.71')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Record refund' }));
    expect(await within(dialog).findByText('Enter the amount that was paid back')).toBeVisible();
    expect(within(dialog).getByText('Enter the payment reference')).toBeVisible();

    await user.type(within(dialog).getByLabelText(/^Amount/), '500');
    await user.type(within(dialog).getByLabelText(/^Reference/), 'NEFT-77');
    const paidOn = within(dialog).getByLabelText(/^Paid on/) as HTMLInputElement;
    await user.clear(paidOn);
    await user.type(paidOn, '2026-12-17');
    await user.click(within(dialog).getByRole('button', { name: 'Record refund' }));
    await waitFor(() =>
      expect(requestTo(fetch, `POST ${BASE}/refunds`)?.body).toEqual({
        amount: 500,
        method: 'BANK_TRANSFER',
        reference: 'NEFT-77',
        paidOn: '2026-12-17',
        note: '',
      }),
    );
    expect(await within(dialog).findByText('There is not that much account credit.')).toBeVisible();
  });

  it('offers an account manager only what moves no money', async () => {
    mockFetch(routes({}, ACCOUNT_MANAGER));
    const { user } = renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Subscription' });
    await user.click(await within(card).findByRole('button', { name: 'More' }));
    const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
    expect(items).toEqual(['Extend term']);
  });
});
