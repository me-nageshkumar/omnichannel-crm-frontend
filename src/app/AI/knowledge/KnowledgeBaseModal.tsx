import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import type { AiConnection, AiProvider } from '@app/api/ai';
import { type KnowledgeBase, createKnowledgeBase, saveKnowledgeBase } from '@app/api/aiKnowledge';
import { ApiError } from '@app/api/client';
import { useSession } from '@app/session/SessionContext';
import { aiMessage } from '@app/AI/aiMessages';

/** Creates a knowledge base on one of the brand's connections, or renames one (`base` set). */
export const KnowledgeBaseModal: React.FunctionComponent<{
  base: KnowledgeBase | null;
  providers: AiProvider[];
  connections: AiConnection[];
  onSaved(saved: KnowledgeBase): void;
  onClose(): void;
}> = ({ base, providers, connections, onSaved, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const usable = connections.filter((c) => providers.find((p) => p.id === c.provider)?.knowledgeBases);
  const [name, setName] = React.useState(base?.name ?? '');
  const [description, setDescription] = React.useState(base?.description ?? '');
  const [connectionId, setConnectionId] = React.useState(base?.connectionId ?? usable[0]?.id ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  const save = async () => {
    setBusy(true);
    setError(null);
    setFields({});
    const desc = description.trim() === '' ? null : description.trim();
    try {
      const saved = base
        ? await saveKnowledgeBase(token as string, ws, base.id, {
            name: name.trim(),
            description: desc,
            version: base.version,
          })
        : await createKnowledgeBase(token as string, ws, { name: name.trim(), description: desc, connectionId });
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VALIDATION' && e.fields) setFields(e.fields);
      else if (e instanceof ApiError && e.code === 'DUPLICATE')
        setFields({ name: 'Another knowledge base has this name.' });
      else setError(aiMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (key: string) =>
    fields[key] ? (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant="error">{fields[key]}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    ) : null;

  const noConnection = !base && usable.length === 0;
  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="kb-modal-title">
      <ModalHeader title={base ? 'Rename knowledge base' : 'New knowledge base'} labelId="kb-modal-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        {noConnection && (
          <Alert variant="info" isInline title="Add an OpenAI connection first">
            <Link to="/ai">Go to Connections</Link>
          </Alert>
        )}
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <FormGroup label="Name" isRequired fieldId="kb-name">
            <TextInput id="kb-name" value={name} onChange={(_e, v) => setName(v)} isRequired />
            {fieldError('name')}
          </FormGroup>
          <FormGroup label="Description" fieldId="kb-description">
            <TextArea id="kb-description" value={description} onChange={(_e, v) => setDescription(v)} rows={2} />
          </FormGroup>
          {!base && !noConnection && (
            <FormGroup label="Connection" fieldId="kb-connection">
              <FormSelect id="kb-connection" value={connectionId} onChange={(_e, v) => setConnectionId(v)}>
                {usable.map((c) => (
                  <FormSelectOption key={c.id} value={c.id} label={c.name} />
                ))}
              </FormSelect>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{"The knowledge base lives in this key's account and stays on it."}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button onClick={save} isDisabled={busy || name.trim() === '' || noConnection} isLoading={busy}>
          {base ? 'Save' : 'Create'}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
