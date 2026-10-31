import * as React from 'react';
import { completeTask, deleteTask, reopenTask, skipTask, tickChecklistItem } from '@app/api/crm';
import type { Task } from '@app/api/crm';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { crmMessage } from '@app/Crm/errors';
import { checklistProgress } from '@app/Crm/tasks/taskDisplay';

interface Confirm {
  title: string;
  body: string;
  label: string;
  variant?: 'primary' | 'danger';
  run(): Promise<void>;
}

/**
 * The task actions shared by the drawers and the Tasks page (spec E C10, C14, C15): complete (asking first when steps
 * are unticked), reopen, tick (offering to complete after the last step), skip (confirmed) and delete (confirmed).
 * {@code onChanged} gets every task the server returned; {@code onRemoved} the id of a deleted task;
 * {@code onScheduled} fires when a next occurrence was created (it is not in the response of complete). Render
 * {@code dialogs} once near the list.
 */
export function useTaskActions(
  onChanged: (task: Task) => void,
  onRemoved?: (id: string) => void,
  /** Runs when completing or skipping scheduled a next occurrence, so the list can fetch the new task. */
  onScheduled?: () => void,
) {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const action = useAction();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<Confirm | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const run = async <T,>(task: Task, fn: (t: string) => Promise<T>): Promise<T | undefined> => {
    setBusyId(task.id);
    try {
      return await action.run(
        () => fn(token as string),
        (e) => crmMessage(e, 'Could not update the task. Try again.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (task: Task) => {
    const saved = await run(task, (t) => completeTask(t, ws, task.id));
    if (!saved) return;
    onChanged(saved);
    if (saved.nextOccurrenceId && !task.nextOccurrenceId) onScheduled?.();
  };

  const toggle = async (task: Task) => {
    if (task.status === 'DONE') {
      const saved = await run(task, (t) => reopenTask(t, ws, task.id));
      if (saved) onChanged(saved);
      return;
    }
    const { done, total } = checklistProgress(task);
    if (total > done) {
      const open = total - done;
      setConfirm({
        title: 'Mark the task done?',
        body: `${open} ${open === 1 ? 'step is' : 'steps are'} not ticked yet.`,
        label: 'Mark done',
        run: () => complete(task),
      });
      return;
    }
    await complete(task);
  };

  const tick = async (task: Task, itemId: string, done: boolean) => {
    const saved = await run(task, (t) => tickChecklistItem(t, ws, task.id, itemId, done));
    if (!saved) return;
    onChanged(saved);
    const progress = checklistProgress(saved);
    if (done && progress.total > 0 && progress.done === progress.total) {
      setConfirm({
        title: 'All steps done',
        body: 'Mark the task done?',
        label: 'Mark done',
        run: () => complete(saved),
      });
    }
  };

  const skip = (task: Task) =>
    setConfirm({
      title: 'Skip this one?',
      body: 'The next one is scheduled straight away.',
      label: 'Skip',
      run: async () => {
        const result = await run(task, (t) => skipTask(t, ws, task.id));
        if (!result) return;
        onChanged(result.skipped);
        if (result.next) {
          onChanged(result.next);
          onScheduled?.();
        }
        setNotice(result.next ? 'Skipped. Next one scheduled.' : 'Skipped. That was the last one.');
      },
    });

  const remove = (task: Task) =>
    setConfirm({
      title: `Delete ${task.title}?`,
      body: "The task is removed for everyone. It can't be undone.",
      label: 'Delete',
      variant: 'danger',
      run: async () => {
        const ok = await run(task, async (t) => {
          await deleteTask(t, ws, task.id);
          return true;
        });
        if (ok) onRemoved?.(task.id);
      },
    });

  const dialogs = confirm ? (
    <ConfirmModal
      title={confirm.title}
      confirmLabel={confirm.label}
      variant={confirm.variant}
      busy={action.busy}
      onConfirm={() => {
        const current = confirm;
        setConfirm(null);
        void current.run();
      }}
      onCancel={() => setConfirm(null)}
    >
      {confirm.body}
    </ConfirmModal>
  ) : null;

  return {
    busyId,
    busy: action.busy,
    error: action.error,
    reset: action.reset,
    notice,
    clearNotice: () => setNotice(null),
    toggle,
    tick,
    skip,
    remove,
    dialogs,
  };
}
