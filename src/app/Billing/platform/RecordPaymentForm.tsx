import * as React from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextInput,
} from '@patternfly/react-core';
import { type Order, type PaymentMethod, payOrder } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { METHODS, METHOD_LABEL, todayHere } from '@app/Billing/common/orderText';

const FIELDS = ['method', 'reference', 'receivedOn', 'note'];

/**
 * Records that an order was paid, which puts it into effect. The amount is the order's own; staff say how it came
 * in. {@code onFailed} hears a refusal that means the order changed under the form (paid by someone else, stale,
 * expired), so the caller can look at it again.
 */
export const RecordPaymentForm: React.FunctionComponent<{
  order: Order;
  onPaid(order: Order): void;
  onFailed(error: unknown): void;
  onCancel(): void;
}> = ({ order, onPaid, onFailed, onCancel }) => {
  const { token } = useSession();
  const [method, setMethod] = React.useState<PaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = React.useState('');
  const [receivedOn, setReceivedOn] = React.useState(todayHere);
  const [note, setNote] = React.useState('');
  const [missing, setMissing] = React.useState<Record<string, string>>({});
  const action = useAction(FIELDS);

  const save = async () => {
    const problems: Record<string, string> = {};
    if (reference.trim() === '') problems.reference = 'Enter the payment reference';
    if (receivedOn === '') problems.receivedOn = 'Enter the day the money was received';
    setMissing(problems);
    if (Object.keys(problems).length > 0) return;
    let failure: unknown = null;
    const paid = await action.run(async () => {
      try {
        return await payOrder(token as string, order.id, {
          method,
          reference: reference.trim(),
          receivedOn,
          note: note.trim(),
        });
      } catch (e) {
        failure = e;
        throw e;
      }
    });
    if (paid) onPaid(paid);
    else if (failure) onFailed(failure);
  };
  const problem = (field: string) => {
    const text = missing[field] ?? action.fieldErrors[field];
    return text ? (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant="error">{text}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    ) : null;
  };

  return (
    <Form
      aria-label="Record payment"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {action.error && <Alert variant="danger" isInline title={action.error} />}
      <FormGroup label="Paid by" isRequired fieldId="pay-method">
        <FormSelect id="pay-method" value={method} onChange={(_e, v) => setMethod(v as PaymentMethod)}>
          {METHODS.map((m) => (
            <FormSelectOption key={m} value={m} label={METHOD_LABEL[m]} />
          ))}
        </FormSelect>
        {problem('method')}
      </FormGroup>
      <FormGroup label="Reference" isRequired fieldId="pay-reference">
        <TextInput id="pay-reference" value={reference} onChange={(_e, v) => setReference(v)} />
        {problem('reference') ?? (
          <FormHelperText>
            <HelperText>
              <HelperTextItem>The UTR, cheque number or receipt number; it is printed on the invoice</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
      <FormGroup label="Received on" isRequired fieldId="pay-received">
        <TextInput id="pay-received" type="date" value={receivedOn} onChange={(_e, v) => setReceivedOn(v)} />
        {problem('receivedOn')}
      </FormGroup>
      <FormGroup label="Note" fieldId="pay-note">
        <TextInput id="pay-note" value={note} onChange={(_e, v) => setNote(v)} />
        {problem('note')}
      </FormGroup>
      <ActionGroup>
        <Button variant="primary" type="submit" isDisabled={action.busy} isLoading={action.busy}>
          Save payment
        </Button>
        <Button variant="link" onClick={onCancel}>
          Back
        </Button>
        <span>{formatMoney(order.payable, 'INR')} received</span>
      </ActionGroup>
    </Form>
  );
};
