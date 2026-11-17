import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, meAs, storeSession } from '../../../test/session';
import { NO_SUBSCRIPTION, billingRoutes, subscription } from '../../../test/billing';
import { rowWith, urlsOf } from '../../../test/admin';

const ACME = {
  id: 'c1',
  name: 'Acme',
  active: true,
  disabled: null,
  creationTime: '2026-10-20T10:00:00Z',
  planName: null,
  subscriptionState: 'NONE',
};
const DETAIL = { customer: ACME, workspaces: [{ id: 'w1', name: 'Acme Retail', disabled: null }], admins: [] };

const customerRoutes = {
  'GET /api/customers/c1': { status: 200, body: DETAIL },
  'GET /api/customers/c1/users': { status: 200, body: [] },
  'GET /api/customers/c1/workspaces/w1/crm': {
    status: 200,
    body: { enabled: false, maxPipelines: null, maxCustomFields: null },
  },
};

describe("a customer's subscription", () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the plan, what it includes and the limits', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': { status: 200, body: subscription({ state: 'GRACE' }) },
    });
    renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Subscription' });
    expect(await within(card).findByText('Gold')).toBeVisible();
    expect(within(card).getByText('Grace')).toBeVisible();
    expect(within(card).getByText(/Read-only from 8 Jan 2027/)).toBeVisible();
    expect(within(card).getByText('In this plan')).toBeVisible();
    expect(within(card).getByText('CRM')).toBeVisible();
    expect(within(card).getByText('Automations')).toBeVisible();
    expect(within(within(card).getByText('3 of 5').closest('tr') as HTMLElement).getByText('Users')).toBeVisible();
    expect(
      within(within(card).getByText('Brands').closest('tr') as HTMLElement).getByText('1 of unlimited'),
    ).toBeVisible();
  });

  it('has no actions for someone who may only look, and no card for someone who may not', async () => {
    const viewer = {
      ...ACCOUNT_MANAGER,
      authorities: ACCOUNT_MANAGER.authorities.filter((a) => a !== 'subscription:manage'),
    };
    mockFetch({
      ...meAs(viewer),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': { status: 200, body: subscription() },
    });
    renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Subscription' });
    expect(await within(card).findByText('Gold')).toBeVisible();
    expect(within(card).queryByRole('button', { name: 'Change plan' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Renew' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Add add-on' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'History' })).toBeVisible();

    vi.unstubAllGlobals();
    const blind = { ...viewer, authorities: viewer.authorities.filter((a) => a !== 'subscription:view') };
    mockFetch({ ...meAs(blind), ...customerRoutes });
    renderApp('/customers/c1');
    await screen.findAllByText('Acme Retail');
    expect(screen.getAllByRole('region', { name: 'Subscription' })).toHaveLength(1);
  });

  it('offers what can be done with the plan as it stands', async () => {
    const names = (card: HTMLElement) =>
      within(card)
        .getAllByRole('button')
        .map((b) => b.textContent);
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': { status: 200, body: subscription() },
    });
    const first = renderApp('/customers/c1');
    let card = await screen.findByRole('region', { name: 'Subscription' });
    await within(card).findByText('Gold');
    expect(names(card)).toEqual(['Change plan', 'Renew', 'Add add-on', 'More', 'History']);
    first.unmount();

    vi.unstubAllGlobals();
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': {
        status: 200,
        body: subscription({ state: 'EXPIRED', readOnly: true }),
      },
    });
    const second = renderApp('/customers/c1');
    card = await screen.findByRole('region', { name: 'Subscription' });
    await within(card).findByText('Gold');
    expect(names(card)).toEqual(['New plan', 'Renew', 'History']);
    second.unmount();

    vi.unstubAllGlobals();
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': { status: 200, body: NO_SUBSCRIPTION },
    });
    renderApp('/customers/c1');
    card = await screen.findByRole('region', { name: 'Subscription' });
    await within(card).findByText('No plan');
    expect(names(card)).toEqual(['New plan', 'History']);
  });

  it('shows account credit, a renewal that waits and a cancelled plan', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': {
        status: 200,
        body: subscription({
          creditBalance: 182.71,
          next: { planName: 'Gold', termStart: '2026-12-31T18:30:00Z', termEnd: '2027-01-31T18:30:00Z' },
        }),
      },
    });
    const first = renderApp('/customers/c1');
    let card = await screen.findByRole('region', { name: 'Subscription' });
    expect(await within(card).findByText('₹182.71')).toBeVisible();
    expect(within(card).getByText('Gold, from 1 Jan 2027 to 31 Jan 2027')).toBeVisible();
    // a plan that is renewed already cannot be renewed again
    expect(within(card).queryByRole('button', { name: 'Renew' })).toBeNull();
    first.unmount();

    vi.unstubAllGlobals();
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': {
        status: 200,
        body: subscription({ state: 'EXPIRED', readOnly: true, cancelled: true }),
      },
    });
    renderApp('/customers/c1');
    card = await screen.findByRole('region', { name: 'Subscription' });
    expect(await within(card).findByText('Cancelled')).toBeVisible();
    expect(within(card).queryByRole('button', { name: 'Renew' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'New plan' })).toBeVisible();
  });

  it("shows each customer's plan in the list and filters those without one", async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers': {
        status: 200,
        body: {
          items: [
            { ...ACME, planName: 'Gold', subscriptionState: 'GRACE' },
            { ...ACME, id: 'c2', name: 'Globex' },
          ],
          total: 2,
          page: 0,
        },
      },
    });
    const { user } = renderApp('/customers');
    const acme = await rowWith('Acme');
    expect(within(acme).getByText('Gold')).toBeVisible();
    expect(within(acme).getByText('Grace')).toBeVisible();
    expect(within(await rowWith('Globex')).getByText('No plan')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Without a plan' }));
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/customers').some((u) => u.includes('noPlan=true'))).toBe(true));
  });
});
