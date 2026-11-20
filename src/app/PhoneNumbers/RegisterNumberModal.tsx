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
import { PhoneNumber, registerCloudNumber, shown } from '@app/api/phoneNumbers';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';

/** Registers a Cloud number with Meta using its 6-digit two-step PIN; the PIN is not kept. */
export const RegisterNumberModal: React.FunctionComponent<{
  number: PhoneNumber;
  onSaved(saved: PhoneNumber): void;
  onCancel(): void;
}> = ({ number, onSaved, onCancel }) => {
  const { token, workspace } = useSession();
  const [pin, setPin] = React.useState('');
  const action = useAction(['pin']);
  const valid = /^\d{6}$/.test(pin);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!valid) return;
    const result = await action.run(() => registerCloudNumber(token as string, workspace?.id ?? '', number.id, pin));
    if (result !== undefined) onSaved(result);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="register-number-title">
      <ModalHeader title={`Register ${shown(number.number)}`} labelId="register-number-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="register-number-form" onSubmit={onSubmit}>
          <FormGroup label="Two-step PIN" fieldId="register-number-pin" isRequired>
            <TextInput
              id="register-number-pin"
              inputMode="numeric"
              value={pin}
              onChange={(_e, v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
              validated={action.fieldErrors.pin ? 'error' : 'default'}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={action.fieldErrors.pin ? 'error' : 'default'}>
                  {action.fieldErrors.pin ??
                    'Six digits. If the number has no PIN yet, this becomes its PIN. It is not stored here.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="register-number-form" isDisabled={!valid || action.busy} isLoading={action.busy}>
          Register
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
