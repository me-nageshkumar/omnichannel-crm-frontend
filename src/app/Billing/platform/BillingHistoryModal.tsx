import * as React from 'react';
import { Alert, Button, Modal, ModalBody, ModalFooter, ModalHeader, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { BillingEvent } from '@app/api/billing';
import { useLoad } from '@app/admin/useLoad';

/** The change log of a feature group, a plan or a customer's subscription, newest first. */
export const BillingHistoryModal: React.FunctionComponent<{
  title: string;
  load(token: string): Promise<BillingEvent[]>;
  onClose(): void;
}> = ({ title, load, onClose }) => {
  const events = useLoad(load, [title]);
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="billing-history-title">
      <ModalHeader title={title} labelId="billing-history-title" />
      <ModalBody>
        {events.error && <Alert variant="danger" isInline isPlain title={events.error} />}
        {events.loading ? (
          <Spinner aria-label="Loading history" />
        ) : events.data && events.data.length > 0 ? (
          <Table aria-label="History" variant="compact">
            <Thead>
              <Tr>
                <Th width={25}>When</Th>
                <Th width={20}>Who</Th>
                <Th>What</Th>
              </Tr>
            </Thead>
            <Tbody>
              {events.data.map((e) => (
                <Tr key={e.id}>
                  <Td dataLabel="When">{new Date(e.at).toLocaleString()}</Td>
                  <Td dataLabel="Who">{e.byName}</Td>
                  <Td dataLabel="What">{e.summary}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
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
