import * as React from 'react';
import { Alert, AlertActionCloseButton, Button, Spinner } from '@patternfly/react-core';
import { getSettings, listTasks } from '@app/api/crm';
import type { Task, TaskTargetType } from '@app/api/crm';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { TaskFormModal } from '@app/Crm/tasks/TaskFormModal';
import { TaskRow } from '@app/Crm/tasks/TaskRow';
import { useTaskActions } from '@app/Crm/tasks/useTaskActions';

const byDue = (a: Task, b: Task) => {
  if ((a.status === 'OPEN') !== (b.status === 'OPEN')) return a.status === 'OPEN' ? -1 : 1;
  const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
  const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
  return da - db;
};

/** The tasks of one record: open ones first by due time; complete, tick, skip, reopen, edit, delete and add. */
export const TaskList: React.FunctionComponent<{ target: { type: TaskTargetType; id: string }; canEdit: boolean }> = ({
  target,
  canEdit,
}) => {
  const { workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const loaded = useLoad(
    (t) => listTasks(t, ws, { targetType: target.type, targetId: target.id, size: 200 }),
    [ws, target.type, target.id],
  );
  const settings = useLoad((t) => getSettings(t, ws), [ws]);
  const [editing, setEditing] = React.useState<{ task?: Task } | null>(null);
  const replace = (saved: Task) => loaded.setData((p) => p && { ...p, items: upsert(p.items, saved) });
  const actions = useTaskActions(
    replace,
    (id) => loaded.setData((p) => p && { ...p, items: p.items.filter((x) => x.id !== id), total: p.total - 1 }),
    loaded.reload,
  );
  useRefetchOnFocus(loaded.reload);

  const tasks = (loaded.data?.items ?? []).slice().sort(byDue);
  const people = tasks.flatMap((t) => (t.assignee ? [t.assignee] : []));
  const typeLabel = (key: string | null) =>
    key ? (settings.data?.taskTypes.find((t) => t.key === key)?.label ?? key) : null;

  if (loaded.loading && !loaded.data) return <Spinner aria-label="Loading tasks" />;
  return (
    <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--sm)' }}>
      {(loaded.error || actions.error) && (
        <Alert variant="danger" isInline isPlain title={loaded.error ?? actions.error} />
      )}
      {actions.notice && (
        <Alert
          variant="info"
          isInline
          isPlain
          title={actions.notice}
          actionClose={<AlertActionCloseButton onClose={actions.clearNotice} />}
        />
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
            <li key={t.id} aria-label={t.title}>
              <TaskRow
                task={t}
                canEdit={canEdit}
                userId={user?.id}
                busy={actions.busyId === t.id}
                typeLabel={typeLabel(t.type)}
                onToggle={(task) => void actions.toggle(task)}
                onTick={(task, itemId, done) => void actions.tick(task, itemId, done)}
                onSkip={actions.skip}
                onEdit={(task) => setEditing({ task })}
                onDelete={(task) => {
                  actions.reset();
                  actions.remove(task);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {actions.dialogs}
      {editing && (
        <TaskFormModal
          target={target}
          task={editing.task}
          taskTypes={settings.data?.taskTypes ?? []}
          people={people}
          onConflict={loaded.reload}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            replace(saved);
          }}
        />
      )}
    </div>
  );
};
