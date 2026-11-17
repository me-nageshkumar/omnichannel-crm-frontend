import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch } from '../../../test/fetchMock';
import { CUSTOMER_ADMIN, WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { NO_SUBSCRIPTION, myBillingRoutes, subscription, summaryIn } from '../../../test/billing';

const crmOff = { 'GET /api/workspaces/w1/crm/status': { status: 402, body: { code: 'CRM_NOT_ENABLED' } } };

describe('plan and billing, for the customer', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the plan, what it includes and how much of each limit is used', async () => {
    const over = subscription();
    over.limits = over.limits.map((l) => (l.key === 'CHATBOTS' ? { ...l, limit: 10, used: 12 } : l));
    mockFetch({
      ...meAs({ ...CUSTOMER_ADMIN, subscription: summaryIn('ACTIVE') }),
      ...crmOff,
      ...myBillingRoutes(),
      'GET /api/my/billing/subscription': { status: 200, body: over },
    });
    renderApp('/billing');
    expect(await screen.findByRole('heading', { name: 'Plan & billing' })).toBeVisible();
    const summary = await screen.findByRole('region', { name: 'Your plan' });
    expect(within(summary).getByText('Gold')).toBeVisible();
    expect(within(summary).getByText('Monthly')).toBeVisible();
    expect(within(summary).getByText('Active')).toBeVisible();
    expect(within(summary).getByText('1 Dec 2026 – 31 Dec 2026')).toBeVisible();
    expect(screen.getByText('In this plan')).toBeVisible();
    expect(screen.getByText('Add-ons')).toBeVisible();
    expect(screen.getByText('3 of 5')).toBeVisible();
    // over a limit that was lowered: shown as it is, with a full bar
    expect(screen.getByText('12 of 10')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Chatbots used' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getAllByText('1 of unlimited').length).toBeGreaterThan(0);
  });

  it('says by when to renew during grace', async () => {
    mockFetch({
      ...meAs({ ...CUSTOMER_ADMIN, subscription: summaryIn('GRACE') }),
      ...crmOff,
      ...myBillingRoutes(),
      'GET /api/my/billing/subscription': { status: 200, body: subscription({ state: 'GRACE' }) },
    });
    renderApp('/billing');
    const summary = await screen.findByRole('region', { name: 'Your plan' });
    expect(await within(summary).findByText(/Read-only from 8 Jan 2027/)).toBeVisible();
  });

  it('says so when there is no plan', async () => {
    mockFetch({
      ...meAs(CUSTOMER_ADMIN),
      ...crmOff,
      ...myBillingRoutes(),
      'GET /api/my/billing/subscription': { status: 200, body: NO_SUBSCRIPTION },
    });
    renderApp('/billing');
    expect(await screen.findByText('No plan yet')).toBeVisible();
    expect(screen.getByText('Your account manager sets up your first plan.')).toBeVisible();
  });

  it('is only for those who may see billing', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...crmOff });
    renderApp('/billing');
    expect(await screen.findByText(/404/)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Plan & billing' })).toBeNull();
  });
});
