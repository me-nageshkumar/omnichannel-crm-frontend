import * as React from 'react';
import { Alert, Button, Content, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { type AiProfile, type AiProvider, deleteAiProfile, listAiConnections, listAiProfiles } from '@app/api/ai';
import { useLoad } from '@app/admin/useLoad';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useSession } from '@app/session/SessionContext';
import { ProfileModal } from '@app/AI/ProfileModal';
import { aiMessage } from '@app/AI/aiMessages';

/** The brand's AI profiles: which connection and model a chatbot's AI node uses, and its tools and knowledge. */
export const ProfilesTab: React.FunctionComponent<{ providers: AiProvider[]; canManage: boolean }> = ({
  providers,
  canManage,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const profiles = useLoad((tk) => listAiProfiles(tk, ws), [ws]);
  const connections = useLoad((tk) => listAiConnections(tk, ws), [ws]);
  const [editing, setEditing] = React.useState<AiProfile | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<AiProfile | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const connectionName = (id: string) => connections.data?.find((c) => c.id === id)?.name ?? '—';

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteAiProfile(token as string, ws, deleting.id);
      profiles.setData((list) => (list ?? []).filter((x) => x.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setDeleteError(aiMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const noConnections = connections.data != null && connections.data.length === 0;
  return (
    <>
      <Content component="p">
        A profile is what a chatbot&apos;s AI node uses: the connection, the model, its instructions, tools and
        knowledge.
      </Content>
      {canManage && (
        <Button onClick={() => setEditing('new')} isDisabled={!connections.data || noConnections}>
          Add profile
        </Button>
      )}
      {noConnections && <Content component="small">Add a connection first.</Content>}
      {(profiles.error || connections.error) && (
        <Alert variant="danger" isInline title={profiles.error ?? connections.error ?? ''} />
      )}
      {!profiles.data && !profiles.error && <Spinner aria-label="Loading profiles" />}
      {profiles.data && profiles.data.length === 0 && <Content component="p">No profiles yet.</Content>}
      {profiles.data && profiles.data.length > 0 && (
        <Table aria-label="AI profiles" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Connection</Th>
              <Th>Model</Th>
              <Th>Tools</Th>
              {canManage && <Th screenReaderText="Actions" />}
            </Tr>
          </Thead>
          <Tbody>
            {profiles.data.map((p) => (
              <Tr key={p.id}>
                <Td dataLabel="Name">{p.name}</Td>
                <Td dataLabel="Connection">{connectionName(p.connectionId)}</Td>
                <Td dataLabel="Model">{p.model}</Td>
                <Td dataLabel="Tools">
                  {[
                    p.mcpServers.length > 0 && `${p.mcpServers.length} MCP`,
                    p.vectorStoreIds.length > 0 &&
                      `${p.vectorStoreIds.length} knowledge source${p.vectorStoreIds.length === 1 ? '' : 's'}`,
                    p.webSearch && 'web search',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Td>
                {canManage && (
                  <Td isActionCell>
                    <Button
                      variant="link"
                      isInline
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setEditing(p)}
                      isDisabled={!connections.data}
                    >
                      Edit
                    </Button>{' '}
                    <Button
                      variant="link"
                      isDanger
                      isInline
                      aria-label={`Delete ${p.name}`}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(p);
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
      {editing && connections.data && (
        <ProfileModal
          providers={providers}
          connections={connections.data}
          profile={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            profiles.setData((list) =>
              [...(list ?? []).filter((x) => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)),
            );
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete profile?"
          confirmLabel="Delete"
          variant="danger"
          busy={busy}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        >
          {deleting.name} will be removed. Chatbots that use it must be changed first.
        </ConfirmModal>
      )}
    </>
  );
};
