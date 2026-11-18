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
import { type Wallet, setWalletThreshold } from '@app/api/billing';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';

const FIELDS = ['lowBalanceAt'];

/** Sets the balance below which the customer's people are told the wallet is low; an empty field removes it. */
export const WalletThresholdDialog: React.FunctionComponent<{
  customerId: string;
  current: number | null;
  onDone(wallet: Wallet): void;
  onCancel(): void;
}> = ({ customerId, current, onDone, onCancel }) => {
  const { token } = useSession();
  const [level, setLevel] = React.useState(current === null ? '' : String(current));
  const [missing, setMissing] = React.useState<string | null>(null);
  const action = useAction(FIELDS);

  const save = async () => {
    const blank = level.trim() === '';
    if (!blank && !Number.isFinite(Number(level))) {
      setMissing('Enter an amount, or leave it empty for no warning');
      return;
    }
    setMissing(null);
    // an empty field is no warning, never a warning at zero
    const wallet = await action.run(() =>
      setWalletThreshold(token as string, customerId, blank ? null : Number(level)),
    );
    if (wallet) onDone(wallet);
  };
  const error = missing ?? action.fieldErrors.lowBalanceAt;

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="wallet-threshold-title">
      <ModalHeader title="Low-balance warning" labelId="wallet-threshold-title" />
      <ModalBody>
        <Form
          id="wallet-threshold-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          <FormGroup label="Warn below" fieldId="wallet-threshold-level">
            <TextInput
              id="wallet-threshold-level"
              inputMode="decimal"
              value={level}
              onChange={(_e, v) => setLevel(v)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={error ? 'error' : 'default'}>
                  {error ?? 'In rupees. Leave it empty for no warning.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="wallet-threshold-form" isDisabled={action.busy}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
