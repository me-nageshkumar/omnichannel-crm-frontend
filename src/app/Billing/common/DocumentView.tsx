import * as React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, Content, Flex, FlexItem, Grid, GridItem, Title } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { CreditNote, Invoice, Party } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { billingDate } from '@app/Billing/common/billingDate';
import { METHOD_LABEL } from '@app/Billing/common/orderText';
import { taxRows } from '@app/Billing/common/QuotePanel';

const money = (amount: number) => formatMoney(amount, 'INR');

const PartyBlock: React.FunctionComponent<{ label: string; party: Party }> = ({ label, party }) => (
  <div role="group" aria-label={label}>
    <Content component="small">{label}</Content>
    <div>
      <strong>{party.legalName}</strong>
    </div>
    {party.address && <div style={{ whiteSpace: 'pre-line' }}>{party.address}</div>}
    {party.stateCode && (
      <div>
        {party.stateCode}
        {party.stateName ? ` · ${party.stateName}` : ''}
      </div>
    )}
    <div>{party.gstin ? `GSTIN ${party.gstin}` : 'Not registered for GST'}</div>
  </div>
);

const Sum: React.FunctionComponent<{ label: string; strong?: boolean; children: React.ReactNode }> = ({
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

export type BillingDocument = { kind: 'invoice'; document: Invoice } | { kind: 'creditNote'; document: CreditNote };

/**
 * An invoice or a credit note as it was issued: both parties, the lines, the tax and the total, in figures and in
 * words. Every amount is the document's own. `invoiceLink` says where a credit note's invoice can be opened.
 */
export const DocumentView: React.FunctionComponent<
  BillingDocument & { zone: string; invoiceLink?(invoiceId: string): string }
> = (props) => {
  const { document: d, zone } = props;
  const title = props.kind === 'invoice' ? 'Tax invoice' : 'Credit note';
  const inv = props.kind === 'invoice' ? props.document : null;
  const note = props.kind === 'creditNote' ? props.document : null;
  return (
    <Card component="section" aria-label={`${title} ${d.number}`}>
      <CardBody>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <Title headingLevel="h2" size="xl">
              {title}
            </Title>
          </FlexItem>
          <FlexItem style={{ textAlign: 'right' }}>
            <div>
              <strong>{d.number}</strong>
            </div>
            <div>{billingDate(d.issuedAt, zone)}</div>
          </FlexItem>
        </Flex>
        <Grid hasGutter className="pf-v6-u-my-md">
          <GridItem md={6}>
            <PartyBlock label="From" party={d.supplier} />
          </GridItem>
          <GridItem md={6}>
            <PartyBlock label="Billed to" party={d.customer} />
          </GridItem>
        </Grid>
        {note && (
          <p>
            Against invoice{' '}
            {props.invoiceLink ? (
              <Link to={props.invoiceLink(note.invoiceId)}>{note.invoiceNumber}</Link>
            ) : (
              note.invoiceNumber
            )}{' '}
            of {billingDate(note.invoiceDate, zone)}
          </p>
        )}
        {note && note.reason && <p>Reason: {note.reason}</p>}
        <Table variant="compact" aria-label="Lines">
          <Thead>
            <Tr>
              <Th>Description</Th>
              <Th modifier="fitContent">Amount</Th>
            </Tr>
          </Thead>
          <Tbody>
            {d.lines.map((line, i) => (
              <Tr key={i}>
                <Td>{line.description}</Td>
                <Td modifier="fitContent" style={{ textAlign: 'right' }}>
                  {money(line.amount)}
                </Td>
              </Tr>
            ))}
            <Sum label="Taxable value">{money(d.taxable)}</Sum>
            {taxRows(d.tax).map((t) => (
              <Sum key={t.label} label={t.label}>
                {money(t.amount)}
              </Sum>
            ))}
            <Sum label="Total" strong>
              {money(d.total)}
            </Sum>
            {inv && inv.accountCreditUsed > 0 && <Sum label="Account credit used">{money(inv.accountCreditUsed)}</Sum>}
            {inv && inv.accountCreditUsed > 0 && <Sum label="Amount paid">{money(inv.amountPaid)}</Sum>}
            {inv && inv.credited > 0 && <Sum label="Credited back since">{money(inv.credited)}</Sum>}
          </Tbody>
        </Table>
        <p className="pf-v6-u-mt-sm">{d.totalInWords}</p>
        {inv && inv.sacCode && <Content component="small">HSN/SAC {inv.sacCode}</Content>}
        {inv && inv.payment && inv.payment.method !== 'NONE' && (
          <p>
            Paid by {METHOD_LABEL[inv.payment.method]}, reference {inv.payment.reference}
            {inv.payment.receivedOn ? `, received ${billingDate(inv.payment.receivedOn, 'UTC')}` : ''}
          </p>
        )}
        {note && <p>The total of this credit note was added to the account credit.</p>}
      </CardBody>
    </Card>
  );
};
