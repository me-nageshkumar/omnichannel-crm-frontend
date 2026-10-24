import * as React from 'react';
import {
  Alert,
  Button,
  DataList,
  DataListAction,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Dropdown,
  DropdownItem,
  DropdownList,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Label,
  MenuToggle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tooltip,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { deletePipeline, listPipelines, updatePipeline } from '@app/api/crm';
import type { Pipeline } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { crmMessage } from '@app/Crm/errors';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { ConflictAlert, isCode } from '@app/Crm/Settings/ConflictAlert';
import { PipelineFormModal } from '@app/Crm/Settings/PipelineFormModal';

const deals = (n: number) => `${n} ${n === 1 ? 'deal' : 'deals'}`;

const RowActions: React.FunctionComponent<{
  pipeline: Pipeline;
  canManage: boolean;
  onEdit(): void;
  onToggleDefault(): void;
  onToggleActive(): void;
  onDelete(): void;
}> = ({ pipeline, canManage, onEdit, onToggleDefault, onToggleActive, onDelete }) => {
  const [open, setOpen] = React.useState(false);
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <Dropdown
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={() => setOpen(false)}
      popperProps={{ position: 'right' }}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          variant="plain"
          aria-label={`Actions for ${pipeline.name}`}
          isExpanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <EllipsisVIcon />
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem key="edit" onClick={pick(onEdit)}>
          {canManage ? 'Edit' : 'View'}
        </DropdownItem>
        {canManage && !pipeline.isDefault && pipeline.active && (
          <DropdownItem key="default" onClick={pick(onToggleDefault)}>
            Make default
          </DropdownItem>
        )}
        {canManage && !pipeline.isDefault && (
          <DropdownItem key="active" onClick={pick(onToggleActive)}>
            {pipeline.active ? 'Deactivate' : 'Activate'}
          </DropdownItem>
        )}
        {canManage && (
          <DropdownItem key="delete" onClick={pick(onDelete)}>
            Delete
          </DropdownItem>
        )}
      </DropdownList>
    </Dropdown>
  );
};

/** Asks where the deals of a pipeline being deleted go. */
const MoveDealsModal: React.FunctionComponent<{
  pipeline: Pipeline;
  count: number;
  targets: Pipeline[];
  busy: boolean;
  error: string | null;
  onConfirm(targetId: string): void;
  onCancel(): void;
}> = ({ pipeline, count, targets, busy, error, onConfirm, onCancel }) => {
  const [target, setTarget] = React.useState('');
  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="move-deals-title">
      <ModalHeader title="Move deals before deleting" labelId="move-deals-title" titleIconVariant="warning" />
      <ModalBody>
        {error && <Alert variant="danger" isInline isPlain title={error} className="pf-v6-u-mb-md" />}
        <p className="pf-v6-u-mb-md">
          {pipeline.name} still holds {deals(count)}. Choose the pipeline they move to; each deal goes to the first lane
          of that pipeline.
        </p>
        <FormGroup label="Move deals to" fieldId="move-deals-target">
          <FormSelect id="move-deals-target" value={target} onChange={(_e, v) => setTarget(v)}>
            <FormSelectOption value="" label="Choose a pipeline" isPlaceholder />
            {targets.map((t) => (
              <FormSelectOption key={t.id} value={t.id} label={t.name} />
            ))}
          </FormSelect>
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button variant="danger" isDisabled={!target || busy} isLoading={busy} onClick={() => onConfirm(target)}>
          Move deals and delete
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export const PipelinesSettings: React.FunctionComponent<{ canManage: boolean }> = ({ canManage }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { status } = useCrmStatus();
  const loaded = useLoad((t) => listPipelines(t, ws), [ws]);
  const action = useAction();
  const [editing, setEditing] = React.useState<{ id?: string } | null>(null);
  const [deleting, setDeleting] = React.useState<Pipeline | null>(null);
  const [conflict, setConflict] = React.useState(false);
  const [moveCount, setMoveCount] = React.useState<number | null>(null);

  const pipelines = loaded.data ?? [];
  const max = status?.limits.maxPipelines ?? null;
  const atLimit = max !== null && pipelines.length >= max;

  const change = async (p: Pipeline, patch: { isDefault?: boolean; active?: boolean }) => {
    // Every update carries the whole pipeline, so nothing it does not mention is changed.
    const ok = await action.run(
      () =>
        updatePipeline(token as string, ws, p.id, {
          name: p.name,
          active: p.active,
          isDefault: p.isDefault,
          rottingDays: p.rottingDays,
          version: p.version,
          ...patch,
        }),
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) {
          setConflict(true);
          return '';
        }
        return crmMessage(e, 'Could not update the pipeline. Try again.');
      },
    );
    if (ok) loaded.reload();
  };

  const closeDelete = () => {
    setDeleting(null);
    setMoveCount(null);
    action.reset();
  };

  const remove = async (moveTo?: string) => {
    if (!deleting) return;
    const done = await action.run(
      async () => {
        await deletePipeline(token as string, ws, deleting.id, moveTo);
        return true;
      },
      (e) => {
        if (!moveTo && e instanceof ApiError && e.code === 'PIPELINE_HAS_DEALS') {
          setMoveCount(Number(e.extra?.count ?? 0));
          return '';
        }
        return 'Could not delete the pipeline. Try again.';
      },
    );
    if (done) {
      closeDelete();
      loaded.reload();
    }
  };

  const newButton = (
    <Button variant="primary" isAriaDisabled={atLimit} onClick={() => !atLimit && setEditing({})}>
      New pipeline
    </Button>
  );

  return (
    <>
      <div className="pf-v6-u-my-md">
        {canManage &&
          (atLimit ? <Tooltip content={`Your plan allows ${max} pipelines`}>{newButton}</Tooltip> : newButton)}
      </div>
      {conflict && (
        <div className="pf-v6-u-mb-md">
          <ConflictAlert
            onReload={() => {
              setConflict(false);
              loaded.reload();
            }}
          />
        </div>
      )}
      {(loaded.error || (action.error && !deleting)) && (
        <Alert variant="danger" isInline title={loaded.error ?? action.error} className="pf-v6-u-mb-md" />
      )}
      {loaded.loading && !loaded.data ? (
        <Spinner aria-label="Loading pipelines" />
      ) : (
        <DataList aria-label="Pipelines" isCompact>
          {pipelines.map((p) => (
            <DataListItem key={p.id} aria-labelledby={`pipeline-${p.id}`}>
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key="name">
                      <strong id={`pipeline-${p.id}`}>{p.name}</strong>{' '}
                      {p.isDefault && (
                        <Label isCompact color="blue">
                          Default
                        </Label>
                      )}{' '}
                      {!p.active && (
                        <Label isCompact color="grey">
                          Inactive
                        </Label>
                      )}
                    </DataListCell>,
                    <DataListCell key="lanes" width={2}>
                      {p.stages.length} {p.stages.length === 1 ? 'lane' : 'lanes'}
                    </DataListCell>,
                  ]}
                />
                <DataListAction aria-label="Actions" aria-labelledby={`pipeline-${p.id}`} id={`actions-${p.id}`}>
                  <RowActions
                    pipeline={p}
                    canManage={canManage}
                    onEdit={() => setEditing({ id: p.id })}
                    onToggleDefault={() => void change(p, { isDefault: true })}
                    onToggleActive={() => void change(p, { active: !p.active })}
                    onDelete={() => {
                      action.reset();
                      setDeleting(p);
                    }}
                  />
                </DataListAction>
              </DataListItemRow>
            </DataListItem>
          ))}
        </DataList>
      )}
      {editing && (
        <PipelineFormModal
          pipelineId={editing.id}
          readOnly={!canManage}
          onClose={() => {
            setEditing(null);
            // A save may have gone through in part before it was cancelled.
            loaded.reload();
          }}
          onSaved={() => {
            setEditing(null);
            loaded.reload();
          }}
        />
      )}
      {deleting && moveCount === null && (
        <ConfirmModal
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={action.busy}
          error={action.error}
          onConfirm={() => void remove()}
          onCancel={closeDelete}
        >
          This removes the pipeline and its lanes. It can&apos;t be undone.
        </ConfirmModal>
      )}
      {deleting && moveCount !== null && (
        <MoveDealsModal
          pipeline={deleting}
          count={moveCount}
          targets={pipelines.filter((p) => p.active && p.id !== deleting.id)}
          busy={action.busy}
          error={action.error}
          onConfirm={(t) => void remove(t)}
          onCancel={closeDelete}
        />
      )}
    </>
  );
};
