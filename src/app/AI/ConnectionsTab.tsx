import * as React from 'react';
import { Alert, Button, Content, Label, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  type AiConnection,
  type AiConnectionStatus,
  type AiProvider,
  deleteAiConnection,
  listAiConnections,
  verifyAiConnection,
} from '@app/api/ai';
import { useLoad } from '@app/admin/useLoad';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useSession } from '@app/session/SessionContext';
import { ConnectionModal } from '@app/AI/ConnectionModal';
import { aiMessage } from '@app/AI/aiMessages';

const STATUS: Record<AiConnectionStatus, { text: string; color: 'green' | 'red' | 'grey' }> = {
  OK: { text: 'Verified', color: 'green' },
  INVALID: { text: 'Key refused', color: 'red' },
  UNVERIFIED: { text: 'Not checked', color: 'grey' },
};

/** The brand's provider connections: one key per connection, never shown back. */
export const ConnectionsTab: React.FunctionComponent<{ providers: AiProvider[]; canManage: boolean }> = ({
  providers,
  canManage,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad((tk) => listAiConnections(tk, ws), [ws]);
  const [editing, setEditing] = React.useState<AiConnection | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<AiConnection | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ variant: 'success' | 'danger'; text: string } | null>(null);
  const label = (id: string) => providers.find((p) => p.id === id)?.label ?? id;

  const replace = (c: AiConnection) =>
    loaded.setData((list) => {
      const rest = (list ?? []).filter((x) => x.id !== c.id);
      return [...rest, c].sort((a, b) => a.name.localeCompare(b.name));
    });

  const verify = async (c: AiConnection) => {
    setNotice(null);
    try {
      const v = await verifyAiConnection(token as string, ws, c.id);
      replace(v);
      setNotice(
        v.status === 'OK'
          ? { variant: 'success', text: `${v.name}: the provider accepted the key.` }
          : { variant: 'danger', text: v.lastError ?? 'The key could not be checked.' },
      );
    } catch (e) {
      setNotice({ variant: 'danger', text: aiMessage(e) });
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteAiConnection(token as string, ws, deleting.id);
      loaded.setData((list) => (list ?? []).filter((x) => x.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setDeleteError(aiMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Content component="p">
        Each connection holds one API key for a provider. Keys are stored encrypted and never shown again.
      </Content>
      {canManage && (
        <Button onClick={() => setEditing('new')} isDisabled={providers.length === 0}>
          Add connection
        </Button>
      )}
      {notice && <Alert variant={notice.variant} isInline isPlain title={notice.text} />}
      {loaded.error && <Alert variant="danger" isInline title={loaded.error} />}
      {!loaded.data && !loaded.error && <Spinner aria-label="Loading connections" />}
      {loaded.data && loaded.data.length === 0 && <Content component="p">No connections yet.</Content>}
      {loaded.data && loaded.data.length > 0 && (
        <Table aria-label="AI connections" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Provider</Th>
              <Th>Key</Th>
              <Th>Status</Th>
              {canManage && <Th screenReaderText="Actions" />}
            </Tr>
          </Thead>
          <Tbody>
            {loaded.data.map((c) => (
              <Tr key={c.id}>
                <Td dataLabel="Name">{c.name}</Td>
                <Td dataLabel="Provider">{label(c.provider)}</Td>
                <Td dataLabel="Key">
                  <code>{c.keyHint}</code>
                </Td>
                <Td dataLabel="Status">
                  <Label color={STATUS[c.status].color}>{STATUS[c.status].text}</Label>
                </Td>
                {canManage && (
                  <Td isActionCell>
                    <Button variant="link" isInline aria-label={`Verify ${c.name}`} onClick={() => verify(c)}>
                      Verify
                    </Button>{' '}
                    <Button variant="link" isInline aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                      Edit
                    </Button>{' '}
                    <Button
                      variant="link"
                      isDanger
                      isInline
                      aria-label={`Delete ${c.name}`}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(c);
                      }}
                    >
                      Delete
                    </Button>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      {editing && (
        <ConnectionModal
          providers={providers}
          connection={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            replace(saved);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete connection?"
          confirmLabel="Delete"
          variant="danger"
          busy={busy}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        >
          {deleting.name} and its key will be removed. Profiles that use it must be changed first.
        </ConfirmModal>
      )}
    </>
  );
};
