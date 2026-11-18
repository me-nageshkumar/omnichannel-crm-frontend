import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type PlanInput,
  adjustWallet,
  getMyWallet,
  getMyWalletUsage,
  getWallet,
  getWalletUsage,
  listMyWalletEntries,
  listWalletEntries,
  quoteWalletRefund,
  refundWallet,
  setWalletThreshold,
  creditNotePdfPath,
  invoicePdfPath,
  listOrders,
  listPlans,
  myQuote,
  payOrder,
  pdfFileName,
  pricePlan,
  quoteFor,
  raiseOrder,
  updateGroup,
  updatePlan,
} from '@app/api/billing';
import { listCustomers } from '@app/api/customers';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { urlsOf } from '../../test/admin';

const INPUT: PlanInput = {
  code: 'gold-monthly',
  name: 'Gold',
  description: '',
  period: 'MONTHLY',
  rank: 2,
  items: [{ groupCode: 'crm', price: 1000 }],
  addOns: [],
  limits: { USERS: 5 },
  limitAddOns: [],
  discountPercent: 10,
  rates: {},
  offered: true,
};

describe('billing api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists plans by status', async () => {
    const fetch = mockFetch({ 'GET /api/billing/plans': { status: 200, body: [] } });
    await listPlans('t', 'ACTIVE');
    await listPlans('t');
    expect(urlsOf(fetch, 'GET /api/billing/plans')).toEqual(['/api/billing/plans?status=ACTIVE', '/api/billing/plans']);
  });

  it('sends the version with a plan or group edit', async () => {
    const fetch = mockFetch({
      'PUT /api/billing/plans/gold-monthly': { status: 200, body: {} },
      'PUT /api/billing/feature-groups/crm': { status: 200, body: {} },
    });
    await updatePlan('t', 'gold-monthly', { ...INPUT, version: 3 });
    expect(requestTo(fetch, 'PUT /api/billing/plans/gold-monthly')?.body).toMatchObject({ name: 'Gold', version: 3 });
    await updateGroup('t', 'crm', {
      name: 'CRM',
      description: '',
      category: 'PAID',
      authorities: ['crm:view'],
      requires: [],
      sortOrder: 90,
      version: 1,
    });
    expect(requestTo(fetch, 'PUT /api/billing/feature-groups/crm')?.body).toMatchObject({
      category: 'PAID',
      version: 1,
    });
  });

  it('asks the server for a price', async () => {
    const fetch = mockFetch({
      'POST /api/billing/plans/price': {
        status: 200,
        body: { actualPrice: 1000, discountAmount: 100, discountedPrice: 900 },
      },
    });
    const price = await pricePlan('t', { items: INPUT.items, discountPercent: 10 });
    expect(price.discountedPrice).toBe(900);
    expect(requestTo(fetch, 'POST /api/billing/plans/price')?.body).toEqual({
      items: [{ groupCode: 'crm', price: 1000 }],
      discountPercent: 10,
    });
  });

  it('raises an order from the request that was quoted', async () => {
    const fetch = mockFetch({
      'POST /api/billing/customers/c1/quotes': { status: 200, body: {} },
      'POST /api/billing/customers/c1/orders': { status: 201, body: {} },
    });
    const request = { kind: 'NEW' as const, planCode: 'gold-monthly', startDate: '2026-12-01', addOns: [] };
    await quoteFor('t', 'c1', request);
    await raiseOrder('t', 'c1', request);
    expect(requestTo(fetch, 'POST /api/billing/customers/c1/quotes')?.body).toEqual(request);
    expect(requestTo(fetch, 'POST /api/billing/customers/c1/orders')?.body).toEqual(request);
  });

  it('records a payment', async () => {
    const fetch = mockFetch({ 'POST /api/billing/orders/o1/pay': { status: 200, body: {} } });
    await payOrder('t', 'o1', { method: 'UPI', reference: 'UTR-1', receivedOn: '2026-12-01', note: '' });
    expect(requestTo(fetch, 'POST /api/billing/orders/o1/pay')?.body).toEqual({
      method: 'UPI',
      reference: 'UTR-1',
      receivedOn: '2026-12-01',
      note: '',
    });
  });

  it('asks for a page of orders in a status', async () => {
    const fetch = mockFetch({ 'GET /api/billing/orders': { status: 200, body: { items: [], total: 0, page: 0 } } });
    await listOrders('t', { status: 'REQUESTED', page: 0 });
    await listOrders('t', { page: 2 });
    expect(urlsOf(fetch, 'GET /api/billing/orders')).toEqual([
      '/api/billing/orders?status=REQUESTED&page=0',
      '/api/billing/orders?page=2',
    ]);
  });

  it("prices a customer's own request", async () => {
    const fetch = mockFetch({ 'POST /api/my/billing/quotes': { status: 200, body: {} } });
    await myQuote('t', { kind: 'UPGRADE', planCode: 'platinum-monthly' });
    expect(requestTo(fetch, 'POST /api/my/billing/quotes')?.body).toEqual({
      kind: 'UPGRADE',
      planCode: 'platinum-monthly',
    });
  });

  it('names a PDF after its document and serves it from the right side', () => {
    expect(pdfFileName('INV/26-27/000001')).toBe('INV-26-27-000001.pdf');
    expect(invoicePdfPath('i1', false)).toBe('/api/billing/invoices/i1/pdf');
    expect(invoicePdfPath('i1', true)).toBe('/api/my/billing/invoices/i1/pdf');
    expect(creditNotePdfPath('n1', true)).toBe('/api/my/billing/credit-notes/n1/pdf');
  });

  it('filters customers without a plan', async () => {
    const fetch = mockFetch({ 'GET /api/customers': { status: 200, body: { items: [], total: 0, page: 0 } } });
    await listCustomers('t', { q: '', page: 0, noPlan: true });
    expect(urlsOf(fetch, 'GET /api/customers')[0]).toContain('noPlan=true');
  });

  it("reads a customer's wallet, its ledger and its usage", async () => {
    const fetch = mockFetch({
      'GET /api/billing/customers/c1/wallet': { status: 200, body: {} },
      'GET /api/billing/customers/c1/wallet/entries': { status: 200, body: { items: [], total: 0, page: 0 } },
      'GET /api/billing/customers/c1/wallet/usage': { status: 200, body: [] },
    });
    await getWallet('t', 'c1');
    await listWalletEntries('t', 'c1', 2);
    await getWalletUsage('t', 'c1', 7);
    expect(urlsOf(fetch, 'GET /api/billing/customers/c1/wallet')).toEqual(['/api/billing/customers/c1/wallet']);
    expect(urlsOf(fetch, 'GET /api/billing/customers/c1/wallet/entries')).toEqual([
      '/api/billing/customers/c1/wallet/entries?page=2',
    ]);
    expect(urlsOf(fetch, 'GET /api/billing/customers/c1/wallet/usage')).toEqual([
      '/api/billing/customers/c1/wallet/usage?days=7',
    ]);
  });

  it('adjusts a wallet, sets and removes its warning level, and refunds it', async () => {
    const fetch = mockFetch({
      'POST /api/billing/customers/c1/wallet/adjustments': { status: 200, body: {} },
      'PUT /api/billing/customers/c1/wallet/threshold': { status: 200, body: {} },
      'POST /api/billing/customers/c1/wallet/refunds/quote': { status: 200, body: {} },
      'POST /api/billing/customers/c1/wallet/refunds': { status: 200, body: {} },
    });
    await adjustWallet('t', 'c1', { amount: -0.25, note: 'Sent twice' });
    expect(requestTo(fetch, 'POST /api/billing/customers/c1/wallet/adjustments')?.body).toEqual({
      amount: -0.25,
      note: 'Sent twice',
    });
    await setWalletThreshold('t', 'c1', 200);
    await setWalletThreshold('t', 'c1', null);
    expect(requestTo(fetch, 'PUT /api/billing/customers/c1/wallet/threshold', 0)?.body).toEqual({ lowBalanceAt: 200 });
    expect(requestTo(fetch, 'PUT /api/billing/customers/c1/wallet/threshold', 1)?.body).toEqual({ lowBalanceAt: null });
    await quoteWalletRefund('t', 'c1', { amount: 400 });
    expect(requestTo(fetch, 'POST /api/billing/customers/c1/wallet/refunds/quote')?.body).toEqual({ amount: 400 });
    await refundWallet('t', 'c1', { amount: 400, reason: 'Closing' });
    expect(requestTo(fetch, 'POST /api/billing/customers/c1/wallet/refunds')?.body).toEqual({
      amount: 400,
      reason: 'Closing',
    });
  });

  it("reads the signed-in customer's own wallet", async () => {
    const fetch = mockFetch({
      'GET /api/my/billing/wallet': { status: 200, body: {} },
      'GET /api/my/billing/wallet/entries': { status: 200, body: { items: [], total: 0, page: 0 } },
      'GET /api/my/billing/wallet/usage': { status: 200, body: [] },
    });
    await getMyWallet('t');
    await listMyWalletEntries('t', 0);
    await getMyWalletUsage('t', 30);
    expect(urlsOf(fetch, 'GET /api/my/billing/wallet')).toEqual(['/api/my/billing/wallet']);
    expect(urlsOf(fetch, 'GET /api/my/billing/wallet/entries')).toEqual(['/api/my/billing/wallet/entries?page=0']);
    expect(urlsOf(fetch, 'GET /api/my/billing/wallet/usage')).toEqual(['/api/my/billing/wallet/usage?days=30']);
  });
});
