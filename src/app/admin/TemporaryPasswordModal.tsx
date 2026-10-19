import * as React from 'react';
import { Button, ClipboardCopy, Content, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';

/** Shows a temporary password once; the caller forgets it in {@code onClose}. */
export const TemporaryPasswordModal: React.FunctionComponent<{
  username: string;
  password: string;
  onClose(): void;
}> = ({ username, password, onClose }) => (
  <Modal isOpen variant="small" onClose={onClose} aria-labelledby="temporary-password-title">
    <ModalHeader title={`Temporary password for ${username}`} labelId="temporary-password-title" />
    <ModalBody>
      <ClipboardCopy isReadOnly hoverTip="Copy" clickTip="Copied">
        {password}
      </ClipboardCopy>
      <Content component="p" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        Share it with them securely. They must change it when they first log in. It won&apos;t be shown again.
      </Content>
    </ModalBody>
    <ModalFooter>
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    </ModalFooter>
  </Modal>
);
