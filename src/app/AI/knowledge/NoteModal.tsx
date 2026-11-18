import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { aiMessage } from '@app/AI/aiMessages';

export const NOTE_MAX = 50_000;

/** Adds a note, or edits one (`initial` set): a title and up to 50,000 characters of text. */
export const NoteModal: React.FunctionComponent<{
  initial: { title: string; text: string } | null;
  onSave(title: string, text: string): Promise<void>;
  onClose(): void;
}> = ({ initial, onSave, onClose }) => {
  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [text, setText] = React.useState(initial?.text ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(title.trim(), text);
    } catch (e) {
      setError(aiMessage(e));
      setBusy(false);
    }
  };
  const tooLong = text.length > NOTE_MAX;
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="kb-note-title">
      <ModalHeader title={initial ? 'Edit note' : 'Add note'} labelId="kb-note-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormGroup label="Title" isRequired fieldId="kb-note-name">
            <TextInput id="kb-note-name" value={title} onChange={(_e, v) => setTitle(v)} />
          </FormGroup>
          <FormGroup label="Text" isRequired fieldId="kb-note-text">
            <TextArea
              id="kb-note-text"
              value={text}
              onChange={(_e, v) => setText(v)}
              rows={12}
              validated={tooLong ? 'error' : 'default'}
            />
            {tooLong && (
              <Alert variant="danger" isInline isPlain title={`At most ${NOTE_MAX.toLocaleString()} characters`} />
            )}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          onClick={save}
          isDisabled={busy || title.trim() === '' || text.trim() === '' || tooLong}
          isLoading={busy}
        >
          {initial ? 'Save' : 'Add'}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
