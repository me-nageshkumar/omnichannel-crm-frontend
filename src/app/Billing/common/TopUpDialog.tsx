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
import type { Order, Quote, QuoteRequest } from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { inr, typedAmount } from '@app/Billing/common/money';
import { QuotePanel } from '@app/Billing/common/QuotePanel';
import { useQuote } from '@app/Billing/common/useQuote';

const SHOWN = ['topUpAmount'];

/** The amount as a request can carry it: plain digits above zero, or null while the field says nothing usable. */
function amountOf(text: string): number | null {
  const n = typedAmount(text);
  return n !== null && n > 0 ? n : null;
}

/**
 * Adds money to a wallet: an amount, the server's price for it with tax, and the order that asks for it. The
 * wallet gets the amount when the order's payment is recorded. Used by staff and by the customer; each passes its
 * own way of pricing and raising.
 */
export const TopUpDialog: React.FunctionComponent<{
  zone: string;
  /** The least and the most the server takes, for the hint. */
  min: number;
  max: number;
  fetchQuote(token: string, request: QuoteRequest): Promise<Quote>;
  raise(token: string, request: QuoteRequest): Promise<Order>;
  sendLabel: string;
  /** Said under the price, e.g. when the request takes effect. */
  note?: string;
  /** Words a refusal; the default is the usual sentence for the error. */
  describe?(error: unknown): string;
  onRaised(order: Order): void;
  onCancel(): void;
}> = ({ zone, min, max, fetchQuote, raise, sendLabel, note, describe = messageFor, onRaised, onCancel }) => {
  const { token } = useSession();
  const [amount, setAmount] = React.useState('');
  const action = useAction(SHOWN);
  const value = amountOf(amount);
  const request: QuoteRequest | null = value === null ? null : { kind: 'TOPUP', topUpAmount: value };
  const priced = useQuote(request, fetchQuote);
  const refused =
    priced.problem instanceof ApiError && priced.problem.code === 'VALIDATION' ? (priced.problem.fields ?? {}) : {};
  // something is typed that cannot be read as an amount: say so, rather than sit silent with no price
  const unreadable =
    amount.trim() !== '' && value === null ? 'Enter the amount in digits, for example 1000' : undefined;
  const fieldError = unreadable ?? action.fieldErrors.topUpAmount ?? refused.topUpAmount;
  const unshown = Object.keys(refused)
    .filter((f) => SHOWN.indexOf(f) < 0)
    .map((f) => refused[f]);
  const quoteError =
    priced.problem === null
      ? null
      : unshown.length > 0
        ? unshown.join('; ')
        : Object.keys(refused).length > 0
          ? null
          : describe(priced.problem);

  const send = async () => {
    if (!request || !priced.matches) return;
    const body = request;
    const order = await action.run(() => raise(token as string, body), describe);
    if (order) onRaised(order);
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="top-up-title">
      <ModalHeader title="Top up the wallet" labelId="top-up-title" />
      <ModalBody>
        <Form
          id="top-up-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          <FormGroup label="Amount" isRequired fieldId="top-up-amount">
            <TextInput
              id="top-up-amount"
              inputMode="decimal"
              value={amount}
              validated={fieldError ? 'error' : 'default'}
              onChange={(_e, v) => setAmount(v)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={fieldError ? 'error' : 'default'}>
                  {fieldError ?? `Between ${inr(min)} and ${inr(max)}, before tax`}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <QuotePanel quote={priced.quote} pending={priced.pending} error={quoteError} zone={zone} />
          {note && <Alert variant="info" isInline isPlain title={note} />}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          type="submit"
          form="top-up-form"
          isDisabled={!priced.matches || action.busy}
          isLoading={action.busy}
        >
          {sendLabel}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
