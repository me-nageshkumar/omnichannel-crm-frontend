import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { type MockRoute, mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, meAs, storeSession } from '../../../test/session';
import { billingRoutes, order, paidOrder, upgradeQuote } from '../../../test/billing';
import { rowWith, urlsOf } from '../../../test/admin';

const BOLT = order({
  id: 'o2',
  number: 'ORD-000002',
  customerId: 'c2',
  customerName: 'Bolt',
  raisedAt: '2026-12-01T05:05:00Z',
});
const PAY = 'POST /api/billing/orders/o1/pay';

function routes(over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    ...meAs(ACCOUNT_MANAGER),
    ...billingRoutes(),
    'GET /api/billing/orders': { status: 200, body: { items: [order(), BOLT], total: 2, page: 0 } },
    'GET /api/billing/orders/o1': { status: 200, body: order() },
    ...over,
  };
}

async function openOrder(user: ReturnType<typeof renderApp>['user'], number = 'ORD-000001'): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: number }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByRole('region', { name: 'Price' });
  return dialog;
}

describe('the billing requests queue', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists the open requests as the server orders them, and all of them on demand', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/platform/billing-requests');
    const acme = await rowWith('ORD-000001');
    expect(within(acme).getByRole('link', { name: 'Acme' })).toHaveAttribute('href', '/customers/c1');
    expect(within(acme).getByText('New plan')).toBeVisible();
    expect(within(acme).getByText('₹1,062')).toBeVisible();
    expect(within(acme).getByText(/Asha Manager/)).toBeVisible();
    expect(within(acme).getByText('Waiting for payment')).toBeVisible();
    const numbers = screen.getAllByRole('button', { name: /^ORD-/ }).map((b) => b.textContent);
    expect(numbers).toEqual(['ORD-000001', 'ORD-000002']);
    expect(urlsOf(fetch, 'GET /api/billing/orders')).toEqual(['/api/billing/orders?status=REQUESTED&page=0']);

    await user.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() =>
      expect(urlsOf(fetch, 'GET /api/billing/orders')).toEqual([
        '/api/billing/orders?status=REQUESTED&page=0',
        '/api/billing/orders?page=0',
      ]),
    );
  });

  it('records a payment and shows the order activated with its invoice', async () => {
    let paid = false;
    const fetch = mockFetch(
      routes({
        'GET /api/billing/orders/o1': () => ({ status: 200, body: paid ? paidOrder() : order() }),
        [PAY]: () => {
          paid = true;
          return { status: 200, body: paidOrder() };
        },
      }),
    );
    const { user } = renderApp('/platform/billing-requests');
    const dialog = await openOrder(user);
    expect(within(dialog).getByText('Amount payable')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await user.selectOptions(within(dialog).getByLabelText(/^Paid by/), 'UPI');
    // without a reference nothing is sent
    await user.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(await within(dialog).findByText('Enter the payment reference')).toBeVisible();
    expect(requestTo(fetch, PAY)).toBeUndefined();

    await user.type(within(dialog).getByLabelText(/^Reference/), 'UTR-778899');
    const received = within(dialog).getByLabelText(/^Received on/) as HTMLInputElement;
    await user.clear(received);
    await user.type(received, '2026-12-01');
    await user.type(within(dialog).getByLabelText(/^Note/), 'Paid in full');
    await user.click(within(dialog).getByRole('button', { name: 'Save payment' }));

    await waitFor(() =>
      expect(requestTo(fetch, PAY)?.body).toEqual({
        method: 'UPI',
        reference: 'UTR-778899',
        receivedOn: '2026-12-01',
        note: 'Paid in full',
      }),
    );
    expect(await within(dialog).findByText('Activated')).toBeVisible();
    expect(within(dialog).getByRole('link', { name: 'INV/26-27/000001' })).toHaveAttribute(
      'href',
      '/platform/invoices/i1',
    );
    expect(within(dialog).queryByRole('button', { name: 'Record payment' })).toBeNull();
    // the queue behind it was asked again
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/billing/orders')).toHaveLength(2));
  });

  it('says so when someone else paid first, and looks at the order again', async () => {
    let seen = 0;
    const fetch = mockFetch(
      routes({
        'GET /api/billing/orders/o1': () => ({ status: 200, body: seen++ === 0 ? order() : paidOrder() }),
        [PAY]: { status: 409, body: { code: 'ORDER_NOT_OPEN', message: 'x' } },
      }),
    );
    const { user } = renderApp('/platform/billing-requests');
    const dialog = await openOrder(user);
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await user.type(within(dialog).getByLabelText(/^Reference/), 'UTR-1');
    await user.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(await within(dialog).findByText('This request is no longer open.')).toBeVisible();
    expect(await within(dialog).findByText('Activated')).toBeVisible();
    expect(urlsOf(fetch, PAY)).toHaveLength(1);
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/billing/orders')).toHaveLength(2));
  });

  it('explains a stale and an expired request and reloads the queue', async () => {
    const fetch = mockFetch(routes({ [PAY]: { status: 409, body: { code: 'ORDER_STALE', message: 'x' } } }));
    const first = renderApp('/platform/billing-requests');
    let dialog = await openOrder(first.user);
    await first.user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await first.user.type(within(dialog).getByLabelText(/^Reference/), 'UTR-1');
    await first.user.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(await within(dialog).findByText('This quote is out of date; raise it again.')).toBeVisible();
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/billing/orders')).toHaveLength(2));
    first.unmount();

    vi.unstubAllGlobals();
    mockFetch(routes({ [PAY]: { status: 409, body: { code: 'ORDER_EXPIRED', message: 'x' } } }));
    const second = renderApp('/platform/billing-requests');
    dialog = await openOrder(second.user);
    await second.user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await second.user.type(within(dialog).getByLabelText(/^Reference/), 'UTR-1');
    await second.user.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    expect(await within(dialog).findByText('This request has expired; raise it again.')).toBeVisible();
  });

  it('approves an order with nothing to pay', async () => {
    const free = order({ ...upgradeQuote({ kind: 'CHANGE', payable: 0, accountCreditUsed: 1770 }) });
    const fetch = mockFetch(
      routes({
        'GET /api/billing/orders': { status: 200, body: { items: [free], total: 1, page: 0 } },
        'GET /api/billing/orders/o1': { status: 200, body: free },
        [PAY]: { status: 200, body: { ...free, status: 'ACTIVATED' } },
      }),
    );
    const { user } = renderApp('/platform/billing-requests');
    const dialog = await openOrder(user);
    expect(within(dialog).queryByRole('button', { name: 'Record payment' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(requestTo(fetch, PAY)?.body).toEqual({ method: 'NONE' }));
  });

  it('rejects with a reason and cancels a request', async () => {
    const fetch = mockFetch(
      routes({
        'POST /api/billing/orders/o1/reject': {
          status: 200,
          body: order({ status: 'REJECTED', rejectedReason: 'Wrong plan' }),
        },
      }),
    );
    const first = renderApp('/platform/billing-requests');
    let dialog = await openOrder(first.user);
    await first.user.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await first.user.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    expect(await within(dialog).findByText('Say why the request is rejected')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/billing/orders/o1/reject')).toBeUndefined();
    await first.user.type(within(dialog).getByLabelText(/^Reason/), 'Wrong plan');
    await first.user.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    await waitFor(() =>
      expect(requestTo(fetch, 'POST /api/billing/orders/o1/reject')?.body).toEqual({ reason: 'Wrong plan' }),
    );
    first.unmount();

    vi.unstubAllGlobals();
    const again = mockFetch(
      routes({ 'POST /api/billing/orders/o1/cancel': { status: 200, body: order({ status: 'CANCELLED' }) } }),
    );
    const second = renderApp('/platform/billing-requests');
    dialog = await openOrder(second.user);
    await second.user.click(within(dialog).getByRole('button', { name: 'Cancel request' }));
    await second.user.click(within(dialog).getByRole('button', { name: 'Yes, cancel it' }));
    await waitFor(() => expect(urlsOf(again, 'POST /api/billing/orders/o1/cancel')).toHaveLength(1));
  });

  it('shows what happened to a request that is closed', async () => {
    const rejected = order({ status: 'REJECTED', rejectedReason: 'Wrong plan' });
    mockFetch(
      routes({
        'GET /api/billing/orders': { status: 200, body: { items: [rejected], total: 1, page: 0 } },
        'GET /api/billing/orders/o1': { status: 200, body: rejected },
      }),
    );
    const { user } = renderApp('/platform/billing-requests');
    const dialog = await openOrder(user);
    expect(within(dialog).getByText('Rejected')).toBeVisible();
    expect(within(dialog).getByText('Wrong plan')).toBeVisible();
    expect(within(dialog).queryByRole('button', { name: 'Record payment' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('gives someone who may only look no way to act', async () => {
    const viewer = {
      ...ACCOUNT_MANAGER,
      authorities: ACCOUNT_MANAGER.authorities.filter((a) => a !== 'subscription:manage'),
    };
    mockFetch({ ...routes(), ...meAs(viewer) });
    const { user } = renderApp('/platform/billing-requests');
    const dialog = await openOrder(user);
    expect(within(dialog).getByText('Amount payable')).toBeVisible();
    expect(within(dialog).queryByRole('button', { name: 'Record payment' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Cancel request' })).toBeNull();
  });
});
