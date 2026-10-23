import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Popover,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { CaptureResult, captureChat, getSettings, listPipelines } from '@app/api/crm';
import type { CrmSettings, Pipeline } from '@app/api/crm';
import { messageFor } from '@app/api/messages';
import { useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { useSession } from '@app/session/SessionContext';

/** "Capture to CRM": asks for the pipeline (only when there is a choice) and an optional deal title, then captures. */
export const CapturePopover: React.FunctionComponent<{
  chatId: string;
  onCaptured(result: CaptureResult): void;
}> = ({ chatId, onCaptured }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { status } = useCrmStatus();
  const access = status?.pipelineAccess ?? [];
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<{ pipelines: Pipeline[]; settings: CrmSettings | null } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tries, setTries] = React.useState(0);
  const [picked, setPicked] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The choices are fetched when the popover is first opened (and again on a retry), never before.
  React.useEffect(() => {
    if (!open || !token || options) return undefined;
    let live = true;
    setLoadError(null);
    Promise.all([listPipelines(token, ws), getSettings(token, ws).catch(() => null)]).then(
      ([pipelines, settings]) => live && setOptions({ pipelines, settings }),
      (e) => live && setLoadError(messageFor(e)),
    );
    return () => {
      live = false;
    };
  }, [open, token, ws, options, tries]);

  const usable = (options?.pipelines ?? []).filter(
    (p) => p.active && (access === 'ALL' || access.includes(p.id)),
  );
  const preferred = options?.settings?.defaultPipelineId;
  const fallback = usable.find((p) => p.id === preferred) ?? usable[0];
  const chosen = usable.find((p) => p.id === picked) ?? fallback;

  const capture = async () => {
    if (!token || !chosen || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body: { chatId: string; pipelineId: string; dealTitle?: string } = { chatId, pipelineId: chosen.id };
      if (title.trim()) body.dealTitle = title.trim();
      const result = await captureChat(token, ws, body);
      setOpen(false);
      onCaptured(result);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const body = loadError ? (
    <Alert
      variant="danger"
      isInline
      isPlain
      title={loadError}
      actionLinks={
        <Button variant="link" isInline onClick={() => setTries((t) => t + 1)}>
          Retry
        </Button>
      }
    />
  ) : !options ? (
    <Spinner size="md" aria-label="Loading pipelines" />
  ) : usable.length === 0 ? (
    <Alert variant="warning" isInline isPlain title="No pipeline is available to capture into." />
  ) : (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        capture();
      }}
    >
      {error && <Alert variant="danger" isInline isPlain title={error} />}
      {usable.length > 1 && (
        <FormGroup label="Pipeline" fieldId="crm-capture-pipeline">
          <FormSelect id="crm-capture-pipeline" value={chosen?.id ?? ''} onChange={(_e, v) => setPicked(v)}>
            {usable.map((p) => (
              <FormSelectOption key={p.id} value={p.id} label={p.name} />
            ))}
          </FormSelect>
        </FormGroup>
      )}
      <FormGroup label="Deal title (optional)" fieldId="crm-capture-title">
        <TextInput id="crm-capture-title" value={title} onChange={(_e, v) => setTitle(v)} />
      </FormGroup>
      <div>
        <Button type="submit" variant="primary" isLoading={busy} isDisabled={busy}>
          Capture
        </Button>{' '}
        <Button variant="link" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Form>
  );

  return (
    <Popover
      aria-label="Capture to CRM"
      isVisible={open}
      shouldOpen={() => setOpen(true)}
      shouldClose={() => setOpen(false)}
      headerContent="Capture to CRM"
      bodyContent={body}
      showClose
    >
      <Button variant="primary">
        Capture to CRM
      </Button>
    </Popover>
  );
};
