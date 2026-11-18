import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { type MockRoute, mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, CUSTOMER_ADMIN, meAs, storeSession } from '../../../test/session';
import {
  NO_WALLET,
  OPTIONS,
  PROFILE,
  billingRoutes,
  myBillingRoutes,
  order,
  subscription,
  summaryIn,
  topUpQuote,
} from '../../../test/billing';
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
const QUOTES = `POST ${BASE}/quotes`;
const ORDERS = `POST ${BASE}/orders`;
const MY_QUOTES = 'POST /api/my/billing/quotes';
const MY_ORDERS = 'POST /api/my/billing/orders';
const crmOff = { 'GET /api/workspaces/w1/crm/status': { status: 402, body: { code: 'CRM_NOT_ENABLED' } } };
const TOP_UP_ORDER = order({ ...topUpQuote(), id: 'o6', number: 'ORD-000006' });

function staff(over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    ...meAs(ACCOUNT_MANAGER),
    ...billingRoutes(),
    'GET /api/customers/c1': { status: 200, body: { customer: ACME, workspaces: [], admins: [] } },
    'GET /api/customers/c1/users': { status: 200, body: [] },
    [`GET ${BASE}/subscription`]: { status: 200, body: subscription() },
    [`GET ${BASE}/billing-profile`]: { status: 200, body: PROFILE },
    [`GET ${BASE}/orders`]: { status: 200, body: [] },
    [QUOTES]: { status: 200, body: topUpQuote() },
    [ORDERS]: { status: 201, body: TOP_UP_ORDER },
    ...over,
  };
}

function mine(user = CUSTOMER_ADMIN, over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    ...meAs({ ...user, subscription: summaryIn('ACTIVE') }),
    ...crmOff,
    ...myBillingRoutes(),
    [MY_QUOTES]: { status: 200, body: topUpQuote() },
    [MY_ORDERS]: { status: 201, body: { ...TOP_UP_ORDER, raisedByStaff: false, raisedBy: null } },
    ...over,
  };
}

async function open(user: ReturnType<typeof renderApp>['user']): Promise<HTMLElement> {
  const card = await screen.findByRole('region', { name: 'Wallet' });
  await user.click(await within(card).findByRole('button', { name: 'Top up' }));
  return screen.findByRole('dialog');
}

describe('topping up the wallet', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('prices a top-up for staff and raises exactly what was priced', async () => {
    const fetch = mockFetch(staff());
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user);
    const raise = within(dialog).getByRole('button', { name: 'Raise order' });
    expect(raise).toBeDisabled();
    expect(within(dialog).getByText('Between ₹100.00 and ₹10,00,000.00, before tax')).toBeVisible();

    await user.type(within(dialog).getByLabelText(/^Amount/), '1000');
    const panel = within(dialog).getByRole('region', { name: 'Price' });
    expect(await within(panel).findByText('Amount payable', {}, { timeout: 3000 })).toBeVisible();
    // the total with tax and what is left to pay are the same figure here
    expect(within(panel).getAllByText('₹1,180.00')).toHaveLength(2);
    expect(within(panel).getByText('Wallet top-up')).toBeVisible();
    await waitFor(() => expect(raise).toBeEnabled());
    const asked = urlsOf(fetch, QUOTES).length;
    expect(requestTo(fetch, QUOTES, asked - 1)?.body).toEqual({ kind: 'TOPUP', topUpAmount: 1000 });

    await user.click(raise);
    await waitFor(() => expect(requestTo(fetch, ORDERS)?.body).toEqual({ kind: 'TOPUP', topUpAmount: 1000 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const card = screen.getByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText(/Order ORD-000006 was raised for ₹1,180.00/)).toBeVisible();
  });

  it('never shows or raises the price of an amount that is no longer on screen', async () => {
    const waiting: { body: { topUpAmount: number }; release(): void }[] = [];
    const base = mockFetch(
      staff({
        [QUOTES]: (req) => ({
          status: 200,
          body: req.body.topUpAmount === 500 ? topUpQuote({ taxable: 500, total: 590, payable: 590 }) : topUpQuote(),
        }),
      }),
    );
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if ((init?.method ?? 'GET') === 'POST' && url.endsWith('/quotes')) {
        await new Promise<void>((release) => {
          waiting.push({ body: JSON.parse(init?.body as string), release });
        });
      }
      return base(input, init);
    });
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user);
    const amount = within(dialog).getByLabelText(/^Amount/);
    await user.type(amount, '500');
    await waitFor(() => expect(waiting).toHaveLength(1), { timeout: 3000 });
    await user.clear(amount);
    await user.type(amount, '1000');
    await waitFor(() => expect(waiting.some((w) => w.body.topUpAmount === 1000)).toBe(true), { timeout: 3000 });
    const raise = within(dialog).getByRole('button', { name: 'Raise order' });
    expect(raise).toBeDisabled();

    // the answer for 500 arrives although 1000 is on screen
    waiting.filter((w) => w.body.topUpAmount === 500).forEach((w) => w.release());
    await new Promise((r) => setTimeout(r, 50));
    expect(within(dialog).queryByText('Amount payable')).toBeNull();
    expect(within(dialog).queryByText('₹590.00')).toBeNull();
    expect(raise).toBeDisabled();

    waiting.filter((w) => w.body.topUpAmount !== 500).forEach((w) => w.release());
    expect((await within(dialog).findAllByText('₹1,180.00')).length).toBeGreaterThan(0);
    await waitFor(() => expect(raise).toBeEnabled());
    await user.click(raise);
    await waitFor(() => expect(requestTo(base, ORDERS)?.body).toEqual({ kind: 'TOPUP', topUpAmount: 1000 }));
  });

  it('asks for nothing while the amount is blank or no number, and shows a refusal under the field', async () => {
    const fetch = mockFetch(
      staff({
        [QUOTES]: {
          status: 400,
          body: { code: 'VALIDATION', fields: { topUpAmount: 'must be at least 100.00' } },
        },
      }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user);
    const amount = within(dialog).getByLabelText(/^Amount/);
    await user.type(amount, 'abc');
    await new Promise((r) => setTimeout(r, 400));
    expect(requestTo(fetch, QUOTES)).toBeUndefined();

    await user.clear(amount);
    await user.type(amount, '50');
    expect(await within(dialog).findByText('must be at least 100.00', {}, { timeout: 3000 })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Raise order' })).toBeDisabled();
  });

  it('offers no top-up where the plan does not charge messages', async () => {
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
      }),
    );
    renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText('Messages are not charged on this plan.')).toBeVisible();
    expect(within(card).queryByRole('button', { name: 'Top up' })).toBeNull();
  });

  it("sends a customer's own top-up request and lists it with how to pay", async () => {
    let raised = false;
    const fetch = mockFetch(
      mine(CUSTOMER_ADMIN, {
        'GET /api/my/billing/orders': () => ({
          status: 200,
          body: raised ? [{ ...TOP_UP_ORDER, raisedByStaff: false, raisedBy: null }] : [],
        }),
        [MY_ORDERS]: () => {
          raised = true;
          return { status: 201, body: { ...TOP_UP_ORDER, raisedByStaff: false, raisedBy: null } };
        },
      }),
    );
    const { user } = renderApp('/billing');
    const dialog = await open(user);
    expect(within(dialog).getByText(/takes effect when your payment is recorded/)).toBeVisible();
    await user.type(within(dialog).getByLabelText(/^Amount/), '1000');
    const send = within(dialog).getByRole('button', { name: 'Send request' });
    await waitFor(() => expect(send).toBeEnabled(), { timeout: 3000 });
    await user.click(send);
    await waitFor(() => expect(requestTo(fetch, MY_ORDERS)?.body).toEqual({ kind: 'TOPUP', topUpAmount: 1000 }));

    const requests = await screen.findByRole('region', { name: 'Requests' });
    expect(await within(requests).findByText(/Wallet top-up ₹1,000.00/)).toBeVisible();
    expect(within(requests).getByText(/Amount payable ₹1,180.00/)).toBeVisible();
    expect(within(requests).getByText('UPI omni@bank')).toBeVisible();
  });

  it('gives a customer the reason when it cannot top up, and no button without the right to ask', async () => {
    mockFetch(
      mine(CUSTOMER_ADMIN, {
        'GET /api/my/billing/options': {
          status: 200,
          body: { ...OPTIONS, topUp: { allowed: false, reason: 'Your plan has ended', min: 100, max: 1000000 } },
        },
      }),
    );
    const first = renderApp('/billing');
    const card = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText('Your plan has ended')).toBeVisible();
    expect(within(card).queryByRole('button', { name: 'Top up' })).toBeNull();
    first.unmount();

    mockFetch(mine({ ...CUSTOMER_ADMIN, authorities: ['billing:view'] }));
    renderApp('/billing');
    const again = await screen.findByRole('region', { name: 'Wallet' });
    expect(await within(again).findByText('₹999.25')).toBeVisible();
    expect(within(again).queryByRole('button', { name: 'Top up' })).toBeNull();
  });

  it('does not print the term of the plan under the price of a top-up', async () => {
    mockFetch(staff());
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user);
    await user.type(within(dialog).getByLabelText(/^Amount/), '1000');
    const panel = within(dialog).getByRole('region', { name: 'Price' });
    expect(await within(panel).findByText('Amount payable', {}, { timeout: 3000 })).toBeVisible();
    expect(within(panel).queryByText(/Term:/)).toBeNull();
  });

  it('says how to write an amount it cannot read', async () => {
    const fetch = mockFetch(staff());
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user);
    const amount = within(dialog).getByLabelText(/^Amount/);
    for (const typed of ['1,000', '₹1000', '1e3', '-5', '0']) {
      await user.clear(amount);
      await user.type(amount, typed);
      expect(await within(dialog).findByText('Enter the amount in digits, for example 1000')).toBeVisible();
    }
    await new Promise((r) => setTimeout(r, 400));
    expect(requestTo(fetch, QUOTES)).toBeUndefined();
  });

  it('is ready to be typed into as it opens, and forgets a refusal once the amount changes', async () => {
    let refuse = true;
    mockFetch(
      staff({
        [ORDERS]: () =>
          refuse
            ? {
                status: 400,
                body: { code: 'VALIDATION', fields: { topUpAmount: 'must be between 100 and 10,00,000' } },
              }
            : { status: 201, body: TOP_UP_ORDER },
      }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user);
    await waitFor(() => expect(within(dialog).getByLabelText(/^Amount/)).toHaveFocus());
    await user.keyboard('1000');
    const raise = within(dialog).getByRole('button', { name: 'Raise order' });
    await waitFor(() => expect(raise).toBeEnabled(), { timeout: 3000 });
    await user.click(raise);
    expect(await within(dialog).findByText('must be between 100 and 10,00,000')).toBeVisible();
    expect(within(dialog).getByLabelText(/^Amount/)).toHaveAttribute('aria-invalid', 'true');

    refuse = false;
    await user.type(within(dialog).getByLabelText(/^Amount/), '0');
    await waitFor(() => expect(within(dialog).queryByText('must be between 100 and 10,00,000')).toBeNull());
  });

  it('takes the "order raised" line away once something else changes the billing', async () => {
    mockFetch(
      staff({
        [`GET ${BASE}/orders`]: { status: 200, body: [TOP_UP_ORDER] },
        'GET /api/billing/orders/o6': { status: 200, body: TOP_UP_ORDER },
        'POST /api/billing/orders/o6/cancel': { status: 200, body: { ...TOP_UP_ORDER, status: 'CANCELLED' } },
      }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user);
    await user.keyboard('1000');
    const raise = within(dialog).getByRole('button', { name: 'Raise order' });
    await waitFor(() => expect(raise).toBeEnabled(), { timeout: 3000 });
    await user.click(raise);
    const card = screen.getByRole('region', { name: 'Wallet' });
    expect(await within(card).findByText(/Order ORD-000006 was raised/)).toBeVisible();

    // the order is dealt with from the list under the card
    await user.click(await screen.findByRole('button', { name: 'ORD-000006' }));
    const order = await screen.findByRole('dialog');
    await user.click(await within(order).findByRole('button', { name: 'Cancel order' }));
    const confirm = screen.queryByRole('button', { name: /^(Cancel order|Yes|Confirm)/ });
    if (confirm && confirm !== within(order).queryByRole('button', { name: 'Cancel order' })) await user.click(confirm);
    await waitFor(() => expect(within(card).queryByText(/Order ORD-000006 was raised/)).toBeNull(), { timeout: 3000 });
  });
});
