import * as React from 'react';
import { Alert, Breadcrumb, BreadcrumbItem, Button, Content, Flex, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { Link, useParams } from 'react-router-dom';
import {
  type KnowledgeSource,
  addKnowledgeFile,
  addKnowledgeNote,
  addKnowledgeWebPage,
  downloadKnowledgeSource,
  getKnowledgeBase,
  isAdding,
  knowledgeSourceText,
  listKnowledgeSources,
  removeKnowledgeSource,
  updateKnowledgeSource,
} from '@app/api/aiKnowledge';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { aiMessage } from '@app/AI/aiMessages';
import { KIND_TEXT, SourceState, sizeText } from '@app/AI/knowledge/SourceState';
import { useRefreshWhile } from '@app/AI/knowledge/useRefreshWhile';
import { AddWebPageModal } from '@app/AI/knowledge/AddWebPageModal';
import { NoteModal } from '@app/AI/knowledge/NoteModal';
import { SourceTextModal } from '@app/AI/knowledge/SourceTextModal';

export const MAX_FILE_BYTES = 16 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,.html';

type Dialog =
  | { kind: 'page' }
  | { kind: 'note'; source: KnowledgeSource | null; text: string }
  | { kind: 'text'; source: KnowledgeSource }
  | { kind: 'remove'; source: KnowledgeSource };

/** A note is stored as "# <title>\n\n<text>"; editing shows the text only. */
const noteBody = (title: string, markdown: string) => {
  const head = `# ${title}\n\n`;
  return markdown.startsWith(head) ? markdown.slice(head.length) : markdown;
};

/** One knowledge base: its sources, their states, and the ways to add, refresh or remove them (spec §6.1). */
export const KnowledgeBasePage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canManage = useAccess().hasInWorkspace('ai:manage');
  const base = useLoad((tk) => getKnowledgeBase(tk, ws, id), [ws, id]);
  const sources = useLoad((tk) => listKnowledgeSources(tk, ws, id), [ws, id], { keepOnError: true });
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const tk = token as string;

  const working = (sources.data ?? []).some((s) => isAdding(s.state) || s.state === 'REMOVING');
  useRefreshWhile(working, sources.reload);

  const put = (s: KnowledgeSource) =>
    sources.setData((list) => {
      const rest = list ?? [];
      return rest.some((x) => x.id === s.id) ? rest.map((x) => (x.id === s.id ? s : x)) : [...rest, s];
    });

  const act = async (work: () => Promise<KnowledgeSource>) => {
    setNotice(null);
    try {
      put(await work());
    } catch (e) {
      setNotice(aiMessage(e));
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setNotice('Files up to 16 MB');
      return;
    }
    act(() => addKnowledgeFile(tk, ws, id, file));
  };

  const editNote = async (s: KnowledgeSource) => {
    setNotice(null);
    try {
      setDialog({ kind: 'note', source: s, text: noteBody(s.title, await knowledgeSourceText(tk, ws, id, s.id)) });
    } catch (e) {
      setNotice(aiMessage(e));
    }
  };

  const download = async (s: KnowledgeSource) => {
    try {
      const blob = await downloadKnowledgeSource(tk, ws, id, s.id);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = s.fileName ?? s.title;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setNotice(aiMessage(e));
    }
  };

  const remove = async (s: KnowledgeSource) => {
    setBusy(true);
    setDialogError(null);
    try {
      put(await removeKnowledgeSource(tk, ws, id, s.id));
      setDialog(null);
    } catch (e) {
      setDialogError(aiMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const name = base.data?.name ?? 'Knowledge base';
  return (
    <PageShell title={name}>
      <Breadcrumb>
        <BreadcrumbItem>
          <Link to="/ai?tab=knowledge">AI · Knowledge</Link>
        </BreadcrumbItem>
        <BreadcrumbItem isActive>{name}</BreadcrumbItem>
      </Breadcrumb>
      {base.data?.description && <Content component="p">{base.data.description}</Content>}
      {canManage && (
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <Button onClick={() => fileInput.current?.click()}>Add file</Button>
          <Button variant="secondary" onClick={() => setDialog({ kind: 'page' })}>
            Add web page
          </Button>
          <Button variant="secondary" onClick={() => setDialog({ kind: 'note', source: null, text: '' })}>
            Add note
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            aria-label="File to add"
            style={{ display: 'none' }}
            onChange={onFile}
          />
        </Flex>
      )}
      {notice && <Alert variant="danger" isInline isPlain title={notice} />}
      {(base.error || sources.error) && <Alert variant="danger" isInline title={base.error ?? sources.error} />}
      {!sources.data && !sources.error && <Spinner aria-label="Loading sources" />}
      {sources.data && sources.data.length === 0 && <Content component="p">No sources yet.</Content>}
      {sources.data && sources.data.length > 0 && (
        <Table aria-label="Sources" variant="compact">
          <Thead>
            <Tr>
              <Th>Source</Th>
              <Th>Kind</Th>
              <Th>Size</Th>
              <Th>State</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {sources.data.map((s) => {
              const removing = s.state === 'REMOVING';
              return (
                <Tr key={s.id}>
                  <Td dataLabel="Source">
                    {s.kind === 'WEB_PAGE' && s.url && s.title !== s.url ? `${s.title} (${s.url})` : s.title}
                  </Td>
                  <Td dataLabel="Kind">{KIND_TEXT[s.kind]}</Td>
                  <Td dataLabel="Size">{sizeText(s.size)}</Td>
                  <Td dataLabel="State">
                    <SourceState source={s} />
                  </Td>
                  <Td isActionCell>
                    {!removing && (
                      <Flex spaceItems={{ default: 'spaceItemsMd' }} flexWrap={{ default: 'nowrap' }}>
                        {s.kind === 'FILE' ? (
                          <Button
                            variant="link"
                            isInline
                            aria-label={`Download ${s.title}`}
                            onClick={() => download(s)}
                          >
                            Download
                          </Button>
                        ) : (
                          <Button
                            variant="link"
                            isInline
                            aria-label={`View text ${s.title}`}
                            onClick={() => setDialog({ kind: 'text', source: s })}
                          >
                            View text
                          </Button>
                        )}
                        {canManage && s.kind === 'WEB_PAGE' && (s.state === 'READY' || s.state === 'FAILED') && (
                          <Button
                            variant="link"
                            isInline
                            aria-label={`Fetch again ${s.title}`}
                            onClick={() =>
                              act(() => updateKnowledgeSource(tk, ws, id, s.id, { action: 'FETCH_AGAIN' }))
                            }
                          >
                            Fetch again
                          </Button>
                        )}
                        {canManage && s.kind === 'NOTE' && (
                          <Button variant="link" isInline aria-label={`Edit ${s.title}`} onClick={() => editNote(s)}>
                            Edit
                          </Button>
                        )}
                        {canManage && s.state === 'FAILED' && (
                          <Button
                            variant="link"
                            isInline
                            aria-label={`Retry ${s.title}`}
                            onClick={() => act(() => updateKnowledgeSource(tk, ws, id, s.id, { action: 'RETRY' }))}
                          >
                            Retry
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="link"
                            isDanger
                            isInline
                            aria-label={`Remove ${s.title}`}
                            onClick={() => {
                              setDialogError(null);
                              setDialog({ kind: 'remove', source: s });
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </Flex>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}
      {dialog?.kind === 'page' && (
        <AddWebPageModal
          onAdd={async (url) => {
            put(await addKnowledgeWebPage(tk, ws, id, url));
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'note' && (
        <NoteModal
          initial={dialog.source ? { title: dialog.source.title, text: dialog.text } : null}
          onSave={async (title, text) => {
            const src = dialog.source;
            put(
              src
                ? await updateKnowledgeSource(tk, ws, id, src.id, { title, text })
                : await addKnowledgeNote(tk, ws, id, title, text),
            );
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'text' && (
        <SourceTextModal
          title={dialog.source.title}
          load={() => knowledgeSourceText(tk, ws, id, dialog.source.id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <ConfirmModal
          title={`Remove ${dialog.source.title}?`}
          confirmLabel="Remove"
          variant="danger"
          busy={busy}
          error={dialogError}
          onConfirm={() => remove(dialog.source)}
          onCancel={() => setDialog(null)}
        >
          {`Remove ${dialog.source.title} from ${name}? The AI stops using it.`}
        </ConfirmModal>
      )}
    </PageShell>
  );
};
