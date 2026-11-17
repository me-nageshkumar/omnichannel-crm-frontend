import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { type MockRoute, mockFetch } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, meAs, storeSession } from '../../../test/session';
import {
  PROFILE,
  billingRoutes,
  creditNote,
  invoice,
  order,
  paidOrder,
  refund,
  subscription,
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

function routes(over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    ...meAs(ACCOUNT_MANAGER),
    ...billingRoutes(),
    'GET /api/customers/c1': { status: 200, body: { customer: ACME, workspaces: [], admins: [] } },
    'GET /api/customers/c1/users': { status: 200, body: [] },
    [`GET ${BASE}/subscription`]: { status: 200, body: subscription() },
    [`GET ${BASE}/billing-profile`]: { status: 200, body: PROFILE },
    [`GET ${BASE}/orders`]: { status: 200, body: [order({ id: 'o2', number: 'ORD-000002' }), paidOrder()] },
    [`GET ${BASE}/invoices`]: { status: 200, body: [invoice({ credited: 464.52 })] },
    [`GET ${BASE}/credit-notes`]: { status: 200, body: [creditNote()] },
    [`GET ${BASE}/refunds`]: {
      status: 200,
      body: [refund(), refund({ id: 'r2', number: 'RF-000002', amount: 500, status: 'FAILED' })],
    },
    ...over,
  };
}

describe("a customer's orders and documents", () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists orders, invoices, credit notes and refunds with the amounts the server sent', async () => {
    mockFetch(routes());
    const { user } = renderApp('/customers/c1');
    const billing = await screen.findByRole('region', { name: 'Orders and documents' });

    const waiting = await rowWith('ORD-000002');
    expect(within(waiting).getByText('New plan')).toBeVisible();
    expect(within(waiting).getByText('₹1,062')).toBeVisible();
    expect(within(waiting).getByText('Waiting for payment')).toBeVisible();
    expect(within(await rowWith('ORD-000001')).getByText('Activated')).toBeVisible();

    await user.click(within(billing).getByRole('tab', { name: 'Invoices' }));
    const inv = await rowWith('INV/26-27/000001');
    expect(within(inv).getByRole('link', { name: 'INV/26-27/000001' })).toHaveAttribute(
      'href',
      '/platform/invoices/i1',
    );
    expect(within(inv).getByText('1 Dec 2026')).toBeVisible();
    expect(within(inv).getByText('₹900.00')).toBeVisible();
    expect(within(inv).getByText('CGST ₹81.00 + SGST ₹81.00')).toBeVisible();
    expect(within(inv).getByText('₹1,062.00')).toBeVisible();
    expect(within(inv).getByText('₹464.52')).toBeVisible();

    await user.click(within(billing).getByRole('tab', { name: 'Credit notes' }));
    const note = await rowWith('CN/26-27/000001');
    expect(within(note).getByRole('link', { name: 'CN/26-27/000001' })).toHaveAttribute(
      'href',
      '/platform/credit-notes/n1',
    );
    expect(within(note).getByText('INV/26-27/000001')).toBeVisible();
    expect(within(note).getByText('₹548.13')).toBeVisible();

    await user.click(within(billing).getByRole('tab', { name: 'Refunds' }));
    const paid = await rowWith('RF-000001');
    expect(within(paid).getByText('₹100')).toBeVisible();
    expect(within(paid).getByText('Bank transfer')).toBeVisible();
    expect(within(paid).getByText('NEFT-77')).toBeVisible();
    expect(within(paid).getByText('17 Dec 2026')).toBeVisible();
    expect(within(await rowWith('RF-000002')).getByText('Failed: not enough credit')).toBeVisible();
  });

  it('opens an order, and paying it brings the plan and the lists up to date', async () => {
    const fetch = mockFetch(
      routes({
        'GET /api/billing/orders/o2': { status: 200, body: order({ id: 'o2', number: 'ORD-000002' }) },
        'POST /api/billing/orders/o2/pay': {
          status: 200,
          body: paidOrder({ id: 'o2', number: 'ORD-000002', invoiceNumber: 'INV/26-27/000002', invoiceId: 'i2' }),
        },
      }),
    );
    const { user } = renderApp('/customers/c1');
    await user.click(await screen.findByRole('button', { name: 'ORD-000002' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Record payment' }));
    await user.type(within(dialog).getByLabelText(/^Reference/), 'UTR-2');
    await user.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(await within(dialog).findByText('Activated')).toBeVisible();
    await waitFor(() => expect(urlsOf(fetch, `GET ${BASE}/subscription`)).toHaveLength(2));
    await waitFor(() => expect(urlsOf(fetch, `GET ${BASE}/orders`)).toHaveLength(2));
  });

  it('says so when there is nothing yet', async () => {
    mockFetch(routes({ [`GET ${BASE}/orders`]: { status: 200, body: [] } }));
    renderApp('/customers/c1');
    const billing = await screen.findByRole('region', { name: 'Orders and documents' });
    expect(await within(billing).findByText('No orders yet.')).toBeVisible();
  });
});
