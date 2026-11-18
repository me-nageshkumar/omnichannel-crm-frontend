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
  TextInput,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { aiMessage } from '@app/AI/aiMessages';

/** Asks for one https page address; the server fetches it. */
export const AddWebPageModal: React.FunctionComponent<{ onAdd(url: string): Promise<void>; onClose(): void }> = ({
  onAdd,
  onClose,
}) => {
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAdd(url.trim());
    } catch (e) {
      setError(e instanceof ApiError && e.fields?.url ? `Address ${e.fields.url}` : aiMessage(e));
      setBusy(false);
    }
  };
  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="kb-page-title">
      <ModalHeader title="Add web page" labelId="kb-page-title" description="One page; links on it are not followed." />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <FormGroup label="Address" isRequired fieldId="kb-page-url">
            <TextInput id="kb-page-url" type="url" placeholder="https://" value={url} onChange={(_e, v) => setUrl(v)} />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button onClick={add} isDisabled={busy || url.trim() === ''} isLoading={busy}>
          Add
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
