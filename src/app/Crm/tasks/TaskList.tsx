import * as React from 'react';
import { Alert, Button, Checkbox, Label, Spinner } from '@patternfly/react-core';
import { completeTask, deleteTask, getSettings, listTasks, reopenTask } from '@app/api/crm';
import type { Ref, Task, TaskTargetType } from '@app/api/crm';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { crmMessage } from '@app/Crm/errors';
import { TaskFormModal } from '@app/Crm/tasks/TaskFormModal';
import { PRIORITY_LABELS, dueLabel, isOverdue } from '@app/Crm/tasks/taskDisplay';

const byDue = (a: Task, b: Task) => {
  if (a.status !== b.status) return a.status === 'OPEN' ? -1 : 1;
  const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
  const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
  return da - db;
};

/** The tasks of one record: open ones first by due time; complete, reopen, edit, delete and add. */
export const TaskList: React.FunctionComponent<{ target: { type: TaskTargetType; id: string }; canEdit: boolean }> = ({
  target,
  canEdit,
}) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad(
    (t) => listTasks(t, ws, { targetType: target.type, targetId: target.id, size: 200 }),
    [ws, target.type, target.id],
  );
  const settings = useLoad((t) => getSettings(t, ws), [ws]);
  const action = useAction();
  const [editing, setEditing] = React.useState<{ task?: Task } | null>(null);
  const [deleting, setDeleting] = React.useState<Task | null>(null);

  const tasks = (loaded.data?.items ?? []).slice().sort(byDue);
  const people: Ref[] = tasks.flatMap((t) => (t.assignee ? [t.assignee] : []));
  const typeLabel = (key: string | null) =>
    key ? (settings.data?.taskTypes.find((t) => t.key === key)?.label ?? key) : null;
  const replace = (saved: Task) => loaded.setData((p) => p && { ...p, items: upsert(p.items, saved) });

  const toggle = async (task: Task) => {
    const saved = await action.run(
      () => (task.status === 'OPEN' ? completeTask : reopenTask)(token as string, ws, task.id),
      (e) => crmMessage(e, 'Could not update the task. Try again.'),
    );
    if (saved) replace(saved);
  };

  const remove = async () => {
    if (!deleting) return;
    const done = await action.run(async () => {
      await deleteTask(token as string, ws, deleting.id);
      return true;
    });
    if (done) {
      loaded.setData((p) => p && { ...p, items: p.items.filter((x) => x.id !== deleting.id), total: p.total - 1 });
      setDeleting(null);
    }
  };

  if (loaded.loading && !loaded.data) return <Spinner aria-label="Loading tasks" />;
  return (
    <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--sm)' }}>
      {(loaded.error || (action.error && !deleting)) && (
        <Alert variant="danger" isInline isPlain title={loaded.error ?? action.error} />
      )}
      {canEdit && (
        <div>
          <Button variant="secondary" onClick={() => setEditing({})}>
            Add task
          </Button>
        </div>
      )}
      {tasks.length === 0 ? (
        <p className="pf-v6-u-color-200">No tasks yet.</p>
      ) : (
        <ul
          aria-label="Tasks"
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--pf-t--global--spacer--sm)' }}
        >
          {tasks.map((t) => (
            <li
              key={t.id}
              aria-label={t.title}
              style={{
                display: 'flex',
                gap: 'var(--pf-t--global--spacer--sm)',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              {t.status === 'OPEN' ? (
                <Checkbox
                  id={`crm-task-done-${t.id}`}
                  aria-label={`Complete ${t.title}`}
                  isChecked={false}
                  isDisabled={!canEdit || action.busy}
                  onChange={() => void toggle(t)}
                />
              ) : null}
              <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                <div
                  style={{ textDecoration: t.status === 'DONE' ? 'line-through' : undefined, overflowWrap: 'anywhere' }}
                >
                  {t.title}
                </div>
                <small
                  style={{
                    color: isOverdue(t)
                      ? 'var(--pf-t--global--text--color--status--danger--default)'
                      : 'var(--pf-t--global--text--color--subtle)',
                  }}
                >
                  {t.status === 'DONE' ? 'Done' : dueLabel(t.dueAt)}
                  {typeLabel(t.type) && ` · ${typeLabel(t.type)}`}
                  {t.assignee && ` · ${t.assignee.name}`}
                </small>
              </div>
              {t.priority === 'HIGH' && (
                <Label isCompact color="red">
                  {PRIORITY_LABELS.HIGH}
                </Label>
              )}
              {canEdit && t.status === 'DONE' && (
                <Button variant="link" isInline aria-label={`Reopen ${t.title}`} onClick={() => void toggle(t)}>
                  Reopen
                </Button>
              )}
              {canEdit && (
                <>
                  <Button
                    variant="link"
                    isInline
                    aria-label={`Edit ${t.title}`}
                    onClick={() => setEditing({ task: t })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="link"
                    isInline
                    isDanger
                    aria-label={`Delete ${t.title}`}
                    onClick={() => {
                      action.reset();
                      setDeleting(t);
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TaskFormModal
          target={target}
          task={editing.task}
          taskTypes={settings.data?.taskTypes ?? []}
          people={people}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            replace(saved);
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.title}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={action.busy}
          error={action.error}
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        >
          The task is removed for everyone. It can&apos;t be undone.
        </ConfirmModal>
      )}
    </div>
  );
};
