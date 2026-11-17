import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { type Order, cancelOrder, getOrder, payOrder, rejectOrder } from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { useSession } from '@app/session/SessionContext';
import { billingDate } from '@app/Billing/common/billingDate';
import { KIND_LABEL, METHOD_LABEL } from '@app/Billing/common/orderText';
import { QuotePanel } from '@app/Billing/common/QuotePanel';
import { OrderStatusLabel } from '@app/Billing/platform/OrderStatusLabel';
import { RecordPaymentForm } from '@app/Billing/platform/RecordPaymentForm';

type Mode = 'view' | 'pay' | 'reject' | 'cancel';

/** A refusal that means the order is not what the screen shows any more. */
const CHANGED = ['ORDER_NOT_OPEN', 'ORDER_STALE', 'ORDER_EXPIRED'];
const changedUnder = (e: unknown) => e instanceof ApiError && !!e.code && CHANGED.indexOf(e.code) >= 0;

/**
 * One order: what it charges and credits, who raised it and what became of it. Whoever may manage subscriptions
 * records its payment here, or rejects or cancels it, while it waits.
 */
export const OrderDetailModal: React.FunctionComponent<{
  orderId: string;
  /** The billing zone, for the dates. */
  zone: string;
  /** The order changed, or turned out to have changed: lists that show it should load again. */
  onChanged(): void;
  onClose(): void;
}> = ({ orderId, zone, onChanged, onClose }) => {
  const { token } = useSession();
  const canManage = useAccess().has('subscription:manage');
  const loaded = useLoad((t) => getOrder(t, orderId), [orderId], { keepOnError: true });
  const [mode, setMode] = React.useState<Mode>('view');
  const [reason, setReason] = React.useState('');
  const [reasonMissing, setReasonMissing] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const action = useAction(['reason']);
  const o: Order | undefined = loaded.data;
  const open = !!o && o.status === 'REQUESTED';

  const settle = (changed: Order) => {
    loaded.setData(() => changed);
    setMode('view');
    setNotice(null);
    onChanged();
  };
  /** A refusal: if the order moved on under us, say so, show it as it is now and let the lists reload. */
  const refused = (e: unknown) => {
    if (!changedUnder(e)) return;
    setNotice(messageFor(e));
    setMode('view');
    loaded.reload();
    onChanged();
  };
  const run = async (call: () => Promise<Order>) => {
    setNotice(null);
    let failure: unknown = null;
    const done = await action.run(async () => {
      try {
        return await call();
      } catch (e) {
        failure = e;
        throw e;
      }
    });
    if (done) settle(done);
    else if (failure) refused(failure);
  };
  const onReject = () => {
    if (reason.trim() === '') {
      setReasonMissing(true);
      return;
    }
    setReasonMissing(false);
    if (action.busy) return;
    void run(() => rejectOrder(token as string, orderId, reason.trim()));
  };

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="order-detail-title">
      <ModalHeader title={o ? `Order ${o.number}` : 'Order'} labelId="order-detail-title" />
      <ModalBody>
        {loaded.error && <Alert variant="danger" isInline title={loaded.error} />}
        {notice && <Alert variant="warning" isInline title={notice} />}
        {action.error && !notice && <Alert variant="danger" isInline title={action.error} />}
        {!o && !loaded.error && <Spinner aria-label="Loading order" />}
        {o && (
          <>
            <DescriptionList isHorizontal isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>Customer</DescriptionListTerm>
                <DescriptionListDescription>
                  <Link to={`/customers/${o.customerId}`}>{o.customerName}</Link>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>What</DescriptionListTerm>
                <DescriptionListDescription>
                  <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <FlexItem>{KIND_LABEL[o.kind]}</FlexItem>
                    <FlexItem>
                      <OrderStatusLabel status={o.status} />
                    </FlexItem>
                  </Flex>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Raised</DescriptionListTerm>
                <DescriptionListDescription>
                  {o.raisedByName}
                  {o.raisedByStaff ? '' : ' (the customer)'}, {new Date(o.raisedAt).toLocaleString()}
                </DescriptionListDescription>
              </DescriptionListGroup>
              {o.reason && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Reason</DescriptionListTerm>
                  <DescriptionListDescription>{o.reason}</DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {o.extraDiscountReason && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Discount given because</DescriptionListTerm>
                  <DescriptionListDescription>{o.extraDiscountReason}</DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {o.rejectedReason && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Rejected because</DescriptionListTerm>
                  <DescriptionListDescription>{o.rejectedReason}</DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {o.payment && o.payment.method !== 'NONE' && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Payment</DescriptionListTerm>
                  <DescriptionListDescription>
                    {METHOD_LABEL[o.payment.method]}, {o.payment.reference}
                    {o.payment.receivedOn ? `, received ${billingDate(o.payment.receivedOn, 'UTC')}` : ''}, recorded by{' '}
                    {o.payment.recordedByName}
                    {o.payment.note ? ` (${o.payment.note})` : ''}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {o.payment && o.payment.method === 'NONE' && o.lines.length > 0 && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Payment</DescriptionListTerm>
                  <DescriptionListDescription>
                    Nothing to pay; approved by {o.payment.recordedByName}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {o.invoiceId && o.invoiceNumber && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Invoice</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Link to={`/platform/invoices/${o.invoiceId}`}>{o.invoiceNumber}</Link>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {o.creditNoteIds.length > 0 && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Credit notes</DescriptionListTerm>
                  <DescriptionListDescription>
                    {o.creditNoteIds.map((id, i) => {
                      const credit = o.credits.filter((c) => c.creditNoteId === id)[0];
                      return (
                        <React.Fragment key={id}>
                          {i > 0 && ', '}
                          <Link to={`/platform/credit-notes/${id}`}>
                            {credit ? `against ${credit.invoiceNumber}` : `credit note ${i + 1}`}
                          </Link>
                        </React.Fragment>
                      );
                    })}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>
            <QuotePanel quote={o} pending={false} error={null} zone={zone} />
            {mode === 'pay' && open && (
              <RecordPaymentForm order={o} onPaid={settle} onFailed={refused} onCancel={() => setMode('view')} />
            )}
            {mode === 'reject' && open && (
              <Form
                aria-label="Reject"
                onSubmit={(e) => {
                  e.preventDefault();
                  onReject();
                }}
              >
                <FormGroup label="Reason" isRequired fieldId="reject-reason">
                  <TextInput id="reject-reason" value={reason} onChange={(_e, v) => setReason(v)} />
                  {(reasonMissing || action.fieldErrors.reason) && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem variant="error">
                          {reasonMissing ? 'Say why the order is rejected' : action.fieldErrors.reason}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}
                </FormGroup>
              </Form>
            )}
            {mode === 'cancel' && open && (
              <Alert variant="warning" isInline isPlain title="Cancel this order? It cannot be brought back." />
            )}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {canManage && open && mode === 'view' && o && o.payable > 0 && (
          <Button variant="primary" onClick={() => setMode('pay')}>
            Record payment
          </Button>
        )}
        {canManage && open && mode === 'view' && o && o.payable === 0 && (
          <Button
            variant="primary"
            isDisabled={action.busy}
            onClick={() => void run(() => payOrder(token as string, orderId, { method: 'NONE' }))}
          >
            Approve
          </Button>
        )}
        {canManage && open && mode === 'view' && (
          <Button variant="secondary" onClick={() => setMode('reject')}>
            Reject
          </Button>
        )}
        {canManage && open && mode === 'view' && (
          <Button variant="link" isDanger onClick={() => setMode('cancel')}>
            Cancel order
          </Button>
        )}
        {mode === 'reject' && open && (
          <Button variant="danger" isDisabled={action.busy} onClick={onReject}>
            Reject order
          </Button>
        )}
        {mode === 'cancel' && open && (
          <Button
            variant="danger"
            isDisabled={action.busy}
            onClick={() => void run(() => cancelOrder(token as string, orderId))}
          >
            Yes, cancel it
          </Button>
        )}
        {(mode === 'reject' || mode === 'cancel') && (
          <Button variant="link" onClick={() => setMode('view')}>
            Back
          </Button>
        )}
        {mode === 'view' && (
          <Button variant={canManage && open ? 'link' : 'primary'} onClick={onClose}>
            Close
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
