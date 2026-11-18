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
import { type Wallet, adjustWallet } from '@app/api/billing';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { inr4, typedAmount } from '@app/Billing/common/money';

const FIELDS = ['amount', 'note'];

/**
 * Adds money to a wallet, or with a minus sign takes it out, for a reason that is kept. An adjustment carries no
 * tax and cannot be refunded. The amount is sent as typed: whether the wallet covers it is the server's answer.
 */
export const WalletAdjustDialog: React.FunctionComponent<{
  customerId: string;
  balance: number;
  onDone(wallet: Wallet): void;
  onCancel(): void;
}> = ({ customerId, balance, onDone, onCancel }) => {
  const { token } = useSession();
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [missing, setMissing] = React.useState<Record<string, string>>({});
  const action = useAction(FIELDS);

  const save = async () => {
    const problems: Record<string, string> = {};
    const value = typedAmount(amount, true);
    if (value === null || value === 0) {
      problems.amount = 'Enter an amount; a minus sign takes it out of the wallet';
    }
    if (note.trim() === '') problems.note = 'Say why, for the record';
    setMissing(problems);
    if (value === null || Object.keys(problems).length > 0) return;
    const wallet = await action.run(() =>
      adjustWallet(token as string, customerId, { amount: value, note: note.trim() }),
    );
    if (wallet) onDone(wallet);
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
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="wallet-adjust-title">
      <ModalHeader title="Adjust wallet" labelId="wallet-adjust-title" />
      <ModalBody>
        <Form
          id="wallet-adjust-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          <p>The wallet holds {inr4(balance)}.</p>
          <FormGroup label="Amount" isRequired fieldId="wallet-adjust-amount">
            <TextInput
              id="wallet-adjust-amount"
              inputMode="decimal"
              value={amount}
              onChange={(_e, v) => setAmount(v)}
            />
            {problem('amount', 'Up to 4 decimals. No tax is charged, and an adjustment cannot be refunded.')}
          </FormGroup>
          <FormGroup label="Note" isRequired fieldId="wallet-adjust-note">
            <TextInput id="wallet-adjust-note" value={note} onChange={(_e, v) => setNote(v)} />
            {problem('note')}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="wallet-adjust-form" isDisabled={action.busy}>
          Adjust
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
