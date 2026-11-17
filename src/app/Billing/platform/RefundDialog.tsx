import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { type PaymentMethod, type Refund, recordRefund } from '@app/api/billing';
import { formatMoney } from '@app/Crm/common/money';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { METHODS, METHOD_LABEL, todayHere } from '@app/Billing/common/orderText';

const FIELDS = ['amount', 'method', 'reference', 'paidOn', 'note'];

/**
 * Records account credit that was paid back to the customer. The money moved outside this system; this takes it
 * off the balance. The amount is sent as typed: whether the balance covers it is the server's answer.
 */
export const RefundDialog: React.FunctionComponent<{
  customerId: string;
  creditBalance: number;
  onDone(refund: Refund): void;
  onCancel(): void;
}> = ({ customerId, creditBalance, onDone, onCancel }) => {
  const { token } = useSession();
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = React.useState('');
  const [paidOn, setPaidOn] = React.useState(todayHere);
  const [note, setNote] = React.useState('');
  const [missing, setMissing] = React.useState<Record<string, string>>({});
  const action = useAction(FIELDS);

  const save = async () => {
    const problems: Record<string, string> = {};
    if (amount.trim() === '' || Number.isNaN(Number(amount))) problems.amount = 'Enter the amount that was paid back';
    if (reference.trim() === '') problems.reference = 'Enter the payment reference';
    if (paidOn === '') problems.paidOn = 'Enter the day it was paid';
    setMissing(problems);
    if (Object.keys(problems).length > 0) return;
    const refund = await action.run(() =>
      recordRefund(token as string, customerId, {
        amount: Number(amount),
        method,
        reference: reference.trim(),
        paidOn,
        note: note.trim(),
      }),
    );
    if (refund) onDone(refund);
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
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="refund-dialog-title">
      <ModalHeader title="Record refund" labelId="refund-dialog-title" />
      <ModalBody>
        <Form
          id="refund-dialog-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          <p>Account credit {formatMoney(creditBalance, 'INR')}</p>
          <FormGroup label="Amount" isRequired fieldId="refund-amount">
            <TextInput id="refund-amount" type="number" value={amount} onChange={(_e, v) => setAmount(v)} />
            {problem('amount')}
          </FormGroup>
          <FormGroup label="Paid by" isRequired fieldId="refund-method">
            <FormSelect id="refund-method" value={method} onChange={(_e, v) => setMethod(v as PaymentMethod)}>
              {METHODS.map((m) => (
                <FormSelectOption key={m} value={m} label={METHOD_LABEL[m]} />
              ))}
            </FormSelect>
            {problem('method')}
          </FormGroup>
          <FormGroup label="Reference" isRequired fieldId="refund-reference">
            <TextInput id="refund-reference" value={reference} onChange={(_e, v) => setReference(v)} />
            {problem('reference')}
          </FormGroup>
          <FormGroup label="Paid on" isRequired fieldId="refund-paid-on">
            <TextInput id="refund-paid-on" type="date" value={paidOn} onChange={(_e, v) => setPaidOn(v)} />
            {problem('paidOn')}
          </FormGroup>
          <FormGroup label="Note" fieldId="refund-note">
            <TextInput id="refund-note" value={note} onChange={(_e, v) => setNote(v)} />
            {problem('note')}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="refund-dialog-form" isDisabled={action.busy}>
          Record refund
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
