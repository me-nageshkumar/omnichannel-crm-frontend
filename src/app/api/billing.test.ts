import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type PlanInput,
  listPlans,
  pricePlan,
  putCustomerSubscription,
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

  it('assigns a plan to a customer', async () => {
    const fetch = mockFetch({ 'PUT /api/billing/customers/c1/subscription': { status: 200, body: {} } });
    await putCustomerSubscription('t', 'c1', {
      planCode: 'gold-monthly',
      startDate: '2026-12-01',
      endDate: '2027-01-01',
      addOns: [{ kind: 'LIMIT', limitKey: 'USERS', quantity: 5 }],
      revision: 2,
    });
    expect(requestTo(fetch, 'PUT /api/billing/customers/c1/subscription')?.body).toEqual({
      planCode: 'gold-monthly',
      startDate: '2026-12-01',
      endDate: '2027-01-01',
      addOns: [{ kind: 'LIMIT', limitKey: 'USERS', quantity: 5 }],
      revision: 2,
    });
  });

  it('filters customers without a plan', async () => {
    const fetch = mockFetch({ 'GET /api/customers': { status: 200, body: { items: [], total: 0, page: 0 } } });
    await listCustomers('t', { q: '', page: 0, noPlan: true });
    expect(urlsOf(fetch, 'GET /api/customers')[0]).toContain('noPlan=true');
  });
});
