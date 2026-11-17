import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardBody, CardTitle, Content, List, ListItem } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { type Order, cancelMyOrder } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { billingDate } from '@app/Billing/common/billingDate';
import { KIND_LABEL, STATUS_LABEL } from '@app/Billing/common/orderText';

/** What a row says became of a request that is no longer open. */
const outcome = (o: Order) =>
  o.status === 'REJECTED' && o.rejectedReason ? `Rejected: ${o.rejectedReason}` : STATUS_LABEL[o.status];

/**
 * The customer's requests. One that waits for payment says how much, until when, and how to pay; the rest are a
 * short history with their invoices.
 */
export const MyRequests: React.FunctionComponent<{
  orders: Order[];
  zone: string;
  paymentInstructions: string | null;
  canRequest: boolean;
  onChanged(): void;
}> = ({ orders, zone, paymentInstructions, canRequest, onChanged }) => {
  const { token } = useSession();
  const [cancelling, setCancelling] = React.useState<Order | null>(null);
  const action = useAction();
  const open = orders.filter((o) => o.status === 'REQUESTED');
  const closed = orders.filter((o) => o.status !== 'REQUESTED');

  const cancel = async () => {
    if (!cancelling) return;
    const id = cancelling.id;
    const done = await action.run(() => cancelMyOrder(token as string, id));
    // whether it was cancelled or had moved on already, the list is out of date now
    setCancelling(done ? null : cancelling);
    onChanged();
  };

  return (
    <Card component="section" aria-label="Requests">
      <CardTitle>Requests</CardTitle>
      <CardBody>
        {orders.length === 0 && <p>No requests yet.</p>}
        {open.length > 0 && (
          <List isPlain isBordered>
            {open.map((o) => (
              <ListItem key={o.id}>
                <div>
                  <strong>{o.number}</strong> · {KIND_LABEL[o.kind]}
                  {o.lines.length > 0 ? ` · ${o.lines[0].description}` : ''}
                </div>
                <div>
                  Amount payable {formatMoney(o.payable, 'INR')}
                  {o.validUntil ? `, valid until ${billingDate(o.validUntil, zone)}` : ''}
                </div>
                {paymentInstructions && (
                  <>
                    <Content component="small">How to pay</Content>
                    <div style={{ whiteSpace: 'pre-line' }}>{paymentInstructions}</div>
                  </>
                )}
                <Content component="small">It takes effect when your payment is recorded.</Content>
                {canRequest && !o.raisedByStaff && (
                  <div>
                    <Button
                      variant="link"
                      isInline
                      isDanger
                      onClick={() => {
                        action.reset();
                        setCancelling(o);
                      }}
                    >
                      Cancel request
                    </Button>
                  </div>
                )}
              </ListItem>
            ))}
          </List>
        )}
        {closed.length > 0 && (
          <Table aria-label="Earlier requests" variant="compact">
            <Thead>
              <Tr>
                <Th>Number</Th>
                <Th>What</Th>
                <Th>Date</Th>
                <Th>Outcome</Th>
                <Th>Invoice</Th>
              </Tr>
            </Thead>
            <Tbody>
              {closed.map((o) => (
                <Tr key={o.id}>
                  <Td dataLabel="Number">{o.number}</Td>
                  <Td dataLabel="What">{KIND_LABEL[o.kind]}</Td>
                  <Td dataLabel="Date">{billingDate(o.raisedAt, zone)}</Td>
                  <Td dataLabel="Outcome">{outcome(o)}</Td>
                  <Td dataLabel="Invoice">
                    {o.invoiceId && o.invoiceNumber && (
                      <Link to={`/billing/invoices/${o.invoiceId}`}>{o.invoiceNumber}</Link>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </CardBody>
      {cancelling && (
        <ConfirmModal
          title={`Cancel request ${cancelling.number}?`}
          confirmLabel="Yes, cancel it"
          variant="danger"
          busy={action.busy}
          error={action.error}
          onConfirm={() => void cancel()}
          onCancel={() => setCancelling(null)}
        >
          Nothing was charged. You can send the request again later.
        </ConfirmModal>
      )}
    </Card>
  );
};
