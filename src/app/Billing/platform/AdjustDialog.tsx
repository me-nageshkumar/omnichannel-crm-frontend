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
import { type Order, type Subscription, adjust } from '@app/api/billing';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { localDateIn, shiftDay } from '@app/Billing/common/billingDate';

const FIELDS = ['termEnd', 'creditAmount', 'reason'];

/**
 * What staff change by hand, always with a reason: the last day of the term, or the account credit. The credit
 * amount is sent as it was typed; a negative one takes credit away.
 */
export const AdjustDialog: React.FunctionComponent<{
  customerId: string;
  subscription: Subscription;
  mode: 'termEnd' | 'credit';
  onDone(order: Order): void;
  onCancel(): void;
}> = ({ customerId, subscription, mode, onDone, onCancel }) => {
  const { token } = useSession();
  // a term's end is stored as the day after its last day; people think of the last day
  const [lastDay, setLastDay] = React.useState(() =>
    subscription.termEnd ? shiftDay(localDateIn(subscription.termEnd, subscription.zone), -1) : '',
  );
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [missing, setMissing] = React.useState<Record<string, string>>({});
  const action = useAction(FIELDS);

  const save = async () => {
    const problems: Record<string, string> = {};
    if (mode === 'termEnd' && lastDay === '') problems.termEnd = 'Enter the new last day';
    if (mode === 'credit' && (amount.trim() === '' || Number.isNaN(Number(amount)))) {
      problems.creditAmount = 'Enter an amount';
    }
    if (reason.trim() === '') problems.reason = 'Say why';
    setMissing(problems);
    if (Object.keys(problems).length > 0) return;
    const order = await action.run(() =>
      adjust(
        token as string,
        customerId,
        mode === 'termEnd'
          ? { termEnd: shiftDay(lastDay, 1), reason: reason.trim() }
          : { creditAmount: Number(amount), reason: reason.trim() },
      ),
    );
    if (order) onDone(order);
  };
  const problem = (field: string, hint?: string) => {
    const text = missing[field] ?? action.fieldErrors[field];
    return text || hint ? (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={text ? 'error' : 'default'}>{text ?? hint}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    ) : null;
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="adjust-dialog-title">
      <ModalHeader title={mode === 'termEnd' ? 'Extend term' : 'Post account credit'} labelId="adjust-dialog-title" />
      <ModalBody>
        <Form
          id="adjust-dialog-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          {mode === 'termEnd' ? (
            <FormGroup label="New last day" isRequired fieldId="adjust-last-day">
              <TextInput id="adjust-last-day" type="date" value={lastDay} onChange={(_e, v) => setLastDay(v)} />
              {problem(
                'termEnd',
                'Nothing is charged or credited. Requests that wait for payment go out of date and must be raised again.',
              )}
            </FormGroup>
          ) : (
            <FormGroup label="Amount" isRequired fieldId="adjust-amount">
              <TextInput id="adjust-amount" type="number" value={amount} onChange={(_e, v) => setAmount(v)} />
              {problem('creditAmount', 'In rupees, tax included. A negative amount takes credit away.')}
            </FormGroup>
          )}
          <FormGroup label="Reason" isRequired fieldId="adjust-reason">
            <TextInput id="adjust-reason" value={reason} onChange={(_e, v) => setReason(v)} />
            {problem('reason')}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="adjust-dialog-form" isDisabled={action.busy}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
