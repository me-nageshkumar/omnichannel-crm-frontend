import * as React from 'react';
import { Alert, Content, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Tr } from '@patternfly/react-table';
import type { Quote, Tax } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { billingDate } from '@app/Billing/common/billingDate';

const money = (amount: number) => formatMoney(amount, 'INR');

/** "9%" from a rate: the label of half of GST, never an amount. */
const percent = (rate: number) => `${rate}%`;

/** The tax rows of a quote or a document: CGST and SGST within the state, IGST across states. */
export const taxRows = (tax: Tax): { label: string; amount: number }[] =>
  tax.interState
    ? [{ label: `IGST ${percent(tax.ratePercent)}`, amount: tax.igst }]
    : [
        { label: `CGST ${percent(tax.ratePercent / 2)}`, amount: tax.cgst },
        { label: `SGST ${percent(tax.ratePercent / 2)}`, amount: tax.sgst },
      ];

const Row: React.FunctionComponent<{ label: React.ReactNode; strong?: boolean; children: React.ReactNode }> = ({
  label,
  strong,
  children,
}) => (
  <Tr>
    <Td>{strong ? <strong>{label}</strong> : label}</Td>
    <Td modifier="fitContent" style={{ textAlign: 'right' }}>
      {strong ? <strong>{children}</strong> : children}
    </Td>
  </Tr>
);

/**
 * What a request costs, as the server worked it out: the charges, the tax, the credit it gives back and what is
 * left to pay. Every figure is a field of the quote; nothing is added up here. While a price is being asked for, no
 * figures are shown: those on screen always belong to the request on screen.
 */
export const QuotePanel: React.FunctionComponent<{
  /** A quote, or an order (which also says what an adjustment did). */
  quote: (Quote & { creditPosting?: number | null; newTermEnd?: string | null }) | null;
  pending: boolean;
  error: string | null;
  /** The billing zone, for the term's dates. */
  zone: string;
}> = ({ quote, pending, error, zone }) => {
  const charges = quote !== null && quote.lines.length > 0;
  // an adjustment charges and credits nothing through notes: it says what it posted or moved
  const adjustment = quote !== null && quote.kind === 'ADJUST';
  return (
    <section aria-label="Price" aria-busy={pending}>
      {error && <Alert variant="danger" isInline isPlain title={error} />}
      {pending && (
        <Content component="small">
          <Spinner size="sm" aria-label="Working out the price" /> Working out the price…
        </Content>
      )}
      {!pending && !error && !quote && <Content component="small">Fill in the form to see the price.</Content>}
      {quote && !pending && (
        <>
          <Table variant="compact" borders={false} aria-label="Price breakdown">
            <Tbody>
              {quote.lines.map((line, i) => (
                <Row key={i} label={line.description}>
                  {line.listAmount !== line.amount && (
                    <>
                      <s>{money(line.listAmount)}</s>{' '}
                    </>
                  )}
                  <span>{money(line.amount)}</span>
                </Row>
              ))}
              {quote.extraDiscountPercent > 0 && (
                <Tr>
                  <Td colSpan={2}>Extra discount {quote.extraDiscountPercent}%</Td>
                </Tr>
              )}
              {charges && <Row label="Taxable value">{money(quote.taxable)}</Row>}
              {charges &&
                taxRows(quote.tax).map((t) => (
                  <Row key={t.label} label={t.label}>
                    {money(t.amount)}
                  </Row>
                ))}
              {charges && (
                <Row label="Total" strong>
                  {money(quote.total)}
                </Row>
              )}
              {quote.credits.length > 0 && (
                <Tr>
                  <Td colSpan={2}>
                    <small>Credit notes this issues, added to the account credit</small>
                  </Td>
                </Tr>
              )}
              {quote.credits.map((c) => (
                <Row key={c.creditNoteId} label={`Credit for unused time on ${c.invoiceNumber}`}>
                  {money(c.total)}
                </Row>
              ))}
              {!charges && !adjustment && (
                <Row label="Credit to the account" strong>
                  {money(quote.creditFromNotes)}
                </Row>
              )}
              {typeof quote.creditPosting === 'number' && (
                <Row label="Account credit posted" strong>
                  {money(quote.creditPosting)}
                </Row>
              )}
              {quote.newTermEnd && (
                <Row label="Last day of the term moved to" strong>
                  {billingDate(quote.newTermEnd, zone, 1)}
                </Row>
              )}
              {charges && quote.accountCreditUsed > 0 && (
                <Row label="Account credit set against this order">{money(quote.accountCreditUsed)}</Row>
              )}
              {charges && (
                <Row label="Amount payable" strong>
                  {money(quote.payable)}
                </Row>
              )}
            </Tbody>
          </Table>
          {charges && quote.termStart && quote.termEnd && (
            <Content component="small">
              Term: {billingDate(quote.termStart, zone)} – {billingDate(quote.termEnd, zone, 1)}
            </Content>
          )}
          {charges && quote.validUntil && (
            <Content component="small">Valid until {billingDate(quote.validUntil, zone)}</Content>
          )}
        </>
      )}
    </section>
  );
};
