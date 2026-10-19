import * as React from 'react';
import { Button, Form, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { disableTwoFactor } from '@app/api/users';
import { useSession } from '@app/session/SessionContext';
import { CodeField } from '@app/Profile/CodeField';

export const DisableTwoFactorModal: React.FunctionComponent<{ onDone(): void; onClose(): void }> = ({
  onDone,
  onClose,
}) => {
  const { token, refreshUser } = useSession();
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await disableTwoFactor(token, code.trim());
      await refreshUser();
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'TWO_FACTOR_STATE') {
        await refreshUser().catch(() => undefined);
        onClose();
        return;
      }
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal variant="small" isOpen onClose={onClose} aria-labelledby="disable-2fa-title">
      <ModalHeader title="Disable two-factor authentication" labelId="disable-2fa-title" />
      <ModalBody>
        <Form id="disable-2fa-form" onSubmit={onSubmit}>
          <CodeField id="disable-otp" value={code} onChange={setCode} error={error} />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="danger" type="submit" form="disable-2fa-form" isDisabled={busy || code.trim().length === 0}>
          Disable
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
