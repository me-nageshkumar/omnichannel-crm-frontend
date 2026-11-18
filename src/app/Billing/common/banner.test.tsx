import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, BRAND_A, CUSTOMER_ADMIN, WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { summaryIn } from '../../../test/billing';
import { fill } from '../../../test/admin';

const brands = { 'GET /api/workspaces': { status: 200, body: [{ id: 'w1', name: 'Brand A' }] } };
const banner = () => screen.queryByRole('region', { name: 'Plan notice' });

describe('the plan banner', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('tells the admin to renew during grace, with a way to the billing page', async () => {
    mockFetch({ ...meAs({ ...CUSTOMER_ADMIN, subscription: summaryIn('GRACE') }), ...brands });
    renderApp('/brands');
    const notice = await screen.findByRole('region', { name: 'Plan notice' });
    expect(
      within(notice).getByText(/Your plan ended on 31 Dec 2026\. Renew by 7 Jan 2027 to keep working\./),
    ).toBeVisible();
    expect(within(notice).getByRole('link', { name: 'Plan & billing' })).toHaveAttribute('href', '/billing');
  });

  it('tells everyone else to ask their administrator', async () => {
    mockFetch({ ...meAs({ ...WORKSPACE_MANAGER, subscription: summaryIn('EXPIRED') }) });
    renderApp('/profile');
    const notice = await screen.findByRole('region', { name: 'Plan notice' });
    expect(
      within(notice).getByText(/Your plan has ended\. The account is read-only until it is renewed\./),
    ).toBeVisible();
    expect(within(notice).getByText(/Ask your administrator\./)).toBeVisible();
    expect(within(notice).queryByRole('link')).toBeNull();
  });

  it('is absent while the plan runs, without a plan, and for platform staff', async () => {
    mockFetch({ ...meAs({ ...CUSTOMER_ADMIN, subscription: summaryIn('ACTIVE') }), ...brands });
    renderApp('/brands');
    await screen.findByRole('button', { name: 'Add brand' });
    expect(banner()).toBeNull();
    vi.unstubAllGlobals();

    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      'GET /api/customers': { status: 200, body: { items: [], total: 0, page: 0 } },
    });
    renderApp('/customers');
    await screen.findAllByRole('button', { name: 'Add customer' });
    expect(banner()).toBeNull();
  });

  it('shows a customer without a plan as read-only when the platform says so', async () => {
    mockFetch({
      ...meAs({
        ...CUSTOMER_ADMIN,
        subscription: { ...summaryIn('NONE'), planName: null, termEnd: null, graceEnd: null, readOnly: true },
      }),
      ...brands,
    });
    renderApp('/brands');
    const notice = await screen.findByRole('region', { name: 'Plan notice' });
    expect(within(notice).getByText(/The account has no plan and is read-only\./)).toBeVisible();
  });

  it('appears when the server says the plan has ended while someone works', async () => {
    let expired = false;
    const fetch = mockFetch({
      'GET /api/users/me': () => ({
        status: 200,
        body: { ...CUSTOMER_ADMIN, subscription: summaryIn(expired ? 'EXPIRED' : 'ACTIVE') },
      }),
      ...brands,
      'POST /api/workspaces': () => {
        expired = true;
        return { status: 402, body: { code: 'SUBSCRIPTION_EXPIRED', message: 'The subscription has ended' } };
      },
    });
    const { user } = renderApp('/brands');
    await user.click(await screen.findByRole('button', { name: 'Add brand' }));
    expect(banner()).toBeNull();
    await fill(user, 'Name', 'Brand C');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('Your plan has ended, so nothing can be changed until it is renewed.'),
    ).toBeVisible();
    // the dialog is still open, so the page behind it is hidden from assistive technology
    expect(await screen.findByRole('region', { name: 'Plan notice', hidden: true })).toBeInTheDocument();
    // a second refusal right after does not ask again
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(callsTo(fetch, 'POST /api/workspaces')).toBe(2));
    expect(callsTo(fetch, 'GET /api/users/me')).toBe(2);
  });

  it('leaves out the pages of a feature the plan lacks', async () => {
    const small = { ...BRAND_A, authorities: ['inbox:view', 'user:view'] };
    mockFetch({
      ...meAs({ ...CUSTOMER_ADMIN, workspaces: [small], subscription: summaryIn('ACTIVE') }),
      'GET /api/workspaces/w1/users': { status: 200, body: [] },
    });
    renderApp('/campaigns');
    expect(await screen.findByText(/404/)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'All campaigns' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Campaigns' })).toBeNull();
  });

  it('warns that the wallet is low, with a way to top up for those who may', async () => {
    mockFetch({ ...meAs({ ...CUSTOMER_ADMIN, subscription: { ...summaryIn('ACTIVE'), lowWallet: true } }), ...brands });
    renderApp('/brands');
    const notice = await screen.findByRole('region', { name: 'Wallet notice' });
    expect(
      within(notice).getByText(/Your wallet balance is low\. Messages stop sending when it runs out\./),
    ).toBeVisible();
    expect(within(notice).getByRole('link', { name: 'Top up' })).toHaveAttribute('href', '/billing');
    expect(banner()).toBeNull();
  });

  it('tells those who cannot top up to ask, and stands under the plan notice', async () => {
    mockFetch({ ...meAs({ ...WORKSPACE_MANAGER, subscription: { ...summaryIn('GRACE'), lowWallet: true } }) });
    renderApp('/profile');
    const wallet = await screen.findByRole('region', { name: 'Wallet notice' });
    expect(within(wallet).getByText(/Ask your administrator\./)).toBeVisible();
    expect(within(wallet).queryByRole('link')).toBeNull();
    const plan = screen.getByRole('region', { name: 'Plan notice' });
    // the plan's notice comes first
    expect(plan.compareDocumentPosition(wallet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says nothing about the wallet while it is not low', async () => {
    mockFetch({ ...meAs({ ...CUSTOMER_ADMIN, subscription: summaryIn('GRACE') }), ...brands });
    renderApp('/brands');
    await screen.findByRole('region', { name: 'Plan notice' });
    expect(screen.queryByRole('region', { name: 'Wallet notice' })).toBeNull();
  });
});
