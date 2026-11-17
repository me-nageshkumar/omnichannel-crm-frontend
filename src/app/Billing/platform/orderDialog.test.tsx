import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { type MockRoute, mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, meAs, storeSession } from '../../../test/session';
import {
  NO_SUBSCRIPTION,
  PROFILE,
  billingRoutes,
  order,
  plan,
  quote,
  subscription,
  upgradeQuote,
} from '../../../test/billing';
import { urlsOf } from '../../../test/admin';

const ACME = {
  id: 'c1',
  name: 'Acme',
  active: true,
  disabled: null,
  creationTime: '2026-10-20T10:00:00Z',
  planName: null,
  subscriptionState: 'NONE',
};
const PLATINUM = plan({
  code: 'platinum-monthly',
  name: 'Platinum',
  rank: 3,
  items: [
    { groupCode: 'crm', price: 1000 },
    { groupCode: 'automations', price: 500 },
  ],
  addOns: [],
  limits: {},
  limitAddOns: [],
  discountPercent: 0,
  actualPrice: 1500,
  discountAmount: 0,
  discountedPrice: 1500,
});
const QUOTES = 'POST /api/billing/customers/c1/quotes';
const ORDERS = 'POST /api/billing/customers/c1/orders';

function routes(current = NO_SUBSCRIPTION, over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    ...meAs(ACCOUNT_MANAGER),
    ...billingRoutes({ 'GET /api/billing/plans': { status: 200, body: [plan(), PLATINUM] } }),
    'GET /api/customers/c1': { status: 200, body: { customer: ACME, workspaces: [], admins: [] } },
    'GET /api/customers/c1/users': { status: 200, body: [] },
    'GET /api/billing/customers/c1/subscription': { status: 200, body: current },
    'GET /api/billing/customers/c1/billing-profile': { status: 200, body: PROFILE },
    [QUOTES]: { status: 200, body: quote() },
    [ORDERS]: { status: 201, body: order() },
    ...over,
  };
}

async function open(user: ReturnType<typeof renderApp>['user'], action: string): Promise<HTMLElement> {
  const card = await screen.findByRole('region', { name: 'Subscription' });
  await user.click(await within(card).findByRole('button', { name: action }));
  return screen.findByRole('dialog');
}

describe('raising an order for a customer', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('prices a new plan and raises exactly what was priced', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user, 'New plan');
    expect(within(dialog).getByRole('button', { name: 'Raise order' })).toBeDisabled();
    expect(within(dialog).getByText('Fill in the form to see the price.')).toBeVisible();

    await user.selectOptions(await within(dialog).findByLabelText(/^Plan/), 'gold-monthly');
    const start = within(dialog).getByLabelText(/^Start date/) as HTMLInputElement;
    await user.clear(start);
    await user.type(start, '2026-12-01');
    await user.click(within(dialog).getByRole('checkbox', { name: /Automations/ }));

    const expected = {
      kind: 'NEW',
      planCode: 'gold-monthly',
      startDate: '2026-12-01',
      addOns: [{ kind: 'GROUP', groupCode: 'automations' }],
    };
    const panel = within(dialog).getByRole('region', { name: 'Price' });
    expect(await within(panel).findByText('Amount payable', {}, { timeout: 3000 })).toBeVisible();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Raise order' })).toBeEnabled());
    const asked = urlsOf(fetch, QUOTES).length;
    expect(requestTo(fetch, QUOTES, asked - 1)?.body).toEqual(expected);

    await user.click(within(dialog).getByRole('button', { name: 'Raise order' }));
    await waitFor(() => expect(requestTo(fetch, ORDERS)?.body).toEqual(expected));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const card = screen.getByRole('region', { name: 'Subscription' });
    expect(await within(card).findByText(/Order ORD-000001 was raised/)).toBeVisible();
  });

  it('never shows or raises the price of a request that is no longer on screen', async () => {
    // every quote waits until the test lets it through
    const waiting: { body: { planCode: string }; release(): void }[] = [];
    const base = mockFetch(
      routes(NO_SUBSCRIPTION, {
        [QUOTES]: (req) => ({
          status: 200,
          body: req.body.planCode === 'platinum-monthly' ? upgradeQuote({ kind: 'NEW' }) : quote(),
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
    const dialog = await open(user, 'New plan');
    const start = within(dialog).getByLabelText(/^Start date/) as HTMLInputElement;
    await user.clear(start);
    await user.type(start, '2026-12-01');
    await user.selectOptions(await within(dialog).findByLabelText(/^Plan/), 'gold-monthly');
    await waitFor(() => expect(waiting).toHaveLength(1), { timeout: 3000 });
    await user.selectOptions(within(dialog).getByLabelText(/^Plan/), 'platinum-monthly');
    await waitFor(() => expect(waiting).toHaveLength(2), { timeout: 3000 });
    const raise = within(dialog).getByRole('button', { name: 'Raise order' });
    expect(raise).toBeDisabled();

    // the answer for Gold arrives although Platinum is chosen: it is not shown, and nothing can be raised
    waiting[0].release();
    await new Promise((r) => setTimeout(r, 50));
    expect(within(dialog).queryByText('Amount payable')).toBeNull();
    expect(within(dialog).queryByText(/Gold, monthly/)).toBeNull();
    expect(raise).toBeDisabled();

    waiting[1].release();
    expect(await within(dialog).findByText(/Platinum, monthly/)).toBeVisible();
    await waitFor(() => expect(raise).toBeEnabled());
    await user.click(raise);
    await waitFor(() =>
      expect(requestTo(base, ORDERS)?.body).toEqual({
        kind: 'NEW',
        planCode: 'platinum-monthly',
        startDate: '2026-12-01',
        addOns: [],
      }),
    );
  });

  it('wants a reason for an extra discount', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user, 'New plan');
    const start = within(dialog).getByLabelText(/^Start date/) as HTMLInputElement;
    await user.clear(start);
    await user.type(start, '2026-12-01');
    await user.selectOptions(await within(dialog).findByLabelText(/^Plan/), 'gold-monthly');
    await user.type(within(dialog).getByLabelText(/^Extra discount/), '50');
    expect(await within(dialog).findByText('Say why the discount is given')).toBeVisible();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Raise order' })).toBeDisabled());

    await user.type(within(dialog).getByLabelText(/^Reason for the discount/), 'Launch offer');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Raise order' })).toBeEnabled(), {
      timeout: 3000,
    });
    const asked = urlsOf(fetch, QUOTES).length;
    expect(requestTo(fetch, QUOTES, asked - 1)?.body).toEqual({
      kind: 'NEW',
      planCode: 'gold-monthly',
      startDate: '2026-12-01',
      addOns: [],
      extraDiscountPercent: 50,
      extraDiscountReason: 'Launch offer',
    });
  });

  it('says what is missing before an order can be raised', async () => {
    mockFetch(
      routes(NO_SUBSCRIPTION, {
        [QUOTES]: {
          status: 409,
          body: { code: 'BILLING_NOT_SET_UP', message: 'x', missing: 'customer billing profile' },
        },
      }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user, 'New plan');
    await user.selectOptions(await within(dialog).findByLabelText(/^Plan/), 'gold-monthly');
    expect(
      await within(dialog).findByText('Billing is not set up yet: customer billing profile.', {}, { timeout: 3000 }),
    ).toBeVisible();
    expect(within(dialog).getByText(/Fill in the billing profile on this page/)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Raise order' })).toBeDisabled();
  });

  it('says so when a request that changes the plan is already open, and shows a refused field', async () => {
    mockFetch(
      routes(subscription(), {
        [QUOTES]: (req) =>
          req.body.planCode === 'gold-monthly'
            ? { status: 400, body: { code: 'VALIDATION', fields: { planCode: 'Only an active plan can be sold' } } }
            : { status: 200, body: upgradeQuote({ kind: 'CHANGE' }) },
        [ORDERS]: { status: 409, body: { code: 'ORDER_PENDING', message: 'x' } },
      }),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user, 'Change plan');
    await user.selectOptions(await within(dialog).findByLabelText(/^Plan/), 'gold-monthly');
    expect(await within(dialog).findByText('Only an active plan can be sold', {}, { timeout: 3000 })).toBeVisible();

    await user.selectOptions(within(dialog).getByLabelText(/^Plan/), 'platinum-monthly');
    const raise = within(dialog).getByRole('button', { name: 'Raise order' });
    await waitFor(() => expect(raise).toBeEnabled(), { timeout: 3000 });
    await user.click(raise);
    expect(
      await within(dialog).findByText('This customer already has an open request that changes its plan.'),
    ).toBeVisible();
  });

  it('renews with the add-ons that are kept', async () => {
    const fetch = mockFetch(routes(subscription()));
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user, 'Renew');
    const held = await within(dialog).findByRole('checkbox', { name: /Automations/ });
    expect(held).toBeChecked();
    await waitFor(() => expect(requestTo(fetch, QUOTES)?.body).toEqual({ kind: 'RENEWAL', keepAddOnIds: ['a1'] }), {
      timeout: 3000,
    });
    await user.click(held);
    await waitFor(
      () => {
        const asked = urlsOf(fetch, QUOTES).length;
        expect(requestTo(fetch, QUOTES, asked - 1)?.body).toEqual({ kind: 'RENEWAL', keepAddOnIds: [] });
      },
      { timeout: 3000 },
    );
  });

  it('adds extra units of a limit in steps', async () => {
    const fetch = mockFetch(
      routes(subscription({ addOns: [], groups: [{ code: 'crm', name: 'CRM', source: 'PLAN' }] })),
    );
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user, 'Add add-on');
    const select = await within(dialog).findByLabelText(/^Add-on/);
    await waitFor(() => expect(within(select).getByRole('option', { name: /Automations/ })).toBeInTheDocument());
    await user.selectOptions(select, 'LIMIT:USERS');
    expect(within(dialog).getByText('Sold in steps of 5')).toBeVisible();
    await user.type(within(dialog).getByLabelText(/^How many more/), '5');
    await waitFor(
      () =>
        expect(requestTo(fetch, QUOTES)?.body).toEqual({
          kind: 'ADDON',
          addOn: { kind: 'LIMIT', limitKey: 'USERS', quantity: 5 },
        }),
      { timeout: 3000 },
    );
  });

  it('counts every purchase of the same extra units when the plan changes', async () => {
    const twice = subscription({
      addOns: [
        { id: 'u1', kind: 'LIMIT', groupCode: null, limitKey: 'USERS', quantity: 5 },
        { id: 'u2', kind: 'LIMIT', groupCode: null, limitKey: 'USERS', quantity: 5 },
      ],
    });
    const fetch = mockFetch(routes(twice));
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user, 'Change plan');
    await user.selectOptions(await within(dialog).findByLabelText(/^Plan/), 'gold-monthly');
    expect(await within(dialog).findByRole('spinbutton', { name: 'Extra Users' })).toHaveValue(10);
    await waitFor(
      () =>
        expect(requestTo(fetch, QUOTES)?.body).toEqual({
          kind: 'CHANGE',
          planCode: 'gold-monthly',
          addOns: [{ kind: 'LIMIT', limitKey: 'USERS', quantity: 10 }],
        }),
      { timeout: 3000 },
    );
  });

  it('starts a plan change from the add-ons the customer holds', async () => {
    const fetch = mockFetch(routes(subscription()));
    const { user } = renderApp('/customers/c1');
    const dialog = await open(user, 'Change plan');
    await user.selectOptions(await within(dialog).findByLabelText(/^Plan/), 'gold-monthly');
    // the held add-on is ticked without anyone touching it
    expect(await within(dialog).findByRole('checkbox', { name: /Automations/ })).toBeChecked();
    await waitFor(
      () =>
        expect(requestTo(fetch, QUOTES)?.body).toEqual({
          kind: 'CHANGE',
          planCode: 'gold-monthly',
          addOns: [{ kind: 'GROUP', groupCode: 'automations' }],
        }),
      { timeout: 3000 },
    );
  });
});
