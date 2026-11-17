import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../../test/session';
import { SETTINGS, billingRoutes } from '../../../test/billing';
import { fill } from '../../../test/admin';

describe('billing settings', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads and saves the settings', async () => {
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes(),
      'PUT /api/billing/settings': {
        status: 200,
        body: { ...SETTINGS, graceDays: 3, customersWithoutPlan: 'READ_ONLY', version: 0 },
      },
    });
    const { user } = renderApp('/platform/billing-settings');
    expect(await screen.findByLabelText(/^Time zone/)).toHaveValue('Asia/Kolkata');
    await fill(user, 'Grace days', '3');
    await user.click(screen.getByRole('radio', { name: /Read-only/ }));
    expect(screen.getByText(/stops every customer that has no plan from changing anything/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, 'PUT /api/billing/settings')?.body).toEqual({
        zone: 'Asia/Kolkata',
        graceDays: 3,
        customersWithoutPlan: 'READ_ONLY',
        version: null,
      }),
    );
    expect(await screen.findByText('Settings saved')).toBeVisible();
  });

  it('shows what the server refuses under the field', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes(),
      'PUT /api/billing/settings': {
        status: 400,
        body: { code: 'VALIDATION', fields: { zone: 'is not a time zone, for example Asia/Kolkata' } },
      },
    });
    const { user } = renderApp('/platform/billing-settings');
    await fill(user, 'Time zone', 'Mars/Olympus');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('is not a time zone, for example Asia/Kolkata')).toBeVisible();
  });

  it('is not there for an account manager', async () => {
    mockFetch({ ...meAs(ACCOUNT_MANAGER), ...billingRoutes() });
    renderApp('/platform/billing-settings');
    expect(await screen.findByText(/404/)).toBeVisible();
  });
});
