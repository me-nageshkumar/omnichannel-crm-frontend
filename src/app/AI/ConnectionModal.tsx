import * as React from 'react';
import {
  Alert,
  Button,
  Content,
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
  TextInput,
} from '@patternfly/react-core';
import { type AiConnection, type AiProvider, createAiConnection, saveAiConnection } from '@app/api/ai';
import { ApiError } from '@app/api/client';
import { useSession } from '@app/session/SessionContext';
import { SecretField } from '@app/AI/SecretField';
import { aiMessage, isSecretsUnavailable } from '@app/AI/aiMessages';

/** Adds a connection, or edits one (`connection` set): a blank key on edit keeps the stored one. */
export const ConnectionModal: React.FunctionComponent<{
  providers: AiProvider[];
  connection: AiConnection | null;
  onSaved(saved: AiConnection): void;
  onClose(): void;
}> = ({ providers, connection, onSaved, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [provider, setProvider] = React.useState(connection?.provider ?? providers[0]?.id ?? '');
  const [name, setName] = React.useState(connection?.name ?? '');
  const [apiKey, setApiKey] = React.useState('');
  const [settings, setSettings] = React.useState<Record<string, string>>(connection?.settings ?? {});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  // A new provider needs a new key: the stored one belongs to the old provider.
  const keyHint = connection && provider === connection.provider ? connection.keyHint : null;
  // The plain settings the selected provider declares; values typed for another provider are kept but not sent.
  const declared = providers.find((p) => p.id === provider)?.connectionFields ?? [];
  const sent: Record<string, string> = {};
  for (const f of declared) {
    const v = (settings[f.key] ?? '').trim();
    if (v !== '') sent[f.key] = v;
  }
  const missingLabels = declared.filter((f) => f.required && !(f.key in sent)).map((f) => f.label);
  const missing = missingLabels.length > 0;

  const save = async () => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const body = { name: name.trim(), provider, apiKey: apiKey === '' ? undefined : apiKey, settings: sent };
      const saved = connection
        ? await saveAiConnection(token as string, ws, connection.id, { ...body, version: connection.version })
        : await createAiConnection(token as string, ws, body);
      setApiKey('');
      onSaved(saved);
    } catch (e) {
      if (isSecretsUnavailable(e)) setFields({ apiKey: aiMessage(e) });
      else if (e instanceof ApiError && e.code === 'VALIDATION' && e.fields) setFields(e.fields);
      else if (e instanceof ApiError && e.code === 'DUPLICATE')
        setFields({ name: 'Another connection has this name.' });
      else setError(aiMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = connection ? 'Edit connection' : 'Add connection';
  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="ai-connection-title">
      <ModalHeader title={title} labelId="ai-connection-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        <Form id="ai-connection-form" onSubmit={(e) => e.preventDefault()}>
          <FormGroup label="Provider" fieldId="ai-connection-provider" isRequired>
            <FormSelect
              id="ai-connection-provider"
              value={provider}
              onChange={(_e, v) => setProvider(v)}
              aria-label="Provider"
            >
              {providers.map((p) => (
                <FormSelectOption key={p.id} value={p.id} label={p.label} />
              ))}
            </FormSelect>
            <FieldError error={fields.provider} />
            {provider === 'openai' && (
              <Content component="small">OpenAI keeps stored responses for 30 days in your OpenAI account.</Content>
            )}
          </FormGroup>
          <FormGroup label="Name" fieldId="ai-connection-name" isRequired>
            <TextInput
              id="ai-connection-name"
              value={name}
              validated={fields.name ? 'error' : 'default'}
              onChange={(_e, v) => setName(v)}
            />
            <FieldError error={fields.name} />
          </FormGroup>
          <SecretField
            id="ai-connection-key"
            label="API key"
            hint={keyHint}
            setAt={keyHint ? (connection?.keySetAt ?? null) : null}
            value={apiKey}
            onChange={setApiKey}
            isRequired
            error={fields.apiKey}
          />
          {declared.map((f) => (
            <FormGroup key={f.key} label={f.label} fieldId={`ai-connection-setting-${f.key}`} isRequired={f.required}>
              <TextInput
                id={`ai-connection-setting-${f.key}`}
                type="text"
                isRequired={f.required}
                value={settings[f.key] ?? ''}
                validated={fields[`settings.${f.key}`] ? 'error' : 'default'}
                onChange={(_e, v) => setSettings((cur) => ({ ...cur, [f.key]: v }))}
              />
              {f.help && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{f.help}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
              <FieldError error={fields[`settings.${f.key}`]} />
            </FormGroup>
          ))}
        </Form>
        {missing && <Content component="small">Fill in {missingLabels.join(', ')} to save.</Content>}
      </ModalBody>
      <ModalFooter>
        <Button onClick={save} isDisabled={busy || name.trim() === '' || missing} isLoading={busy}>
          Save
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export const FieldError: React.FunctionComponent<{ error?: string }> = ({ error }) =>
  error ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{error}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;
