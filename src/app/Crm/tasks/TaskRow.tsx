import * as React from 'react';
import { Button, Checkbox, Label } from '@patternfly/react-core';
import { OutlinedCheckSquareIcon, StepForwardIcon, SyncAltIcon } from '@patternfly/react-icons';
import type { Task } from '@app/api/crm';
import { personName } from '@app/Crm/personName';
import {
  PRIORITY_LABELS,
  canWorkTask,
  checklistProgress,
  dueLabel,
  isDelegatedToMe,
  isOverdue,
  recurrenceSummary,
} from '@app/Crm/tasks/taskDisplay';

const subtle = 'var(--pf-t--global--text--color--subtle)';
const danger = 'var(--pf-t--global--text--color--status--danger--default)';

/**
 * One task, the same in the drawers and on the Tasks page (spec E C15): complete/reopen, title, due, assignee,
 * "from <name>" when handed to me, repeat mark, steps progress that expands to tick, priority, Skipped; skip, edit and
 * delete by rights. The assignee may complete, tick and skip their own task without edit rights.
 */
export const TaskRow: React.FunctionComponent<{
  task: Task;
  canEdit: boolean;
  userId: string | undefined;
  busy: boolean;
  typeLabel?: string | null;
  onToggle(task: Task): void;
  onTick(task: Task, itemId: string, done: boolean): void;
  onSkip?(task: Task): void;
  onEdit?(task: Task): void;
  onDelete?(task: Task): void;
  /** Extra marks after the meta line (the Tasks page's record link and assignee). */
  extra?: React.ReactNode;
}> = ({ task, canEdit, userId, busy, typeLabel, onToggle, onTick, onSkip, onEdit, onDelete, extra }) => {
  const [stepsOpen, setStepsOpen] = React.useState(false);
  const canWork = canWorkTask(task, canEdit, userId);
  const open = task.status === 'OPEN';
  const progress = checklistProgress(task);
  const repeat = recurrenceSummary(task.recurrence);
  return (
    <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--xs)', minWidth: 0 }}>
      <div
        style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', alignItems: 'flex-start', flexWrap: 'wrap' }}
      >
        {open && (
          <Checkbox
            id={`crm-task-done-${task.id}`}
            aria-label={`Complete ${task.title}`}
            isChecked={false}
            isDisabled={!canWork || busy}
            onChange={() => onToggle(task)}
          />
        )}
        <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
          <div style={{ textDecoration: open ? undefined : 'line-through', overflowWrap: 'anywhere' }}>
            {task.title}
          </div>
          <small
            style={{
              color: isOverdue(task) ? danger : subtle,
              display: 'inline-flex',
              gap: '0.35em',
              flexWrap: 'wrap',
            }}
          >
            <span>
              {task.status === 'DONE' ? 'Done' : task.status === 'CANCELLED' ? 'Not done' : dueLabel(task.dueAt)}
            </span>
            {typeLabel && <span>· {typeLabel}</span>}
            {task.assignee && <span>· {personName(task.assignee)}</span>}
            {isDelegatedToMe(task, userId) && task.assignedBy && <span>· from {personName(task.assignedBy)}</span>}
            {repeat && (
              <span role="img" aria-label={repeat} title={repeat} style={{ display: 'inline-flex' }}>
                <SyncAltIcon />
              </span>
            )}
          </small>
        </div>
        {progress.total > 0 && (
          <Button
            variant="link"
            isInline
            icon={<OutlinedCheckSquareIcon />}
            aria-expanded={stepsOpen}
            onClick={() => setStepsOpen((v) => !v)}
          >
            {`${progress.done}/${progress.total}`}
          </Button>
        )}
        {task.priority !== 'NORMAL' && (
          <Label isCompact color={task.priority === 'HIGH' ? 'red' : 'grey'}>
            {PRIORITY_LABELS[task.priority]}
          </Label>
        )}
        {task.status === 'CANCELLED' && <Label isCompact>Skipped</Label>}
        {extra}
        {canWork && onSkip && open && task.recurrence && (
          <Button
            variant="link"
            isInline
            icon={<StepForwardIcon />}
            aria-label={`Skip ${task.title}`}
            isDisabled={busy}
            onClick={() => onSkip(task)}
          >
            Skip
          </Button>
        )}
        {canWork && task.status === 'DONE' && (
          <Button
            variant="link"
            isInline
            aria-label={`Reopen ${task.title}`}
            isDisabled={busy}
            onClick={() => onToggle(task)}
          >
            Reopen
          </Button>
        )}
        {canEdit && onEdit && (
          <Button variant="link" isInline aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
            Edit
          </Button>
        )}
        {canEdit && onDelete && (
          <Button variant="link" isInline isDanger aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>
            Delete
          </Button>
        )}
      </div>
      {stepsOpen && progress.total > 0 && (
        <div
          style={{
            display: 'grid',
            gap: 'var(--pf-t--global--spacer--xs)',
            paddingInlineStart: 'var(--pf-t--global--spacer--xl)',
          }}
        >
          {task.checklist.map((item) => (
            <Checkbox
              key={item.id}
              id={`crm-step-${task.id}-${item.id}`}
              label={<span style={{ textDecoration: item.done ? 'line-through' : undefined }}>{item.text}</span>}
              isChecked={item.done}
              isDisabled={!canWork || busy || !open}
              onChange={(_e, checked) => onTick(task, item.id, checked)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
