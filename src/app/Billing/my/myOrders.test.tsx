import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { type MockRoute, mockFetch, requestTo } from '../../../test/fetchMock';
import { CUSTOMER_ADMIN, meAs, storeSession } from '../../../test/session';
import {
  NO_PROFILE,
  OPTIONS,
  PROFILE,
  creditNote,
  invoice,
  myBillingRoutes,
  order,
  paidOrder,
  quote,
  refund,
  subscription,
  summaryIn,
  upgradeQuote,
} from '../../../test/billing';
import { fill, urlsOf } from '../../../test/admin';
import { saveBlob } from '@app/Billing/common/download';

vi.mock('@app/Billing/common/download', () => ({ saveBlob: vi.fn() }));

const crmOff = { 'GET /api/workspaces/w1/crm/status': { status: 402, body: { code: 'CRM_NOT_ENABLED' } } };
const QUOTES = 'POST /api/my/billing/quotes';
const ORDERS = 'POST /api/my/billing/orders';
const MINE = order({ raisedByStaff: false, raisedByName: 'Ravi Owner', kind: 'ADDON' });

function routes(over: Record<string, MockRoute> = {}, state: 'ACTIVE' | 'EXPIRED' = 'ACTIVE', me = CUSTOMER_ADMIN) {
  return {
    ...meAs({ ...me, subscription: summaryIn(state) }),
    ...crmOff,
    ...myBillingRoutes({
      [QUOTES]: { status: 200, body: upgradeQuote() },
      [ORDERS]: { status: 201, body: order({ kind: 'UPGRADE', raisedByStaff: false }) },
      ...over,
    }),
  };
}

describe('what a customer can ask for', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    vi.mocked(saveBlob).mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('upgrades to a higher plan at the price the server quotes', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/billing');
    const plan = await screen.findByRole('region', { name: 'Your plan' });
    await user.click(await within(plan).findByRole('button', { name: 'Upgrade' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('option', { name: 'Platinum · Monthly · ₹1,500' })).toBeInTheDocument();
    // the only plan above is chosen already
    const panel = within(dialog).getByRole('region', { name: 'Price' });
    expect(
      await within(panel).findByText('Credit for unused time on INV/26-27/000001', {}, { timeout: 3000 }),
    ).toBeVisible();
    expect(
      within(within(panel).getByText('Amount payable').closest('tr') as HTMLElement).getByText('₹1,039.16'),
    ).toBeVisible();
    expect(requestTo(fetch, QUOTES)?.body).toEqual({ kind: 'UPGRADE', planCode: 'platinum-monthly' });

    await user.click(within(dialog).getByRole('button', { name: 'Send request' }));
    await waitFor(() =>
      expect(requestTo(fetch, ORDERS)?.body).toEqual({ kind: 'UPGRADE', planCode: 'platinum-monthly' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/my/billing/orders')).toHaveLength(2));
  });

  it('buys an add-on, and extra units in steps', async () => {
    const fetch = mockFetch(routes({ [QUOTES]: { status: 200, body: quote({ kind: 'ADDON' }) } }));
    const { user } = renderApp('/billing');
    const offers = await screen.findByRole('region', { name: 'Add-ons you can buy' });
    const automations = (await within(offers).findByText('Automations')).closest('tr') as HTMLElement;
    expect(within(automations).getByText('₹300 for a full term')).toBeVisible();
    await user.click(within(automations).getByRole('button', { name: 'Buy' }));
    let dialog = await screen.findByRole('dialog');
    await waitFor(
      () =>
        expect(requestTo(fetch, QUOTES)?.body).toEqual({
          kind: 'ADDON',
          addOn: { kind: 'GROUP', groupCode: 'automations' },
        }),
      { timeout: 3000 },
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    const users = within(offers).getByText('Extra users').closest('tr') as HTMLElement;
    expect(within(users).getByText('₹100 per 5 for a full term')).toBeVisible();
    await user.click(within(users).getByRole('button', { name: 'Buy' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Send request' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^How many more/), '10');
    await waitFor(
      () => {
        const asked = urlsOf(fetch, QUOTES).length;
        expect(requestTo(fetch, QUOTES, asked - 1)?.body).toEqual({
          kind: 'ADDON',
          addOn: { kind: 'LIMIT', limitKey: 'USERS', quantity: 10 },
        });
      },
      { timeout: 3000 },
    );
  });

  it('says when a renewal opens, and renews when it is open', async () => {
    mockFetch(
      routes({
        'GET /api/my/billing/options': {
          status: 200,
          body: { ...OPTIONS, renewal: { allowed: false, reason: 'Renewal opens on 2 Dec 2026', from: '2026-12-02' } },
        },
      }),
    );
    const first = renderApp('/billing');
    let plan = await screen.findByRole('region', { name: 'Your plan' });
    expect(await within(plan).findByRole('button', { name: 'Renew' })).toBeDisabled();
    expect(within(plan).getByText('Renewal opens on 2 Dec 2026')).toBeVisible();
    first.unmount();

    vi.unstubAllGlobals();
    const fetch = mockFetch(routes({ [QUOTES]: { status: 200, body: quote({ kind: 'RENEWAL' }) } }));
    const second = renderApp('/billing');
    plan = await screen.findByRole('region', { name: 'Your plan' });
    await second.user.click(await within(plan).findByRole('button', { name: 'Renew' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('checkbox', { name: /Automations/ })).toBeChecked();
    await waitFor(() => expect(requestTo(fetch, QUOTES)?.body).toEqual({ kind: 'RENEWAL', keepAddOnIds: ['a1'] }), {
      timeout: 3000,
    });
  });

  it('shows an open request with how to pay, and lets its own be cancelled', async () => {
    const staffs = order({ id: 'o2', number: 'ORD-000002' });
    const fetch = mockFetch(
      routes({
        'GET /api/my/billing/orders': {
          status: 200,
          body: [
            MINE,
            staffs,
            order({ id: 'o3', number: 'ORD-000003', status: 'REJECTED', rejectedReason: 'Wrong plan' }),
          ],
        },
        'POST /api/my/billing/orders/o1/cancel': { status: 200, body: { ...MINE, status: 'CANCELLED' } },
      }),
    );
    const { user } = renderApp('/billing');
    const requests = await screen.findByRole('region', { name: 'Requests' });
    const mine = (await within(requests).findByText('ORD-000001')).closest('li') as HTMLElement;
    expect(within(mine).getByText(/Amount payable ₹1,062, valid until 8 Dec 2026/)).toBeVisible();
    expect(within(mine).getByText('How to pay')).toBeVisible();
    expect(within(mine).getByText('UPI omni@bank')).toBeVisible();
    const theirs = within(requests).getByText('ORD-000002').closest('li') as HTMLElement;
    expect(within(theirs).queryByRole('button', { name: 'Cancel request' })).toBeNull();
    const rejected = within(requests).getByText('ORD-000003').closest('tr') as HTMLElement;
    expect(within(rejected).getByText('Rejected: Wrong plan')).toBeVisible();

    await user.click(within(mine).getByRole('button', { name: 'Cancel request' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, cancel it' }));
    await waitFor(() => expect(urlsOf(fetch, 'POST /api/my/billing/orders/o1/cancel')).toHaveLength(1));
    await waitFor(() => expect(urlsOf(fetch, 'GET /api/my/billing/orders')).toHaveLength(2));
  });

  it('lists its documents and downloads an invoice from its own side', async () => {
    const fetch = mockFetch(
      routes({
        'GET /api/my/billing/subscription': { status: 200, body: subscription({ creditBalance: 82.71 }) },
        'GET /api/my/billing/orders': { status: 200, body: [paidOrder()] },
        'GET /api/my/billing/invoices': { status: 200, body: [invoice()] },
        'GET /api/my/billing/credit-notes': { status: 200, body: [creditNote()] },
        'GET /api/my/billing/refunds': { status: 200, body: [refund()] },
        'GET /api/my/billing/invoices/i1': { status: 200, body: invoice() },
        'GET /api/my/billing/invoices/i1/pdf': new Response(new Blob(['%PDF-1.7']), { status: 200 }),
      }),
    );
    const { user } = renderApp('/billing');
    const plan = await screen.findByRole('region', { name: 'Your plan' });
    expect(await within(plan).findByText('₹82.71')).toBeVisible();
    const documents = await screen.findByRole('region', { name: 'Invoices and credit' });
    const link = await within(documents).findByRole('link', { name: 'INV/26-27/000001' });
    expect(link).toHaveAttribute('href', '/billing/invoices/i1');
    await user.click(within(documents).getByRole('tab', { name: 'Credit notes' }));
    expect(await within(documents).findByRole('link', { name: 'CN/26-27/000001' })).toHaveAttribute(
      'href',
      '/billing/credit-notes/n1',
    );
    await user.click(within(documents).getByRole('tab', { name: 'Refunds' }));
    expect(await within(documents).findByText('RF-000001')).toBeVisible();

    await user.click(within(documents).getByRole('tab', { name: 'Invoices' }));
    await user.click(await within(documents).findByRole('link', { name: 'INV/26-27/000001' }));
    expect(await screen.findByRole('region', { name: 'Tax invoice INV/26-27/000001' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    expect(urlsOf(fetch, 'GET /api/my/billing/invoices/i1/pdf')).toHaveLength(1);
  });

  it('keeps its billing details, which stay put while a request waits', async () => {
    const fetch = mockFetch(
      routes({
        'GET /api/my/billing/profile': { status: 200, body: NO_PROFILE },
        'PUT /api/my/billing/profile': { status: 200, body: PROFILE },
      }),
    );
    const first = renderApp('/billing');
    let card = await screen.findByRole('region', { name: 'Billing details' });
    expect(await within(card).findByText('Fill in your billing details before sending a request.')).toBeVisible();
    await first.user.click(within(card).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    await fill(first.user, 'Legal name', 'Acme Retail Pvt Ltd');
    await fill(first.user, 'Address', '1 MG Road, Bengaluru 560001');
    await first.user.selectOptions(within(dialog).getByLabelText(/^State/), '29');
    await first.user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(requestTo(fetch, 'PUT /api/my/billing/profile')?.body).toEqual({
        legalName: 'Acme Retail Pvt Ltd',
        address: '1 MG Road, Bengaluru 560001',
        stateCode: '29',
        gstin: '',
      }),
    );
    expect(await within(card).findByText('Acme Retail Pvt Ltd')).toBeVisible();
    first.unmount();

    vi.unstubAllGlobals();
    mockFetch(routes({ 'GET /api/my/billing/orders': { status: 200, body: [MINE] } }));
    renderApp('/billing');
    card = await screen.findByRole('region', { name: 'Billing details' });
    expect(await within(card).findByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(within(card).getByText(/cannot be changed while a request waits for payment/)).toBeVisible();
  });

  it('can still renew when the plan has run out, and nothing else', async () => {
    const fetch = mockFetch(
      routes(
        {
          'GET /api/my/billing/subscription': { status: 200, body: subscription({ state: 'EXPIRED', readOnly: true }) },
          [QUOTES]: { status: 200, body: quote({ kind: 'RENEWAL' }) },
          [ORDERS]: { status: 201, body: order({ kind: 'RENEWAL', raisedByStaff: false }) },
        },
        'EXPIRED',
      ),
    );
    const { user } = renderApp('/billing');
    const plan = await screen.findByRole('region', { name: 'Your plan' });
    await user.click(await within(plan).findByRole('button', { name: 'Renew' }));
    expect(within(plan).queryByRole('button', { name: 'Upgrade' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Add-ons you can buy' })).toBeNull();
    const dialog = await screen.findByRole('dialog');
    const send = within(dialog).getByRole('button', { name: 'Send request' });
    await waitFor(() => expect(send).toBeEnabled(), { timeout: 3000 });
    await user.click(send);
    await waitFor(() => expect(requestTo(fetch, ORDERS)?.body).toEqual({ kind: 'RENEWAL', keepAddOnIds: ['a1'] }));
  });

  it('shows everything and offers nothing to someone who may only look', async () => {
    const viewer = {
      ...CUSTOMER_ADMIN,
      authorities: CUSTOMER_ADMIN.authorities.filter((a) => a !== 'billing:request'),
    };
    mockFetch(routes({ 'GET /api/my/billing/orders': { status: 200, body: [MINE] } }, 'ACTIVE', viewer));
    renderApp('/billing');
    const plan = await screen.findByRole('region', { name: 'Your plan' });
    expect(await within(plan).findByText('Gold')).toBeVisible();
    const requests = await screen.findByRole('region', { name: 'Requests' });
    expect(await within(requests).findByText('ORD-000001')).toBeVisible();
    expect(await screen.findByText('Automations', { selector: 'td' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Renew' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upgrade' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Buy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('says what is missing when a request cannot be priced yet', async () => {
    mockFetch(
      routes({
        [QUOTES]: {
          status: 409,
          body: { code: 'BILLING_NOT_SET_UP', message: 'x', missing: 'customer billing profile' },
        },
      }),
    );
    const { user } = renderApp('/billing');
    const plan = await screen.findByRole('region', { name: 'Your plan' });
    await user.click(await within(plan).findByRole('button', { name: 'Upgrade' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText(
        'Fill in your billing details on this page before sending a request.',
        {},
        { timeout: 3000 },
      ),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Send request' })).toBeDisabled();
  });
});
