import * as React from 'react';
import { Alert, Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';

/** A yes/no question before a change; shows the action's error inline. */
export const ConfirmModal: React.FunctionComponent<{
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  variant?: 'primary' | 'danger';
  busy?: boolean;
  error?: string | null;
  onConfirm(): void;
  onCancel(): void;
}> = ({ title, children, confirmLabel, variant = 'primary', busy, error, onConfirm, onCancel }) => (
  <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="confirm-title">
    <ModalHeader
      title={title}
      labelId="confirm-title"
      titleIconVariant={variant === 'danger' ? 'warning' : undefined}
    />
    <ModalBody>
      {error && <Alert variant="danger" isInline isPlain title={error} />}
      {children}
    </ModalBody>
    <ModalFooter>
      <Button variant={variant} onClick={onConfirm} isDisabled={busy} isLoading={busy}>
        {confirmLabel}
      </Button>
      <Button variant="link" onClick={onCancel}>
        Cancel
      </Button>
    </ModalFooter>
  </Modal>
);
