import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
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

  it('assigns a plan to a customer that has none', async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': { status: 200, body: NO_SUBSCRIPTION },
      'PUT /api/billing/customers/c1/subscription': { status: 200, body: subscription() },
    });
    const { user } = renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Subscription' });
    expect(await within(card).findByText('No plan')).toBeVisible();
    await user.click(within(card).getByRole('button', { name: 'Assign plan' }));

    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/^Plan/), 'gold-monthly');
    const start = within(dialog).getByLabelText(/^Start date/) as HTMLInputElement;
    await user.clear(start);
    await user.type(start, '2026-12-01');
    // a month on, as the plan's period says
    await waitFor(() => expect(within(dialog).getByLabelText(/^End date/)).toHaveValue('2027-01-01'));
    await user.click(within(dialog).getByRole('checkbox', { name: /Automations/ }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Extra Users' }), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Assign' }));

    await waitFor(() =>
      expect(requestTo(fetch, 'PUT /api/billing/customers/c1/subscription')?.body).toEqual({
        planCode: 'gold-monthly',
        startDate: '2026-12-01',
        endDate: '2027-01-01',
        addOns: [
          { kind: 'GROUP', groupCode: 'automations' },
          { kind: 'LIMIT', limitKey: 'USERS', quantity: 5 },
        ],
        revision: null,
      }),
    );
    expect(await within(card).findByText('Gold')).toBeVisible();
    expect(within(card).getByText('1 Dec 2026 – 31 Dec 2026')).toBeVisible();
  });

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
    expect(within(card).getByRole('button', { name: 'Change plan' })).toBeVisible();
  });

  it('removes a plan after asking', async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...customerRoutes,
      'GET /api/billing/customers/c1/subscription': { status: 200, body: subscription() },
      'DELETE /api/billing/customers/c1/subscription': { status: 204 },
    });
    const { user } = renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Subscription' });
    await user.click(await within(card).findByRole('button', { name: 'Remove plan' }));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(urlsOf(fetch, 'DELETE /api/billing/customers/c1/subscription')).toHaveLength(1));
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
    expect(within(card).queryByRole('button', { name: 'Remove plan' })).toBeNull();

    vi.unstubAllGlobals();
    const blind = { ...viewer, authorities: viewer.authorities.filter((a) => a !== 'subscription:view') };
    mockFetch({ ...meAs(blind), ...customerRoutes });
    renderApp('/customers/c1');
    await screen.findAllByText('Acme Retail');
    expect(screen.getAllByRole('region', { name: 'Subscription' })).toHaveLength(1);
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
