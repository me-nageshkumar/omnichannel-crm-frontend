import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../../test/session';
import { NEW_SETTINGS, SETTINGS, billingRoutes } from '../../../test/billing';
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
        supplierLegalName: 'Omni Cloud Pvt Ltd',
        supplierAddress: '12 Residency Road, Bengaluru 560025',
        supplierStateCode: '29',
        supplierGstin: '29AAACO1234A1Z5',
        sacCode: '998314',
        gstRatePercent: 18,
        invoicePrefix: 'INV',
        creditNotePrefix: 'CN',
        quoteValidDays: 7,
        renewalWindowDays: 30,
        paymentInstructions: 'UPI omni@bank',
      }),
    );
    expect(await screen.findByText('Settings saved')).toBeVisible();
  });

  it('asks for the supplier details until they are complete', async () => {
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes({ 'GET /api/billing/settings': { status: 200, body: NEW_SETTINGS } }),
      'PUT /api/billing/settings': { status: 200, body: { ...SETTINGS, version: 0 } },
    });
    const { user } = renderApp('/platform/billing-settings');
    expect(await screen.findByText(/Fill in the supplier details: no order can be raised/)).toBeVisible();
    await fill(user, 'Legal name', 'Omni Cloud Pvt Ltd');
    await fill(user, 'Address', '12 Residency Road, Bengaluru 560025');
    await user.selectOptions(screen.getByLabelText(/^State/), '29');
    await fill(user, 'GSTIN', '29AAACO1234A1Z5');
    await fill(user, 'HSN/SAC code', '998314');
    await fill(user, 'Payment instructions', 'UPI omni@bank');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(requestTo(fetch, 'PUT /api/billing/settings')?.body).toMatchObject({
        supplierLegalName: 'Omni Cloud Pvt Ltd',
        supplierStateCode: '29',
        supplierGstin: '29AAACO1234A1Z5',
        sacCode: '998314',
        paymentInstructions: 'UPI omni@bank',
      }),
    );
    await waitFor(() => expect(screen.queryByText(/Fill in the supplier details/)).toBeNull());
  });

  it('does not save a blank rate or validity as 0', async () => {
    const fetch = mockFetch({ ...meAs(SUPER_ADMIN), ...billingRoutes() });
    const { user } = renderApp('/platform/billing-settings');
    await fill(user, 'GST rate', '');
    await fill(user, 'Quote valid days', '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter the GST rate in percent')).toBeVisible();
    expect(screen.getByText('Enter for how many days a quote stays valid')).toBeVisible();
    expect(requestTo(fetch, 'PUT /api/billing/settings')).toBeUndefined();
  });

  it('shows a refused GSTIN under its field', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes(),
      'PUT /api/billing/settings': {
        status: 400,
        body: { code: 'VALIDATION', fields: { supplierGstin: 'does not belong to the state chosen' } },
      },
    });
    const { user } = renderApp('/platform/billing-settings');
    await fill(user, 'GSTIN', '27AAACO1234A1Z5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('does not belong to the state chosen')).toBeVisible();
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

  it('does not save blank grace days as none', async () => {
    const fetch = mockFetch({ ...meAs(SUPER_ADMIN), ...billingRoutes() });
    const { user } = renderApp('/platform/billing-settings');
    await fill(user, 'Grace days', '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter the number of grace days (0 for none)')).toBeVisible();
    expect(requestTo(fetch, 'PUT /api/billing/settings')).toBeUndefined();
  });
});
