import * as React from 'react';
import { Alert, Button, Spinner, TextArea, Title } from '@patternfly/react-core';
import { ContactNote, addNote, deleteNote, listNotes, updateNote } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';

const newestFirst = (notes: ContactNote[]) => [...notes].sort((a, b) => b.creationTime.localeCompare(a.creationTime));

/** A contact's notes, newest first: add, edit your own, delete your own (or any with contact:delete). */
export const NotesPanel: React.FunctionComponent<{
  token: string;
  workspaceId: string;
  contactId: string;
  canAnnotate: boolean;
  canDeleteAny: boolean;
}> = ({ token, workspaceId, contactId, canAnnotate, canDeleteAny }) => {
  const notes = useLoad((tk) => listNotes(tk, workspaceId, contactId), [workspaceId, contactId]);
  const [text, setText] = React.useState('');
  const [editing, setEditing] = React.useState<{ id: string; text: string } | null>(null);
  const action = useAction();

  const onAdd = async () => {
    const created = await action.run(() => addNote(token, workspaceId, contactId, text.trim()));
    if (created) {
      notes.setData((l) => upsert(l ?? [], created));
      setText('');
    }
  };
  const onSaveEdit = async () => {
    if (!editing) return;
    const saved = await action.run(() => updateNote(token, workspaceId, contactId, editing.id, editing.text.trim()));
    if (saved) {
      notes.setData((l) => upsert(l ?? [], saved));
      setEditing(null);
    }
  };
  const onDelete = async (id: string) => {
    const done = await action.run(async () => {
      await deleteNote(token, workspaceId, contactId, id);
      return true;
    });
    if (done) notes.setData((l) => (l ?? []).filter((n) => n.id !== id));
  };

  return (
    <section aria-label="Notes">
      <Title headingLevel="h2" size="md">
        Notes
      </Title>
      {(notes.error || action.error) && <Alert variant="danger" isInline title={notes.error ?? action.error} />}
      {canAnnotate && (
        <div>
          <TextArea aria-label="New note" value={text} onChange={(_e, v) => setText(v)} rows={2} />
          <Button variant="primary" onClick={onAdd} isDisabled={!text.trim() || action.busy}>
            Add note
          </Button>
        </div>
      )}
      {notes.loading && !notes.data ? (
        <Spinner aria-label="Loading notes" />
      ) : (
        <ul>
          {newestFirst(notes.data ?? []).map((n) => (
            <li key={n.id}>
              {editing?.id === n.id ? (
                <>
                  <TextArea
                    aria-label="Edit note"
                    value={editing.text}
                    onChange={(_e, v) => setEditing({ id: n.id, text: v })}
                    rows={2}
                  />
                  <Button variant="primary" onClick={onSaveEdit} isDisabled={!editing.text.trim() || action.busy}>
                    Save note
                  </Button>{' '}
                  <Button variant="link" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <p>{n.text}</p>
                  <small>
                    {n.createdBy.name} · {relative(n.creationTime)}
                  </small>{' '}
                  {n.mine && canAnnotate && (
                    <Button variant="link" isInline onClick={() => setEditing({ id: n.id, text: n.text })}>
                      Edit note
                    </Button>
                  )}{' '}
                  {((n.mine && canAnnotate) || canDeleteAny) && (
                    <Button variant="link" isInline isDanger onClick={() => onDelete(n.id)}>
                      Delete note
                    </Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
