import * as React from 'react';
import {
  Alert,
  Button,
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  HelperText,
  HelperTextItem,
  Spinner,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { Link } from 'react-router-dom';
import { type AiProvider, listAiConnections } from '@app/api/ai';
import { type KnowledgeBase, deleteKnowledgeBase, listKnowledgeBases } from '@app/api/aiKnowledge';
import { useLoad } from '@app/admin/useLoad';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useSession } from '@app/session/SessionContext';
import { aiMessage } from '@app/AI/aiMessages';
import { KnowledgeBaseModal } from '@app/AI/knowledge/KnowledgeBaseModal';

/** "12 sources · 10 ready · 1 failed · 1 adding" (zero failed / adding left out). */
export function countsText(b: KnowledgeBase): string {
  const parts = [`${b.sourceCount} source${b.sourceCount === 1 ? '' : 's'}`, `${b.counts.ready} ready`];
  if (b.counts.failed > 0) parts.push(`${b.counts.failed} failed`);
  const adding = b.counts.adding + b.counts.queued;
  if (adding > 0) parts.push(`${adding} adding`);
  return parts.join(' · ');
}

/** Brand setup → AI → Knowledge (spec 2026-11-18 §6.1): the brand's knowledge bases. */
export const KnowledgeTab: React.FunctionComponent<{ providers: AiProvider[]; canManage: boolean }> = ({
  providers,
  canManage,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const bases = useLoad((tk) => listKnowledgeBases(tk, ws), [ws]);
  const connections = useLoad((tk) => listAiConnections(tk, ws), [ws]);
  const [editing, setEditing] = React.useState<KnowledgeBase | 'new' | null>(null);
  const [deleting, setDeleting] = React.useState<KnowledgeBase | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? id;

  const replace = (b: KnowledgeBase) =>
    bases.setData((list) =>
      [...(list ?? []).filter((x) => x.id !== b.id), b].sort((a, c) => a.name.localeCompare(c.name)),
    );

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteKnowledgeBase(token as string, ws, deleting.id);
      bases.setData((list) => (list ?? []).filter((x) => x.id !== deleting.id));
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
        A knowledge base holds files, web pages and notes the AI answers from. Add it to an AI profile under Knowledge.
      </Content>
      {canManage && (
        <Button onClick={() => setEditing('new')} isDisabled={!connections.data}>
          New knowledge base
        </Button>
      )}
      {bases.error && <Alert variant="danger" isInline title={bases.error} />}
      {!bases.data && !bases.error && <Spinner aria-label="Loading knowledge bases" />}
      {bases.data && bases.data.length === 0 && (
        <EmptyState titleText="No knowledge bases yet" headingLevel="h3">
          <EmptyStateBody>
            Create one, then add your brochures, course pages and notes. The AI answers customers from what you add.
          </EmptyStateBody>
          {canManage && (
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button onClick={() => setEditing('new')} isDisabled={!connections.data}>
                  New knowledge base
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          )}
        </EmptyState>
      )}
      {bases.data && bases.data.length > 0 && (
        <Table aria-label="Knowledge bases" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Connection</Th>
              <Th>Sources</Th>
              <Th>Used by</Th>
              <Th>Updated</Th>
              {canManage && <Th screenReaderText="Actions" />}
            </Tr>
          </Thead>
          <Tbody>
            {bases.data.map((b) => (
              <Tr key={b.id}>
                <Td dataLabel="Name">
                  <Link to={`/ai/knowledge/${encodeURIComponent(b.id)}`}>{b.name}</Link>
                  {b.status === 'FAILED' && b.error && (
                    <HelperText>
                      <HelperTextItem variant="error">{b.error}</HelperTextItem>
                    </HelperText>
                  )}
                </Td>
                <Td dataLabel="Connection">{`${providerLabel(b.provider)} · ${b.connectionName ?? b.connectionId}`}</Td>
                <Td dataLabel="Sources">{countsText(b)}</Td>
                <Td dataLabel="Used by">{b.usedBy.length > 0 ? b.usedBy.join(', ') : 'Not used yet'}</Td>
                <Td dataLabel="Updated">
                  {new Date(b.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </Td>
                {canManage && (
                  <Td isActionCell>
                    <Button variant="link" isInline aria-label={`Rename ${b.name}`} onClick={() => setEditing(b)}>
                      Rename
                    </Button>{' '}
                    <Button
                      variant="link"
                      isDanger
                      isInline
                      aria-label={`Delete ${b.name}`}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(b);
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
        <KnowledgeBaseModal
          base={editing === 'new' ? null : editing}
          providers={providers}
          connections={connections.data}
          onSaved={(saved) => {
            replace(saved);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={busy}
          error={deleteError}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        >
          Its files are removed from OpenAI too, and the AI stops answering from it.
        </ConfirmModal>
      )}
    </>
  );
};
