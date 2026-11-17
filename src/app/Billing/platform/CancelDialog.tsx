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
import { type CancelInput, type Order, cancelSubscriptionPart, quoteCancellation } from '@app/api/billing';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { QuotePanel } from '@app/Billing/common/QuotePanel';
import { useQuote } from '@app/Billing/common/useQuote';

const FIELDS = ['creditTaxable', 'reason'];

/**
 * Cancels one add-on, or with none named the plan itself. The credit shown is what the server would give back:
 * the unused days, or the taxable amount staff type instead. The cancellation posted is the one that was priced.
 */
export const CancelDialog: React.FunctionComponent<{
  customerId: string;
  zone: string;
  /** The add-on to cancel; null cancels the plan. */
  addOn: { id: string; label: string } | null;
  onDone(order: Order): void;
  onCancel(): void;
}> = ({ customerId, zone, addOn, onDone, onCancel }) => {
  const { token } = useSession();
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [reasonMissing, setReasonMissing] = React.useState(false);
  const action = useAction(FIELDS);

  const typed = amount.trim();
  const badAmount = typed !== '' && Number.isNaN(Number(typed));
  const request: CancelInput | null = badAmount
    ? null
    : typed === ''
      ? { addOnId: addOn ? addOn.id : null }
      : { addOnId: addOn ? addOn.id : null, creditTaxable: Number(typed) };
  const priced = useQuote<CancelInput>(request, (t, r) => quoteCancellation(t, customerId, r));
  const refused =
    priced.problem instanceof ApiError && priced.problem.code === 'VALIDATION' ? (priced.problem.fields ?? {}) : {};
  const amountProblem = badAmount ? 'Enter a number' : (refused.creditTaxable ?? action.fieldErrors.creditTaxable);
  const others = Object.keys(refused)
    .filter((f) => f !== 'creditTaxable')
    .map((f) => refused[f]);
  const quoteError =
    priced.problem === null
      ? null
      : others.length > 0
        ? others.join('; ')
        : refused.creditTaxable
          ? null
          : messageFor(priced.problem);

  const confirm = async () => {
    if (!request || !priced.matches) return;
    if (reason.trim() === '') {
      setReasonMissing(true);
      return;
    }
    setReasonMissing(false);
    const order = await action.run(() =>
      cancelSubscriptionPart(token as string, customerId, { ...request, reason: reason.trim() }),
    );
    if (order) onDone(order);
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="cancel-dialog-title">
      <ModalHeader
        title={addOn ? `Cancel add-on: ${addOn.label}` : 'Cancel plan'}
        labelId="cancel-dialog-title"
        titleIconVariant="warning"
      />
      <ModalBody>
        <Form
          id="cancel-dialog-form"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          {!addOn && (
            <Alert
              variant="danger"
              isInline
              isPlain
              title="The plan ends today and the customer becomes read-only at once, with no grace days. A renewal that was paid for is dropped."
            />
          )}
          <QuotePanel quote={priced.quote} pending={priced.pending} error={quoteError} zone={zone} />
          <FormGroup label="Credit a different taxable amount" fieldId="cancel-credit">
            <TextInput id="cancel-credit" type="number" value={amount} onChange={(_e, v) => setAmount(v)} />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={amountProblem ? 'error' : 'default'}>
                  {amountProblem ??
                    'Leave empty to credit the unused days. An amount here is before tax, up to what was paid; 0 gives no credit.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <FormGroup label="Reason" isRequired fieldId="cancel-reason">
            <TextInput id="cancel-reason" value={reason} onChange={(_e, v) => setReason(v)} />
            {(reasonMissing || action.fieldErrors.reason) && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    {reasonMissing ? 'Say why' : action.fieldErrors.reason}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="danger"
          type="submit"
          form="cancel-dialog-form"
          isDisabled={!priced.matches || action.busy}
          isLoading={action.busy}
        >
          {addOn ? 'Cancel the add-on' : 'Cancel the plan'}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Keep it
        </Button>
      </ModalFooter>
    </Modal>
  );
};
