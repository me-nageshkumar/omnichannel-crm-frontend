import * as React from 'react';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import {
  createNote,
  deleteAttachment,
  deleteNote,
  downloadAttachment,
  listNotes,
  pinNote,
  updateNote,
  uploadAttachment,
} from '@app/api/crm';
import type { Note, NoteAttachment, TaskTargetType } from '@app/api/crm';
import { saveFile } from '@app/api/contacts';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { crmMessage } from '@app/Crm/errors';
import { NoteComposer } from '@app/Crm/notes/NoteComposer';
import { NoteItem } from '@app/Crm/notes/NoteItem';

const PAGE = 20;

/** Pinned notes first, then the newest. */
const order = (a: Note, b: Note) =>
  a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime();

/** The notes of a record: a composer, the list (pinned first) with files, and "Load more". */
export const CrmNotes: React.FunctionComponent<{ target: { type: TaskTargetType; id: string }; canEdit: boolean }> = ({
  target,
  canEdit,
}) => {
  const { token, workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const canDelete = useCrmCan('crm:delete');
  const attachments = useCrmStatus().status?.attachmentsEnabled !== false;
  const loaded = useLoad(
    (t) => listNotes(t, ws, { targetType: target.type, targetId: target.id, page: 0, size: PAGE }),
    [ws, target.type, target.id],
    { keepOnError: true },
  );
  const [nextPage, setNextPage] = React.useState(1);
  React.useEffect(() => setNextPage(1), [ws, target.type, target.id]);
  const action = useAction();
  const [deleting, setDeleting] = React.useState<Note | null>(null);

  const notes = (loaded.data?.items ?? []).slice().sort(order);
  const replace = (saved: Note) => loaded.setData((p) => p && { ...p, items: upsert(p.items, saved) });
  const t = token as string;
  const fail = (what: string) => (e: unknown) => crmMessage(e, `Could not ${what}. Try again.`);

  const add = async (body: string) => {
    const saved = await action.run(() => createNote(t, ws, { target, body }), fail('save the note'));
    if (!saved) return false;
    loaded.setData((p) => (p ? { ...p, items: [saved, ...p.items], total: p.total + 1 } : p));
    return true;
  };

  const remove = async () => {
    if (!deleting) return;
    const done = await action.run(async () => {
      await deleteNote(t, ws, deleting.id);
      return true;
    }, fail('delete the note'));
    if (done) {
      loaded.setData((p) => p && { ...p, items: p.items.filter((x) => x.id !== deleting.id), total: p.total - 1 });
      setDeleting(null);
    }
  };

  const download = async (note: Note, a: NoteAttachment) => {
    const blob = await action.run(() => downloadAttachment(t, ws, note.id, a.id), fail('download the file'));
    if (blob) saveFile(blob, a.fileName);
  };

  // The next page is appended, so the list, the composer and any edit in progress stay as they are.
  const loadMore = async () => {
    const more = await action.run(
      () => listNotes(t, ws, { targetType: target.type, targetId: target.id, page: nextPage, size: PAGE }),
      fail('load more notes'),
    );
    if (!more) return;
    loaded.setData(
      (p) =>
        p && {
          ...p,
          items: [...p.items, ...more.items.filter((x) => !p.items.some((y) => y.id === x.id))],
          total: more.total,
        },
    );
    setNextPage((n) => n + 1);
  };

  if (loaded.loading && !loaded.data) return <Spinner aria-label="Loading notes" />;
  return (
    <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--md)' }}>
      {(loaded.error || (action.error && !deleting)) && (
        <Alert variant="danger" isInline isPlain title={action.error ?? loaded.error} />
      )}
      {canEdit && <NoteComposer label="New note" saveLabel="Add note" busy={action.busy} onSave={add} />}
      {notes.length === 0 ? (
        <p className="pf-v6-u-color-200">No notes yet.</p>
      ) : (
        <ul
          aria-label="Notes"
          style={{ margin: 0, padding: 0, display: 'grid', gap: 'var(--pf-t--global--spacer--sm)' }}
        >
          {notes.map((n) => {
            const canChange = canEdit && (n.author?.id === user?.id || canDelete);
            return (
              <NoteItem
                key={n.id}
                note={n}
                canPin={canEdit}
                canChange={canChange}
                canAttach={canChange && attachments}
                busy={action.busy}
                onPin={async () => {
                  const saved = await action.run(() => pinNote(t, ws, n.id, !n.pinned), fail('pin the note'));
                  if (saved) replace(saved);
                }}
                onEdit={async (body) => {
                  const saved = await action.run(
                    () => updateNote(t, ws, n.id, { body, version: n.version }),
                    fail('save the note'),
                  );
                  if (saved) replace(saved);
                  return !!saved;
                }}
                onDelete={() => {
                  action.reset();
                  setDeleting(n);
                }}
                onAttach={async (file) => {
                  const saved = await action.run(() => uploadAttachment(t, ws, n.id, file), fail('attach the file'));
                  if (saved) replace(saved);
                }}
                onDownload={(a) => void download(n, a)}
                onRemoveFile={async (a) => {
                  const saved = await action.run(() => deleteAttachment(t, ws, n.id, a.id), fail('remove the file'));
                  if (saved) replace(saved);
                }}
              />
            );
          })}
        </ul>
      )}
      {loaded.data && loaded.data.total > notes.length && (
        <div>
          <Button variant="link" isInline isDisabled={action.busy} onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      )}
      {deleting && (
        <ConfirmModal
          title="Delete this note?"
          confirmLabel="Delete"
          variant="danger"
          busy={action.busy}
          error={action.error}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        >
          The note and its files are removed for everyone. It can&apos;t be undone.
        </ConfirmModal>
      )}
    </div>
  );
};
