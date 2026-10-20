import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, EmptyState, EmptyStateBody, EmptyStateFooter, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { shown } from '@app/api/phoneNumbers';
import { listInboxNumbers } from '@app/api/inbox';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { RoutingSettingsModal } from '@app/Inbox/RoutingSettingsModal';
import { PhoneNumberStatusLabel } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

/** The brand's numbers to open an inbox on; WhatsApp Web ones open, Cloud API ones are not supported yet. */
export const InboxNumbersPage: React.FunctionComponent = () => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const access = useAccess();
  const canRoute = access.hasInWorkspace('inbox:settings');
  const numbers = useLoad((t) => listInboxNumbers(t, ws), [ws]);
  const [routing, setRouting] = React.useState<string | null>(null);
  const items = numbers.data ?? [];

  return (
    <PageShell title="Inbox">
      {numbers.error && <Alert variant="danger" isInline title={numbers.error} />}
      {numbers.loading && !numbers.data ? (
        <Spinner aria-label="Loading numbers" />
      ) : items.length === 0 && !numbers.error ? (
        <EmptyState titleText="No WhatsApp numbers yet" headingLevel="h2">
          <EmptyStateBody>Add a number to this brand to start a shared inbox on it.</EmptyStateBody>
          {access.hasInWorkspace('phone-number:view') && (
            <EmptyStateFooter>
              <Button variant="link" component={(props) => <Link {...props} to="/phone-numbers" />}>
                Go to phone numbers
              </Button>
            </EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Inbox numbers" variant="compact">
          <Thead>
            <Tr>
              <Th>Number</Th>
              <Th>Label</Th>
              <Th>Status</Th>
              {canRoute && <Th screenReaderText="Actions" />}
            </Tr>
          </Thead>
          <Tbody>
            {items.map((n) => (
              <Tr key={n.id}>
                <Td dataLabel="Number">
                  {n.connectionType === 'WHATSAPP_WEB' ? (
                    <Link to={`/inbox/${n.id}`}>{shown(n.number)}</Link>
                  ) : (
                    <>
                      {shown(n.number)} <small>Cloud API inbox coming later</small>
                    </>
                  )}
                </Td>
                <Td dataLabel="Label">{n.label ?? '—'}</Td>
                <Td dataLabel="Status">
                  <PhoneNumberStatusLabel number={n} />
                </Td>
                {canRoute && (
                  <Td isActionCell>
                    <Button variant="secondary" size="sm" onClick={() => setRouting(n.id)}>
                      Routing
                    </Button>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      {routing && <RoutingSettingsModal phoneNumberId={routing} onClose={() => setRouting(null)} />}
    </PageShell>
  );
};
