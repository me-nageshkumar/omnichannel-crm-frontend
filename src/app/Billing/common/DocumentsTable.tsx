import * as React from 'react';
import { Link } from 'react-router-dom';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { CreditNote, Invoice, Tax } from '@app/api/billing';
import { billingDate } from '@app/Billing/common/billingDate';
import { inr } from '@app/Billing/common/money';

const money = inr;

/** The tax of a document in one cell, as its parts: the console does not add them up. */
const taxText = (tax: Tax) =>
  tax.interState ? `IGST ${money(tax.igst)}` : `CGST ${money(tax.cgst)} + SGST ${money(tax.sgst)}`;

type Props =
  | { kind: 'invoice'; documents: Invoice[]; zone: string; linkTo(id: string): string }
  | { kind: 'creditNote'; documents: CreditNote[]; zone: string; linkTo(id: string): string };

/** Invoices or credit notes, newest first; a number opens the document. */
export const DocumentsTable: React.FunctionComponent<Props> = (props) => {
  const { zone, linkTo } = props;
  if (props.documents.length === 0) {
    return <p>{props.kind === 'invoice' ? 'No invoices yet.' : 'No credit notes yet.'}</p>;
  }
  return (
    <Table aria-label={props.kind === 'invoice' ? 'Invoices' : 'Credit notes'} variant="compact">
      <Thead>
        <Tr>
          <Th>Number</Th>
          <Th>Date</Th>
          {props.kind === 'creditNote' && <Th>Against</Th>}
          <Th>Taxable</Th>
          <Th>Tax</Th>
          <Th>Total</Th>
          {props.kind === 'invoice' && <Th>Credited</Th>}
        </Tr>
      </Thead>
      <Tbody>
        {props.kind === 'invoice'
          ? props.documents.map((d) => (
              <Tr key={d.id}>
                <Td dataLabel="Number">
                  <Link to={linkTo(d.id)}>{d.number}</Link>
                </Td>
                <Td dataLabel="Date">{billingDate(d.issuedAt, zone)}</Td>
                <Td dataLabel="Taxable">{money(d.taxable)}</Td>
                <Td dataLabel="Tax">{taxText(d.tax)}</Td>
                <Td dataLabel="Total">{money(d.total)}</Td>
                <Td dataLabel="Credited">{d.credited > 0 ? money(d.credited) : ''}</Td>
              </Tr>
            ))
          : props.documents.map((d) => (
              <Tr key={d.id}>
                <Td dataLabel="Number">
                  <Link to={linkTo(d.id)}>{d.number}</Link>
                </Td>
                <Td dataLabel="Date">{billingDate(d.issuedAt, zone)}</Td>
                <Td dataLabel="Against">{d.invoiceNumber}</Td>
                <Td dataLabel="Taxable">{money(d.taxable)}</Td>
                <Td dataLabel="Tax">{taxText(d.tax)}</Td>
                <Td dataLabel="Total">{money(d.total)}</Td>
              </Tr>
            ))}
      </Tbody>
    </Table>
  );
};
