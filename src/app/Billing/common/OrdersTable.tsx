import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { Order } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { KIND_LABEL } from '@app/Billing/common/orderText';
import { OrderStatusLabel } from '@app/Billing/platform/OrderStatusLabel';

/** A customer's orders, newest first; a number opens the order. */
export const OrdersTable: React.FunctionComponent<{ orders: Order[]; onOpen(order: Order): void }> = ({
  orders,
  onOpen,
}) =>
  orders.length === 0 ? (
    <p>No orders yet.</p>
  ) : (
    <Table aria-label="Orders" variant="compact">
      <Thead>
        <Tr>
          <Th>Number</Th>
          <Th>Kind</Th>
          <Th>Amount payable</Th>
          <Th>Raised</Th>
          <Th>Status</Th>
        </Tr>
      </Thead>
      <Tbody>
        {orders.map((o) => (
          <Tr key={o.id}>
            <Td dataLabel="Number">
              <Button variant="link" isInline onClick={() => onOpen(o)}>
                {o.number}
              </Button>
            </Td>
            <Td dataLabel="Kind">{KIND_LABEL[o.kind]}</Td>
            <Td dataLabel="Amount payable">{formatMoney(o.payable, 'INR')}</Td>
            <Td dataLabel="Raised">
              {o.raisedByName}, {new Date(o.raisedAt).toLocaleDateString()}
            </Td>
            <Td dataLabel="Status">
              <OrderStatusLabel status={o.status} />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
