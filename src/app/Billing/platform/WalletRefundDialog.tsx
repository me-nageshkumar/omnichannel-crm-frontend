import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { type Order, quoteWalletRefund, refundWallet } from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { inr4, typedAmount } from '@app/Billing/common/money';
import { QuotePanel } from '@app/Billing/common/QuotePanel';
import { useQuote } from '@app/Billing/common/useQuote';

const FIELDS = ['amount', 'reason'];

/** Why the wallet cannot give that much back is the server's own sentence: it knows which limit was met. */
const describe = (e: unknown) =>
  e instanceof ApiError && e.code === 'NOT_ENOUGH_WALLET' && e.serverMessage ? e.serverMessage : messageFor(e);

/**
 * Takes top-up money back out of a wallet. The server works out the credit notes this issues against the top-up
 * invoices, with their tax; the total lands in the account credit, from where Record refund pays it out.
 */
export const WalletRefundDialog: React.FunctionComponent<{
  customerId: string;
  /** What the server says could come back, before tax. */
  refundable: number;
  zone: string;
  onDone(order: Order): void;
  onCancel(): void;
}> = ({ customerId, refundable, zone, onDone, onCancel }) => {
  const { token } = useSession();
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [missing, setMissing] = React.useState<Record<string, string>>({});
  const action = useAction(FIELDS);
  const read = typedAmount(amount);
  const value = read !== null && read > 0 ? read : null;
  const unreadable = amount.trim() !== '' && value === null ? 'Enter the amount in digits, for example 400' : undefined;
  const request = value === null ? null : { amount: value };
  const priced = useQuote<{ amount: number }>(request, (t, r) => quoteWalletRefund(t, customerId, r));
  const refused =
    priced.problem instanceof ApiError && priced.problem.code === 'VALIDATION' ? (priced.problem.fields ?? {}) : {};
  const quoteError = priced.problem === null || Object.keys(refused).length > 0 ? null : describe(priced.problem);

  const save = async () => {
    if (!request || !priced.matches) return;
    if (reason.trim() === '') {
      setMissing({ reason: 'Say why, for the record' });
      return;
    }
    setMissing({});
    const body = { amount: request.amount, reason: reason.trim() };
    const order = await action.run(() => refundWallet(token as string, customerId, body), describe);
    if (order) onDone(order);
  };
  const problem = (field: string, hint?: string) => {
    const text =
      (field === 'amount' ? unreadable : undefined) ?? missing[field] ?? action.fieldErrors[field] ?? refused[field];
    return text || hint ? (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={text ? 'error' : 'default'}>{text ?? hint}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    ) : null;
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="wallet-refund-title">
      <ModalHeader title="Refund wallet" labelId="wallet-refund-title" />
      <ModalBody>
        <Form
          id="wallet-refund-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          <p>Up to {inr4(refundable)} can be refunded: money that top-ups put in and messages have not used.</p>
          <FormGroup label="Amount" isRequired fieldId="wallet-refund-amount">
            <TextInput
              id="wallet-refund-amount"
              inputMode="decimal"
              value={amount}
              onChange={(_e, v) => setAmount(v)}
            />
            {problem('amount', 'Before tax; the tax paid on it comes back with it')}
          </FormGroup>
          <FormGroup label="Reason" isRequired fieldId="wallet-refund-reason">
            <TextInput id="wallet-refund-reason" value={reason} onChange={(_e, v) => setReason(v)} />
            {problem('reason')}
          </FormGroup>
          <QuotePanel quote={priced.quote} pending={priced.pending} error={quoteError} zone={zone} />
          <Alert
            variant="info"
            isInline
            isPlain
            title="The money goes to the account credit. Pay it out to the customer with Record refund."
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          type="submit"
          form="wallet-refund-form"
          isDisabled={!priced.matches || action.busy}
          isLoading={action.busy}
        >
          Refund wallet
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
