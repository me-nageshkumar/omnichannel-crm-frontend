import * as React from 'react';
import { Alert, Button, Label } from '@patternfly/react-core';
import { PaperclipIcon, ThumbtackIcon, TimesIcon } from '@patternfly/react-icons';
import Markdown from 'react-markdown';
import type { Note, NoteAttachment } from '@app/api/crm';
import { ACCEPT, rejectReason, sizeLabel } from '@app/Crm/notes/attachmentRules';
import { NoteComposer } from '@app/Crm/notes/NoteComposer';

const WHEN = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Markdown as text and formatting only: raw HTML is shown as text, unsafe links are dropped, links open safely. */
export const NoteBody: React.FunctionComponent<{ body: string }> = ({ body }) => (
  <div style={{ overflowWrap: 'anywhere' }}>
    <Markdown
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {body}
    </Markdown>
  </div>
);

/** One note: its text, author and time, pin, edit and delete when allowed, and its files. */
export const NoteItem: React.FunctionComponent<{
  note: Note;
  canPin: boolean;
  canChange: boolean;
  canAttach: boolean;
  busy: boolean;
  onPin(): void;
  onEdit(body: string): Promise<boolean>;
  onDelete(): void;
  onAttach(file: File): void;
  onDownload(a: NoteAttachment): void;
  onRemoveFile(a: NoteAttachment): void;
}> = ({ note, canPin, canChange, canAttach, busy, onPin, onEdit, onDelete, onAttach, onDownload, onRemoveFile }) => {
  const [editing, setEditing] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const inputId = `crm-note-file-${note.id}`;
  return (
    <li
      style={{
        listStyle: 'none',
        padding: 'var(--pf-t--global--spacer--sm)',
        border: 'var(--pf-t--global--border--width--regular) solid var(--pf-t--global--border--color--default)',
        borderRadius: 'var(--pf-t--global--border--radius--small)',
        display: 'grid',
        gap: 'var(--pf-t--global--spacer--xs)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', alignItems: 'center', flexWrap: 'wrap' }}>
        {note.pinned && (
          <Label isCompact color="blue" icon={<ThumbtackIcon />}>
            Pinned
          </Label>
        )}
        <small style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>
          {note.author?.name ?? 'Someone'} · {WHEN.format(new Date(note.creationTime))}
        </small>
        <span style={{ flex: 1 }} />
        {canPin && (
          <Button variant="link" isInline isDisabled={busy} onClick={onPin}>
            {note.pinned ? 'Unpin note' : 'Pin note'}
          </Button>
        )}
        {canChange && !editing && (
          <>
            <Button variant="link" isInline onClick={() => setEditing(true)}>
              Edit note
            </Button>
            <Button variant="link" isInline isDanger onClick={onDelete}>
              Delete note
            </Button>
          </>
        )}
      </div>
      {editing ? (
        <NoteComposer
          label="Edit note"
          initial={note.body}
          saveLabel="Save note"
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={async (body) => {
            const ok = await onEdit(body);
            if (ok) setEditing(false);
            return ok;
          }}
        />
      ) : (
        <NoteBody body={note.body} />
      )}
      {note.attachments.length > 0 && (
        <ul
          aria-label="Attachments"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--pf-t--global--spacer--sm)',
          }}
        >
          {note.attachments.map((a) => (
            <li key={a.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Button
                variant="link"
                isInline
                icon={<PaperclipIcon />}
                aria-label={`Download ${a.fileName} (${sizeLabel(a.size)})`}
                onClick={() => onDownload(a)}
              >
                {a.fileName} ({sizeLabel(a.size)})
              </Button>
              {canChange && (
                <Button
                  variant="plain"
                  size="sm"
                  aria-label={`Remove ${a.fileName}`}
                  icon={<TimesIcon />}
                  isDisabled={busy}
                  onClick={() => onRemoveFile(a)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canAttach && (
        <div>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={ACCEPT}
            aria-label="Attach file to note"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const why = rejectReason(f, note.attachments.length);
              setProblem(why);
              if (!why) onAttach(f);
            }}
          />
          <Button
            variant="link"
            isInline
            icon={<PaperclipIcon />}
            isDisabled={busy}
            onClick={() => input.current?.click()}
          >
            Attach file
          </Button>
          {problem && <Alert variant="warning" isInline isPlain title={problem} className="pf-v6-u-mt-xs" />}
        </div>
      )}
    </li>
  );
};
