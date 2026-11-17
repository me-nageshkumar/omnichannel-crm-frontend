import * as React from 'react';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { Refund } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { billingDate } from '@app/Billing/common/billingDate';
import { METHOD_LABEL } from '@app/Billing/common/orderText';

const STATUS: Record<Refund['status'], string> = {
  RECORDING: 'Being recorded',
  RECORDED: 'Paid',
  FAILED: 'Failed: not enough credit',
};

/** Account credit paid back to the customer, newest first. */
export const RefundsTable: React.FunctionComponent<{ refunds: Refund[] }> = ({ refunds }) => {
  // a customer is not told which member of staff recorded it
  const named = refunds.some((r) => !!r.recordedByName);
  return refunds.length === 0 ? (
    <p>No refunds yet.</p>
  ) : (
    <Table aria-label="Refunds" variant="compact">
      <Thead>
        <Tr>
          <Th>Number</Th>
          <Th>Amount</Th>
          <Th>Paid by</Th>
          <Th>Reference</Th>
          <Th>Paid on</Th>
          {named && <Th>Recorded by</Th>}
          <Th>Status</Th>
        </Tr>
      </Thead>
      <Tbody>
        {refunds.map((r) => (
          <Tr key={r.id}>
            <Td dataLabel="Number">{r.number}</Td>
            <Td dataLabel="Amount">{formatMoney(r.amount, 'INR')}</Td>
            <Td dataLabel="Paid by">{METHOD_LABEL[r.method]}</Td>
            <Td dataLabel="Reference">{r.reference}</Td>
            <Td dataLabel="Paid on">{billingDate(r.paidOn, 'UTC')}</Td>
            {named && <Td dataLabel="Recorded by">{r.recordedByName}</Td>}
            <Td dataLabel="Status">{STATUS[r.status]}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};
