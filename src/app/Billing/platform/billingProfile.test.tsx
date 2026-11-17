import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, meAs, storeSession } from '../../../test/session';
import { NO_PROFILE, NO_SUBSCRIPTION, PROFILE, billingRoutes } from '../../../test/billing';
import { fill } from '../../../test/admin';

const ACME = {
  id: 'c1',
  name: 'Acme',
  active: true,
  disabled: null,
  creationTime: '2026-10-20T10:00:00Z',
  planName: null,
  subscriptionState: 'NONE',
};
const routes = {
  'GET /api/customers/c1': { status: 200, body: { customer: ACME, workspaces: [], admins: [] } },
  'GET /api/customers/c1/users': { status: 200, body: [] },
  'GET /api/billing/customers/c1/subscription': { status: 200, body: NO_SUBSCRIPTION },
};

describe("a customer's billing profile", () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is filled in by staff', async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...routes,
      'GET /api/billing/customers/c1/billing-profile': { status: 200, body: NO_PROFILE },
      'PUT /api/billing/customers/c1/billing-profile': { status: 200, body: PROFILE },
    });
    const { user } = renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Billing profile' });
    expect(await within(card).findByText('Not filled in yet')).toBeVisible();
    await user.click(within(card).getByRole('button', { name: 'Edit' }));

    const dialog = await screen.findByRole('dialog');
    await fill(user, 'Legal name', 'Acme Retail Pvt Ltd');
    await fill(user, 'Address', '1 MG Road, Bengaluru 560001');
    await user.selectOptions(within(dialog).getByLabelText(/^State/), '29');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(requestTo(fetch, 'PUT /api/billing/customers/c1/billing-profile')?.body).toEqual({
        legalName: 'Acme Retail Pvt Ltd',
        address: '1 MG Road, Bengaluru 560001',
        stateCode: '29',
        gstin: '',
      }),
    );
    expect(await within(card).findByText('Acme Retail Pvt Ltd')).toBeVisible();
    expect(within(card).getByText('29 · Karnataka')).toBeVisible();
    expect(within(card).getByText('Not registered for GST')).toBeVisible();
  });

  it('shows what the server refuses under the field', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...routes,
      'GET /api/billing/customers/c1/billing-profile': { status: 200, body: PROFILE },
      'PUT /api/billing/customers/c1/billing-profile': {
        status: 400,
        body: { code: 'VALIDATION', fields: { gstin: 'is not a GSTIN' } },
      },
    });
    const { user } = renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Billing profile' });
    await user.click(await within(card).findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Legal name/)).toHaveValue('Acme Retail Pvt Ltd');
    await fill(user, 'GSTIN', 'XX');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('is not a GSTIN')).toBeVisible();
  });

  it('says why a state cannot change while an order waits', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      ...routes,
      'GET /api/billing/customers/c1/billing-profile': { status: 200, body: PROFILE },
      'PUT /api/billing/customers/c1/billing-profile': {
        status: 409,
        body: { code: 'ORDER_PENDING', message: 'An order is waiting for payment; cancel it first' },
      },
    });
    const { user } = renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Billing profile' });
    await user.click(await within(card).findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/^State/), '27');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('An order is waiting for payment; cancel it first')).toBeVisible();
  });

  it('cannot be edited by someone who may only look', async () => {
    const viewer = {
      ...ACCOUNT_MANAGER,
      authorities: ACCOUNT_MANAGER.authorities.filter((a) => a !== 'subscription:manage'),
    };
    mockFetch({
      ...meAs(viewer),
      ...billingRoutes(),
      ...routes,
      'GET /api/billing/customers/c1/billing-profile': { status: 200, body: PROFILE },
    });
    renderApp('/customers/c1');
    const card = await screen.findByRole('region', { name: 'Billing profile' });
    expect(await within(card).findByText('Acme Retail Pvt Ltd')).toBeVisible();
    expect(within(card).queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});
