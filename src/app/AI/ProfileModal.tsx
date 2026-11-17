import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import {
  type AiConnection,
  type AiModel,
  type AiProfile,
  type AiProfileSave,
  type AiProvider,
  type AiVectorStore,
  createAiProfile,
  listAiModels,
  listAiVectorStores,
  listMcpTools,
  saveAiProfile,
} from '@app/api/ai';
import { ApiError } from '@app/api/client';
import { useSession } from '@app/session/SessionContext';
import { FieldError } from '@app/AI/ConnectionModal';
import { type McpRow, McpServersFields, rowOf, toolsOf } from '@app/AI/McpServersFields';
import { profileProblems } from '@app/AI/profileProblems';
import { aiMessage } from '@app/AI/aiMessages';

const num = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** Adds or edits a profile; the fields shown follow what the selected connection's provider supports. */
export const ProfileModal: React.FunctionComponent<{
  providers: AiProvider[];
  connections: AiConnection[];
  profile: AiProfile | null;
  onSaved(saved: AiProfile): void;
  onClose(): void;
}> = ({ providers, connections, profile, onSaved, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [name, setName] = React.useState(profile?.name ?? '');
  const [connectionId, setConnectionId] = React.useState(profile?.connectionId ?? connections[0]?.id ?? '');
  const [model, setModel] = React.useState(profile?.model ?? '');
  const [instructions, setInstructions] = React.useState(profile?.instructions ?? '');
  const [effort, setEffort] = React.useState(profile?.reasoningEffort ?? '');
  const [maxTokens, setMaxTokens] = React.useState(profile?.maxOutputTokens?.toString() ?? '');
  const [temperature, setTemperature] = React.useState(profile?.temperature?.toString() ?? '');
  const [webSearch, setWebSearch] = React.useState(profile?.webSearch ?? false);
  const [stores, setStores] = React.useState<string[]>(profile?.vectorStoreIds ?? []);
  const [rows, setRows] = React.useState<McpRow[]>((profile?.mcpServers ?? []).map(rowOf));
  const [models, setModels] = React.useState<AiModel[]>([]);
  const [storeList, setStoreList] = React.useState<AiVectorStore[] | null>(null);
  const [storeError, setStoreError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  const connection = connections.find((c) => c.id === connectionId) ?? null;
  const provider = providers.find((p) => p.id === connection?.provider) ?? null;
  const caps = provider?.capabilities ?? null;
  // Yes/no capabilities only: an empty effort list is still truthy, so the list has its own check below.
  const shows = (flag: 'temperature' | 'webSearch' | 'vectorStores' | 'hostedMcp') =>
    caps == null || Boolean(caps[flag]);
  // The provider's effort values; a stored value outside the list stays visible so it can be changed.
  const listed = caps?.reasoningEfforts ?? [];
  const takesEffort = caps == null || listed.length > 0;
  const efforts = effort !== '' && !listed.includes(effort) ? [...listed, effort] : listed;

  React.useEffect(() => {
    if (!connectionId || !token) return;
    let live = true;
    listAiModels(token, ws, connectionId)
      .then((m) => live && setModels(m))
      .catch(() => live && setModels([]));
    return () => {
      live = false;
    };
  }, [token, ws, connectionId]);

  const loadStores = React.useCallback(async () => {
    if (!connectionId || !token) return;
    setStoreError(null);
    try {
      setStoreList(await listAiVectorStores(token, ws, connectionId));
    } catch (e) {
      setStoreError(aiMessage(e));
    }
  }, [token, ws, connectionId]);

  React.useEffect(() => {
    setStoreList(null);
    if (shows('vectorStores')) loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, caps?.vectorStores]);

  // What the provider cannot do is not sent: hidden fields are dropped, so switching connection never keeps them.
  const save: AiProfileSave = {
    name: name.trim(),
    connectionId,
    model: model.trim(),
    instructions: instructions.trim() === '' ? null : instructions,
    reasoningEffort: takesEffort && effort !== '' ? effort : null,
    maxOutputTokens: num(maxTokens),
    temperature: shows('temperature') ? num(temperature) : null,
    webSearch: shows('webSearch') && webSearch,
    vectorStoreIds: shows('vectorStores') ? stores : [],
    mcpServers: rows.map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      label: r.label.trim(),
      url: r.url.trim(),
      connectBy: r.connectBy,
      auth: r.auth,
      headerName: r.auth === 'HEADER' ? r.headerName.trim() : null,
      ...(r.auth !== 'NONE' && r.secret.trim() !== '' ? { secret: r.secret } : {}),
      allowedTools: toolsOf(r),
    })),
    version: profile?.version,
  };
  const problems = profileProblems(save, caps);
  const errors = { ...fields, ...problems };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const saved = profile
        ? await saveAiProfile(token as string, ws, profile.id, save)
        : await createAiProfile(token as string, ws, save);
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VALIDATION' && e.fields) setFields(e.fields);
      else if (e instanceof ApiError && e.code === 'DUPLICATE') setFields({ name: 'Another profile has this name.' });
      else setError(aiMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = profile ? 'Edit profile' : 'Add profile';
  const blocked = Object.keys(problems).length > 0 || name.trim() === '' || model.trim() === '' || !connectionId;
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="ai-profile-title">
      <ModalHeader title={title} labelId="ai-profile-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} />}
        <Form id="ai-profile-form" onSubmit={(e) => e.preventDefault()}>
          <FormGroup label="Name" fieldId="ai-profile-name" isRequired>
            <TextInput
              id="ai-profile-name"
              value={name}
              onChange={(_e, v) => setName(v)}
              validated={errors.name ? 'error' : 'default'}
            />
            <FieldError error={errors.name} />
          </FormGroup>
          <FormGroup label="Connection" fieldId="ai-profile-connection" isRequired>
            <FormSelect id="ai-profile-connection" value={connectionId} onChange={(_e, v) => setConnectionId(v)}>
              {connections.map((c) => (
                <FormSelectOption
                  key={c.id}
                  value={c.id}
                  label={`${c.name} (${providers.find((p) => p.id === c.provider)?.label ?? c.provider})`}
                />
              ))}
            </FormSelect>
            <FieldError error={errors.connectionId} />
          </FormGroup>
          <FormGroup label="Model" fieldId="ai-profile-model" isRequired>
            <TextInput
              id="ai-profile-model"
              value={model}
              list="ai-profile-models"
              placeholder="Pick from the list or type a model name"
              onChange={(_e, v) => setModel(v)}
              validated={errors.model ? 'error' : 'default'}
            />
            <datalist id="ai-profile-models">
              {models.map((m) => (
                <option key={m.id} value={m.id} />
              ))}
            </datalist>
            <FieldError error={errors.model} />
          </FormGroup>
          <FormGroup label="Instructions" fieldId="ai-profile-instructions">
            <TextArea
              id="ai-profile-instructions"
              value={instructions}
              rows={6}
              placeholder="The system prompt: who the assistant is, what it may and may not do."
              onChange={(_e, v) => setInstructions(v)}
              validated={errors.instructions ? 'error' : 'default'}
            />
            <FieldError error={errors.instructions} />
          </FormGroup>
          {takesEffort && (
            <FormGroup label="Reasoning effort" fieldId="ai-profile-effort">
              <FormSelect id="ai-profile-effort" value={effort} onChange={(_e, v) => setEffort(v)}>
                <FormSelectOption value="" label="Provider default" />
                {efforts.map((x) => (
                  <FormSelectOption key={x} value={x} label={x} />
                ))}
              </FormSelect>
              <FieldError error={errors.reasoningEffort} />
            </FormGroup>
          )}
          <FormGroup label="Max output tokens" fieldId="ai-profile-max">
            <TextInput
              id="ai-profile-max"
              type="number"
              value={maxTokens}
              placeholder="Provider default"
              onChange={(_e, v) => setMaxTokens(v)}
              validated={errors.maxOutputTokens ? 'error' : 'default'}
            />
            <FieldError error={errors.maxOutputTokens} />
          </FormGroup>
          {shows('temperature') && (
            <FormGroup label="Temperature" fieldId="ai-profile-temperature">
              <TextInput
                id="ai-profile-temperature"
                type="number"
                value={temperature}
                placeholder="Provider default"
                onChange={(_e, v) => setTemperature(v)}
                validated={errors.temperature ? 'error' : 'default'}
              />
              <FieldError error={errors.temperature} />
            </FormGroup>
          )}
          {shows('webSearch') && (
            <FormGroup fieldId="ai-profile-web">
              <Checkbox
                id="ai-profile-web"
                label="Web search"
                isChecked={webSearch}
                onChange={(_e, v) => setWebSearch(v)}
              />
              <FieldError error={errors.webSearch} />
            </FormGroup>
          )}
          {shows('vectorStores') && (
            <FormGroup role="group" aria-label="Knowledge" label="Knowledge" fieldId="ai-profile-stores">
              {storeError && <Alert variant="warning" isInline isPlain title={storeError} />}
              {(storeList ?? []).map((v) => (
                <Checkbox
                  key={v.id}
                  id={`ai-store-${v.id}`}
                  label={`${v.name ?? v.id} (${v.fileCount} files)`}
                  isChecked={stores.includes(v.id)}
                  onChange={(_e, on) => setStores(on ? [...stores, v.id] : stores.filter((x) => x !== v.id))}
                />
              ))}
              {storeList && storeList.length === 0 && <span>This key sees no vector stores.</span>}
              <Button variant="link" isInline onClick={loadStores}>
                Refresh
              </Button>
              <FieldError error={errors.vectorStoreIds} />
            </FormGroup>
          )}
          <McpServersFields
            rows={rows}
            onChange={setRows}
            caps={caps}
            providerLabel={provider?.label ?? 'This provider'}
            errors={errors}
            loadTools={profile ? (serverId) => listMcpTools(token as string, ws, profile.id, serverId) : undefined}
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button onClick={submit} isDisabled={busy || blocked} isLoading={busy}>
          Save
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
