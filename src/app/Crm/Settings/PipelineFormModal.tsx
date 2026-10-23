import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { createPipeline, getPipeline, putStages, updatePipeline } from '@app/api/crm';
import type { Pipeline } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { crmMessage } from '@app/Crm/errors';
import { ConflictAlert, isCode } from '@app/Crm/Settings/ConflictAlert';
import { type StageDraft, StageEditor, newDraft, toDrafts, toInputs } from '@app/Crm/Settings/StageEditor';
import { StageRemovalModal } from '@app/Crm/Settings/StageRemovalModal';

const starterLanes = (): StageDraft[] => [
  newDraft(0, 'OPEN', 'New'),
  newDraft(1, 'OPEN', 'Qualified'),
  newDraft(2, 'WON', 'Won'),
  newDraft(3, 'LOST', 'Lost'),
];

/** Creates a pipeline (when {@code pipelineId} is absent) or edits one: name, rotting days and lanes. */
export const PipelineFormModal: React.FunctionComponent<{
  pipelineId?: string;
  readOnly?: boolean;
  onClose(): void;
  onSaved(): void;
}> = ({ pipelineId, readOnly, onClose, onSaved }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad(
    async (t) => (pipelineId ? getPipeline(t, ws, pipelineId) : undefined),
    [ws, pipelineId ?? ''],
  );
  const title = pipelineId ? (readOnly ? 'Pipeline' : 'Edit pipeline') : 'New pipeline';

  return (
    <Modal isOpen variant="large" onClose={onClose} aria-labelledby="pipeline-form-title">
      <ModalHeader title={title} labelId="pipeline-form-title" />
      {pipelineId && !loaded.data ? (
        <ModalBody>
          {loaded.error ? (
            <Alert variant="danger" isInline title={loaded.error} />
          ) : (
            <Spinner aria-label="Loading pipeline" />
          )}
        </ModalBody>
      ) : (
        <PipelineForm
          token={token as string}
          ws={ws}
          pipeline={loaded.data}
          readOnly={readOnly}
          onReload={() => loaded.reload()}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
};

const PipelineForm: React.FunctionComponent<{
  token: string;
  ws: string;
  pipeline?: Pipeline;
  readOnly?: boolean;
  onReload(): void;
  onClose(): void;
  onSaved(): void;
}> = ({ token, ws, pipeline, readOnly, onReload, onClose, onSaved }) => {
  const initial = React.useMemo(() => (pipeline ? toDrafts(pipeline.stages) : starterLanes()), [pipeline]);
  const initialRotting = pipeline?.rottingDays == null ? '' : String(pipeline.rottingDays);
  const [name, setName] = React.useState(pipeline?.name ?? '');
  const [rotting, setRotting] = React.useState(initialRotting);
  const [stages, setStages] = React.useState<StageDraft[]>(initial);
  const [conflict, setConflict] = React.useState(false);
  const [typeBlocked, setTypeBlocked] = React.useState(false);
  const [ask, setAsk] = React.useState<{ stageId: string; count: number } | null>(null);
  const moves = React.useRef<Record<string, string>>({});
  // What the server holds now; advanced by each part of a save that goes through.
  const version = React.useRef(pipeline?.version ?? 0);
  const metaSaved = React.useRef(false);
  const action = useAction();

  // A reload brings a new pipeline: start the form over from it.
  React.useEffect(() => {
    if (!pipeline) return;
    setName(pipeline.name);
    setRotting(pipeline.rottingDays == null ? '' : String(pipeline.rottingDays));
    setStages(toDrafts(pipeline.stages));
    setConflict(false);
    setTypeBlocked(false);
    setAsk(null);
    moves.current = {};
    version.current = pipeline.version;
    metaSaved.current = false;
    action.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline]);

  const rottingOk = rotting === '' || (/^\d+$/.test(rotting) && Number(rotting) >= 1 && Number(rotting) <= 365);
  const nameOk = name.trim() !== '';
  const metaDirty = !!pipeline && !metaSaved.current && (name.trim() !== pipeline.name || rotting !== initialRotting);
  const stagesDirty =
    !pipeline || JSON.stringify(stages) !== JSON.stringify(initial) || Object.keys(moves.current).length > 0;
  const rottingValue = rotting === '' ? 0 : Number(rotting);

  const describe = (e: unknown): string => {
    if (isCode(e, 'VERSION_CONFLICT')) {
      setConflict(true);
      return '';
    }
    if (isCode(e, 'STAGE_TYPE_HAS_DEALS')) {
      setTypeBlocked(true);
      return '';
    }
    if (e instanceof ApiError && e.code === 'STAGE_HAS_DEALS' && e.extra?.stageId) {
      setAsk({ stageId: e.extra.stageId, count: Number(e.extra.count ?? 0) });
      return '';
    }
    if (isCode(e, 'LIMIT_REACHED')) return "Your plan's pipeline limit has been reached.";
    return crmMessage(e, 'Could not save the pipeline. Try again.');
  };

  const save = async () => {
    setConflict(false);
    setTypeBlocked(false);
    const done = await action.run(async () => {
      if (!pipeline) {
        await createPipeline(token, ws, {
          name: name.trim(),
          ...(rotting === '' ? {} : { rottingDays: Number(rotting) }),
          stages: toInputs(stages),
        });
        return true;
      }
      if (metaDirty) {
        const updated = await updatePipeline(token, ws, pipeline.id, {
          name: name.trim(),
          active: pipeline.active,
          isDefault: pipeline.isDefault,
          rottingDays: rottingValue,
          version: version.current,
        });
        version.current = updated.version;
        metaSaved.current = true;
      }
      if (stagesDirty) {
        await putStages(token, ws, pipeline.id, { version: version.current, stages: toInputs(stages, moves.current) });
      }
      return true;
    }, describe);
    if (done) onSaved();
  };

  const removedAsk = ask && stages.find((s) => s.id === ask.stageId);
  const targets = (pipeline?.stages ?? []).filter((s) => stages.some((d) => d.id === s.id && !d.removed));

  return (
    <>
      <ModalBody>
        <Form
          id="pipeline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!readOnly && nameOk && rottingOk) void save();
          }}
        >
          {conflict && <ConflictAlert onReload={onReload} />}
          {typeBlocked && (
            <Alert variant="warning" isInline title="This lane still holds deals, so its type can't change." />
          )}
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          <FormGroup label="Name" isRequired fieldId="pipeline-name">
            <TextInput id="pipeline-name" value={name} isDisabled={readOnly} onChange={(_e, v) => setName(v)} />
          </FormGroup>
          <FormGroup label="Rotting days" fieldId="pipeline-rotting">
            <TextInput
              id="pipeline-rotting"
              type="number"
              min={1}
              max={365}
              value={rotting}
              isDisabled={readOnly}
              validated={rottingOk ? 'default' : 'error'}
              onChange={(_e, v) => setRotting(v)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={rottingOk ? 'default' : 'error'}>
                  Days in a lane before a deal rots, from 1 to 365. Leave empty to use the brand setting.
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <FormGroup label="Lanes" role="group" fieldId="pipeline-lanes">
            <StageEditor stages={stages} onChange={setStages} readOnly={readOnly} />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        {!readOnly && (
          <Button
            variant="primary"
            onClick={() => void save()}
            isDisabled={!nameOk || !rottingOk || action.busy}
            isLoading={action.busy}
          >
            Save
          </Button>
        )}
        <Button variant="link" onClick={onClose}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
      </ModalFooter>
      {ask && removedAsk && (
        <StageRemovalModal
          stageName={removedAsk.name}
          count={ask.count}
          targets={targets}
          busy={action.busy}
          onCancel={() => setAsk(null)}
          onConfirm={(target) => {
            moves.current = { ...moves.current, [ask.stageId]: target };
            setAsk(null);
            void save();
          }}
        />
      )}
    </>
  );
};
