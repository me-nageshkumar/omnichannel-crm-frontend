import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../../test/session';
import { billingRoutes, plan } from '../../../test/billing';
import { fill, rowAction, rowWith } from '../../../test/admin';

describe('plans', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists the plans with the prices the server worked out', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes({
        'GET /api/billing/plans': {
          status: 200,
          body: [
            plan({ customers: 3 }),
            plan({
              code: 'silver-monthly',
              name: 'Silver',
              rank: 1,
              status: 'DRAFT',
              actualPrice: 500,
              discountPercent: 0,
              discountAmount: 0,
              discountedPrice: 500,
            }),
          ],
        },
      }),
    });
    renderApp('/platform/plans');
    const gold = await rowWith('Gold');
    expect(within(gold).getByText('Monthly')).toBeVisible();
    expect(within(gold).getByText('₹1,000')).toBeVisible();
    expect(within(gold).getByText('10%')).toBeVisible();
    expect(within(gold).getByText('₹900')).toBeVisible();
    expect(within(gold).getByText('Active')).toBeVisible();
    expect(within(gold).getByText('3')).toBeVisible();
    expect(within(await rowWith('Silver')).getByText('Draft')).toBeVisible();
    expect(screen.getByRole('link', { name: 'New plan' })).toBeVisible();
  });

  it('activates, retires and duplicates from the list', async () => {
    const draft = plan({ status: 'DRAFT' });
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes({ 'GET /api/billing/plans': { status: 200, body: [draft] } }),
      'POST /api/billing/plans/gold-monthly/activate': { status: 200, body: plan({ status: 'ACTIVE' }) },
      'POST /api/billing/plans/gold-monthly/duplicate': {
        status: 201,
        body: plan({ code: 'gold-yearly', name: 'Gold yearly', period: 'YEARLY', status: 'DRAFT' }),
      },
    });
    const { user } = renderApp('/platform/plans');
    await rowAction(user, 'Gold', 'Activate');
    expect(await within(await rowWith('Gold')).findByText('Active')).toBeVisible();

    await rowAction(user, 'Gold', 'Duplicate');
    await fill(user, 'Code', 'gold-yearly');
    await fill(user, 'Name', 'Gold yearly');
    await user.selectOptions(screen.getByLabelText(/^Period/), 'YEARLY');
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    await waitFor(() =>
      expect(requestTo(fetch, 'POST /api/billing/plans/gold-monthly/duplicate')?.body).toEqual({
        code: 'gold-yearly',
        name: 'Gold yearly',
        period: 'YEARLY',
      }),
    );
    expect(await rowWith('Gold yearly')).toBeVisible();
  });

  it('shows the price the server gives, never one worked out here', async () => {
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes(),
      'GET /api/billing/plans/gold-monthly': { status: 200, body: plan() },
      // deliberately not what the inputs add up to
      'POST /api/billing/plans/price': {
        status: 200,
        body: { actualPrice: 7777, discountAmount: 777, discountedPrice: 7000 },
      },
    });
    renderApp('/platform/plans/gold-monthly');
    const summary = await screen.findByRole('region', { name: 'Price' });
    expect(await within(summary).findByText(/₹7,777/)).toBeVisible();
    expect(within(summary).getByText(/₹777/)).toBeVisible();
    expect(within(summary).getByText(/₹7,000/)).toBeVisible();
    expect(within(summary).getByText(/per month/)).toBeVisible();
    expect(requestTo(fetch, 'POST /api/billing/plans/price')?.body).toEqual({
      items: [{ groupCode: 'crm', price: 1000 }],
      discountPercent: 10,
    });
    expect(screen.getByText('Changes apply to customers at their next renewal.')).toBeVisible();
  });

  it('creates a plan and says what the server refuses', async () => {
    let refuse = true;
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes({ 'GET /api/billing/plans': { status: 200, body: [] } }),
      'POST /api/billing/plans/price': { status: 200, body: { actualPrice: 0, discountAmount: 0, discountedPrice: 0 } },
      'POST /api/billing/plans': () =>
        refuse
          ? { status: 400, body: { code: 'VALIDATION', fields: { rank: 'must be between 0 and 999' } } }
          : { status: 201, body: plan({ code: 'starter', name: 'Starter', status: 'DRAFT' }) },
      'GET /api/billing/plans/starter': {
        status: 200,
        body: plan({ code: 'starter', name: 'Starter', status: 'DRAFT' }),
      },
    });
    const { user } = renderApp('/platform/plans/new');
    await fill(user, 'Code', 'starter');
    await fill(user, 'Name', 'Starter');
    await fill(user, 'Rank', '5000');
    const crm = await screen.findByRole('group', { name: 'CRM' });
    await user.click(within(crm).getByRole('button', { name: 'Included' }));
    await user.type(within(crm).getByRole('spinbutton', { name: 'Price of CRM' }), '1200');
    // AI cannot be included without Chatbots
    const ai = screen.getByRole('group', { name: 'AI' });
    await user.click(within(ai).getByRole('button', { name: 'Included' }));
    expect(await screen.findByText('AI needs Chatbots to be included')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create plan' })).toBeDisabled();
    await user.click(within(ai).getByRole('button', { name: 'Not available' }));

    await user.click(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByText('must be between 0 and 999')).toBeVisible();
    expect(requestTo(fetch, 'POST /api/billing/plans')?.body).toMatchObject({
      code: 'starter',
      name: 'Starter',
      rank: 5000,
      items: [{ groupCode: 'crm', price: 1200 }],
      addOns: [],
    });

    refuse = false;
    await fill(user, 'Rank', '1');
    await user.click(screen.getByRole('button', { name: 'Create plan' }));
    expect(await screen.findByRole('heading', { name: 'Starter' })).toBeVisible();
  });

  it('is read-only for someone who may only look', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      'GET /api/billing/plans/gold-monthly': { status: 200, body: plan() },
    });
    renderApp('/platform/plans');
    await rowWith('Gold');
    expect(screen.queryByRole('link', { name: 'New plan' })).toBeNull();
    vi.unstubAllGlobals();
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      'GET /api/billing/plans/gold-monthly': { status: 200, body: plan() },
    });
    renderApp('/platform/plans/gold-monthly');
    expect(await screen.findByLabelText(/^Name/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    // no price call either: the saved plan's figures are shown
    const summary = screen.getByRole('region', { name: 'Price' });
    expect(within(summary).getByText(/₹900/)).toBeVisible();
  });
});
