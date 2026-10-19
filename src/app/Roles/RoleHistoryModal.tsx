import * as React from 'react';
import {
  Alert,
  Button,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@patternfly/react-core';
import { Role, RoleChange, roleChanges } from '@app/api/roles';
import { roleLabel } from '@app/api/users';
import { useLoad } from '@app/admin/useLoad';

function describe(c: RoleChange): string {
  const parts = [new Date(c.at).toLocaleString(), c.changedBy];
  if (c.action !== 'UPDATED') parts.push(c.action.toLowerCase());
  if (c.added.length) parts.push(`added ${c.added.join(', ')}`);
  if (c.removed.length) parts.push(`removed ${c.removed.join(', ')}`);
  if (c.descriptionBefore !== c.descriptionAfter) parts.push('changed the description');
  return parts.join(' · ');
}

/** A role's change log, newest first. */
export const RoleHistoryModal: React.FunctionComponent<{ role: Role; onClose(): void }> = ({ role, onClose }) => {
  const changes = useLoad((token) => roleChanges(token, role.id), [role.id]);
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="role-history-title">
      <ModalHeader title={`History of ${roleLabel(role.name)}`} labelId="role-history-title" />
      <ModalBody>
        {changes.error && <Alert variant="danger" isInline isPlain title={changes.error} />}
        {changes.loading ? (
          <Spinner aria-label="Loading history" />
        ) : changes.data && changes.data.length > 0 ? (
          <List>
            {changes.data.map((c, i) => (
              <ListItem key={`${c.at}-${i}`}>{describe(c)}</ListItem>
            ))}
          </List>
        ) : (
          'No changes yet.'
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};
