import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QuotePanel } from '@app/Billing/common/QuotePanel';
import { interStateQuote, quote, upgradeQuote } from '../../../test/billing';

const row = (panel: HTMLElement, label: string) => within(panel).getByText(label).closest('tr') as HTMLElement;

describe('the quote panel', () => {
  it('shows a new plan with its discount, tax and term', () => {
    render(<QuotePanel quote={quote()} pending={false} error={null} zone="Asia/Kolkata" />);
    const panel = screen.getByRole('region', { name: 'Price' });
    const line = row(panel, 'Gold, monthly (1 Dec 2026 – 31 Dec 2026)');
    expect(within(line).getByText('₹1,000').tagName).toBe('S');
    expect(within(line).getByText('₹900')).toBeVisible();
    expect(within(row(panel, 'Taxable value')).getByText('₹900')).toBeVisible();
    expect(within(row(panel, 'CGST 9%')).getByText('₹81')).toBeVisible();
    expect(within(row(panel, 'SGST 9%')).getByText('₹81')).toBeVisible();
    expect(within(row(panel, 'Total')).getByText('₹1,062')).toBeVisible();
    expect(within(row(panel, 'Amount payable')).getByText('₹1,062')).toBeVisible();
    expect(within(panel).queryByText(/IGST/)).toBeNull();
    expect(within(panel).queryByText(/Account credit used/)).toBeNull();
    expect(within(panel).getByText('Term: 1 Dec 2026 – 31 Dec 2026')).toBeVisible();
    expect(within(panel).getByText('Valid until 8 Dec 2026')).toBeVisible();
  });

  it('shows IGST for a customer in another state', () => {
    render(<QuotePanel quote={interStateQuote()} pending={false} error={null} zone="Asia/Kolkata" />);
    const panel = screen.getByRole('region', { name: 'Price' });
    expect(within(row(panel, 'IGST 18%')).getByText('₹162')).toBeVisible();
    expect(within(panel).queryByText(/CGST/)).toBeNull();
    expect(within(panel).queryByText(/SGST/)).toBeNull();
  });

  it('shows the credit an upgrade gives and what is left to pay', () => {
    render(<QuotePanel quote={upgradeQuote()} pending={false} error={null} zone="Asia/Kolkata" />);
    const panel = screen.getByRole('region', { name: 'Price' });
    expect(within(row(panel, 'Total')).getByText('₹1,770')).toBeVisible();
    expect(within(row(panel, 'Credit for unused time on INV/2026-27/000001')).getByText('₹548.13')).toBeVisible();
    expect(within(row(panel, 'Credit for unused time on INV/2026-27/000002')).getByText('₹182.71')).toBeVisible();
    expect(within(row(panel, 'Account credit used')).getByText('₹730.84')).toBeVisible();
    expect(within(row(panel, 'Amount payable')).getByText('₹1,039.16')).toBeVisible();
    expect(within(panel).getByText('Term: 16 Dec 2026 – 15 Jan 2027')).toBeVisible();
  });

  it('shows an extra discount, and only the credit for a cancellation', () => {
    const { rerender } = render(
      <QuotePanel quote={quote({ extraDiscountPercent: 50 })} pending={false} error={null} zone="Asia/Kolkata" />,
    );
    expect(screen.getByText('Extra discount 50%')).toBeVisible();
    rerender(
      <QuotePanel
        quote={upgradeQuote({ kind: 'CANCEL_ADDON', lines: [], total: 0, payable: 0, accountCreditUsed: 0 })}
        pending={false}
        error={null}
        zone="Asia/Kolkata"
      />,
    );
    const panel = screen.getByRole('region', { name: 'Price' });
    expect(within(row(panel, 'Credit to the account')).getByText('₹730.84')).toBeVisible();
    expect(within(panel).queryByText('Amount payable')).toBeNull();
    expect(within(panel).queryByText('Total')).toBeNull();
  });

  it('shows no figures while a price is being worked out, and says what went wrong', () => {
    const { rerender } = render(<QuotePanel quote={null} pending error={null} zone="Asia/Kolkata" />);
    expect(screen.getByText('Working out the price…')).toBeVisible();
    expect(screen.queryByText('Amount payable')).toBeNull();
    rerender(<QuotePanel quote={null} pending={false} error="The plan is no longer sold" zone="Asia/Kolkata" />);
    expect(screen.getByText('The plan is no longer sold')).toBeVisible();
    rerender(<QuotePanel quote={null} pending={false} error={null} zone="Asia/Kolkata" />);
    expect(screen.getByText('Fill in the form to see the price.')).toBeVisible();
  });
});
