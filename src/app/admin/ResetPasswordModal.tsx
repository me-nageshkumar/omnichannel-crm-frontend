import * as React from 'react';
import { Alert, Button, Form, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';
import { EMPTY_PERSON, PersonFields } from '@app/admin/PersonFields';
import { MIN_PASSWORD_LENGTH } from '@app/Login/NewPasswordPage';
import { useAction } from '@app/admin/useAction';
import type { WithTemporaryPassword } from '@app/api/users';

/** Asks for a new temporary password for {@code name}; hands the reply to {@code onDone}. */
export const ResetPasswordModal: React.FunctionComponent<{
  name: string;
  reset(temporaryPassword: string): Promise<WithTemporaryPassword>;
  onDone(reply: WithTemporaryPassword): void;
  onCancel(): void;
}> = ({ name, reset, onDone, onCancel }) => {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const action = useAction();

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`At least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setError(undefined);
    const reply = await action.run(() => reset(password));
    if (reply) onDone(reply);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="reset-title">
      <ModalHeader title={`Reset password for ${name}`} labelId="reset-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="reset-form" onSubmit={submit}>
          <TemporaryPasswordOnly value={password} onChange={setPassword} error={error} />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="reset-form" isDisabled={action.busy}>
          Reset password
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

/** Just the temporary-password field of {@link PersonFields}. */
const TemporaryPasswordOnly: React.FunctionComponent<{
  value: string;
  onChange(value: string): void;
  error?: string;
}> = ({ value, onChange, error }) => (
  <PersonFields
    mode="password"
    idPrefix="reset"
    values={{ ...EMPTY_PERSON, temporaryPassword: value }}
    onChange={(p) => onChange(p.temporaryPassword)}
    errors={error ? { temporaryPassword: error } : {}}
  />
);
