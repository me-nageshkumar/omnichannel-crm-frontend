import * as React from 'react';
import { Alert, Content, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { listHistoryImportChats } from '@app/api/historyImports';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { chatNote, chatStatusLabel } from '@app/HistoryImports/historyImportDisplay';

/** The chats of one import, loaded when its row is first expanded and again whenever its progress moves. */
export const HistoryImportChats: React.FunctionComponent<{
  id: string;
  /** Changes when the import's chats may have changed (e.g. how many have finished). */
  version: number;
}> = ({ id, version }) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const chats = useLoad((tk) => listHistoryImportChats(tk, ws, id), [ws, id]);
  // Refetched in place, so the rows already shown stay until the new ones arrive.
  const loadedVersion = React.useRef(version);
  React.useEffect(() => {
    if (loadedVersion.current === version) return;
    loadedVersion.current = version;
    chats.reload();
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (chats.error) return <Alert variant="danger" isInline isPlain title={chats.error} />;
  if (!chats.data) return <Spinner size="md" aria-label="Loading chats" />;
  const items = chats.data.items;
  return (
    <Table aria-label="Chats in this import" variant="compact">
      <Thead>
        <Tr>
          <Th>Chat</Th>
          <Th>Status</Th>
          <Th>Seen / New / Updated</Th>
          <Th>Note</Th>
        </Tr>
      </Thead>
      <Tbody>
        {items.length === 0 ? (
          <Tr>
            <Td colSpan={4}>No chats yet.</Td>
          </Tr>
        ) : (
          items.map((c) => (
            <Tr key={c.id}>
              <Td dataLabel="Chat">
                {c.chatName && <div>{c.chatName}</div>}
                <Content component="small" style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>
                  {c.remoteId}
                </Content>
              </Td>
              <Td dataLabel="Status">{chatStatusLabel(c.status)}</Td>
              <Td dataLabel="Seen / New / Updated">{`${c.counts.seen} / ${c.counts.inserted} / ${c.counts.updated}`}</Td>
              <Td dataLabel="Note">{chatNote(c) ?? '—'}</Td>
            </Tr>
          ))
        )}
      </Tbody>
    </Table>
  );
};
