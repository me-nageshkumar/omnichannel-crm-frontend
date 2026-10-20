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
import { Authority, AuthorityChange, authorityHistory } from '@app/api/authorities';
import { LEVEL_LABELS } from '@app/api/roles';
import { useLoad } from '@app/admin/useLoad';

function describe(c: AuthorityChange): string {
  const parts = [new Date(c.at).toLocaleString(), c.changedBy];
  if (c.action !== 'UPDATED') {
    parts.push(c.action.toLowerCase());
    return parts.join(' · ');
  }
  if (c.groupBefore !== c.groupAfter) parts.push(`group ${c.groupBefore} → ${c.groupAfter}`);
  if (c.levelBefore !== c.levelAfter && c.levelBefore && c.levelAfter) {
    parts.push(`level ${LEVEL_LABELS[c.levelBefore]} → ${LEVEL_LABELS[c.levelAfter]}`);
  }
  if (c.descriptionBefore !== c.descriptionAfter) parts.push('changed the description');
  return parts.join(' · ');
}

/** An authority's change log, newest first. */
export const AuthorityHistoryModal: React.FunctionComponent<{ authority: Authority; onClose(): void }> = ({
  authority,
  onClose,
}) => {
  const changes = useLoad((token) => authorityHistory(token, authority.code), [authority.code]);
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="authority-history-title">
      <ModalHeader title={`History of ${authority.code}`} labelId="authority-history-title" />
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
