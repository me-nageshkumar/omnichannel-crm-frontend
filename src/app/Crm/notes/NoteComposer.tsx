import * as React from 'react';
import { Button, HelperText, HelperTextItem, TextArea } from '@patternfly/react-core';

export const MAX_BODY = 20000;

/** A Markdown text box that saves on its button or Ctrl/Cmd+Enter; also used to edit a note in place. */
export const NoteComposer: React.FunctionComponent<{
  label: string;
  initial?: string;
  saveLabel: string;
  busy?: boolean;
  onSave(body: string): Promise<boolean>;
  onCancel?(): void;
}> = ({ label, initial = '', saveLabel, busy, onSave, onCancel }) => {
  const [body, setBody] = React.useState(initial);
  const tooLong = body.length > MAX_BODY;
  const save = async () => {
    if (!body.trim() || tooLong || busy) return;
    if (await onSave(body.trim())) setBody('');
  };
  return (
    <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--xs)' }}>
      <TextArea
        aria-label={label}
        value={body}
        resizeOrientation="vertical"
        validated={tooLong ? 'error' : 'default'}
        onChange={(_e, v) => setBody(v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
      />
      <HelperText>
        <HelperTextItem variant={tooLong ? 'error' : 'default'}>
          {tooLong ? `Use at most ${MAX_BODY.toLocaleString()} characters.` : 'Markdown supported. Ctrl+Enter saves.'}
        </HelperTextItem>
      </HelperText>
      <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)' }}>
        <Button
          variant="secondary"
          isDisabled={!body.trim() || tooLong || busy}
          isLoading={busy}
          onClick={() => void save()}
        >
          {saveLabel}
        </Button>
        {onCancel && (
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
