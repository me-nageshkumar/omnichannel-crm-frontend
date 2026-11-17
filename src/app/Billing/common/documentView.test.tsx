import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, meAs, storeSession } from '../../../test/session';
import { billingRoutes, creditNote, invoice } from '../../../test/billing';
import { saveBlob } from '@app/Billing/common/download';

vi.mock('@app/Billing/common/download', () => ({ saveBlob: vi.fn() }));

const PDF = 'GET /api/billing/invoices/i1/pdf';

describe('an invoice and a credit note', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    vi.mocked(saveBlob).mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows everything a tax invoice says', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      'GET /api/billing/invoices/i1': { status: 200, body: invoice() },
    });
    renderApp('/platform/invoices/i1');
    const doc = await screen.findByRole('region', { name: 'Tax invoice INV/26-27/000001' });
    expect(within(doc).getByText('1 Dec 2026')).toBeVisible();
    const from = within(doc).getByRole('group', { name: 'From' });
    expect(within(from).getByText('Omni Cloud Pvt Ltd')).toBeVisible();
    expect(within(from).getByText('12 Residency Road, Bengaluru 560025')).toBeVisible();
    expect(within(from).getByText('29 · Karnataka')).toBeVisible();
    expect(within(from).getByText('GSTIN 29AAACO1234A1Z5')).toBeVisible();
    const to = within(doc).getByRole('group', { name: 'Billed to' });
    expect(within(to).getByText('Acme Retail Pvt Ltd')).toBeVisible();
    expect(within(to).getByText('Not registered for GST')).toBeVisible();

    const row = (label: string) => within(doc).getByText(label).closest('tr') as HTMLElement;
    expect(within(row('Gold, monthly (1 Dec 2026 – 31 Dec 2026)')).getByText('₹900')).toBeVisible();
    expect(within(row('Taxable value')).getByText('₹900')).toBeVisible();
    expect(within(row('CGST 9%')).getByText('₹81')).toBeVisible();
    expect(within(row('SGST 9%')).getByText('₹81')).toBeVisible();
    expect(within(row('Total')).getByText('₹1,062')).toBeVisible();
    expect(within(doc).getByText('Rupees One Thousand Sixty-Two Only')).toBeVisible();
    expect(within(doc).getByText('HSN/SAC 998314')).toBeVisible();
    expect(within(doc).getByText(/Paid by UPI, reference UTR-778899/)).toBeVisible();
    expect(within(doc).queryByText('Account credit used')).toBeNull();
  });

  it('shows IGST only for another state, and the account credit that was used', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      'GET /api/billing/invoices/i1': {
        status: 200,
        body: invoice({
          tax: { ratePercent: 18, cgst: 0, sgst: 0, igst: 162, interState: true },
          accountCreditUsed: 500,
          amountPaid: 562,
        }),
      },
    });
    renderApp('/platform/invoices/i1');
    const doc = await screen.findByRole('region', { name: 'Tax invoice INV/26-27/000001' });
    const row = (label: string) => within(doc).getByText(label).closest('tr') as HTMLElement;
    expect(within(row('IGST 18%')).getByText('₹162')).toBeVisible();
    expect(within(doc).queryByText(/CGST/)).toBeNull();
    expect(within(row('Account credit used')).getByText('₹500')).toBeVisible();
    expect(within(row('Amount paid')).getByText('₹562')).toBeVisible();
  });

  it('names the invoice a credit note is against', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      'GET /api/billing/credit-notes/n1': { status: 200, body: creditNote() },
    });
    renderApp('/platform/credit-notes/n1');
    const doc = await screen.findByRole('region', { name: 'Credit note CN/26-27/000001' });
    expect(within(doc).getByText('16 Dec 2026')).toBeVisible();
    // the number in the sentence is a link, so the sentence is read as a whole
    expect(
      within(doc).getByText(
        (_text, el) => el?.tagName === 'P' && el.textContent === 'Against invoice INV/26-27/000001 of 1 Dec 2026',
      ),
    ).toBeVisible();
    expect(within(doc).getByRole('link', { name: 'INV/26-27/000001' })).toHaveAttribute(
      'href',
      '/platform/invoices/i1',
    );
    expect(within(doc).getByText('Reason: Unused time on upgrade')).toBeVisible();
    const row = (label: string) => within(doc).getByText(label).closest('tr') as HTMLElement;
    expect(within(row('Total')).getByText('₹548.13')).toBeVisible();
    expect(within(row('CGST 9%')).getByText('₹41.81')).toBeVisible();
  });

  it('downloads the PDF under the name of the document', async () => {
    const fetch = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      'GET /api/billing/invoices/i1': { status: 200, body: invoice() },
      [PDF]: new Response(new Blob(['%PDF-1.7']), { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
    });
    const { user } = renderApp('/platform/invoices/i1');
    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveBlob).mock.calls[0][1]).toBe('INV-26-27-000001.pdf');
    expect(requestTo(fetch, PDF)?.headers.get('Authorization')).toBe('Bearer stored-token');
  });

  it('says so beside the button when the PDF cannot be had', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      'GET /api/billing/invoices/i1': { status: 200, body: invoice() },
      [PDF]: { status: 404, body: { code: 'NOT_FOUND', message: 'invoice not found' } },
    });
    const { user } = renderApp('/platform/invoices/i1');
    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByText("That item no longer exists or you can't see it.")).toBeVisible();
    expect(saveBlob).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  });
});
