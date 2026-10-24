import * as React from 'react';
import { Alert, AlertActionCloseButton, AlertActionLink, AlertGroup } from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom';
import { listReminders, markReminderSeen } from '@app/api/crm';
import type { Reminder } from '@app/api/crm';
import { useSession } from '@app/session/SessionContext';
import { targetPath } from '@app/Crm/tasks/taskDisplay';

export const REMINDER_POLL_MS = 60_000;
const MAX_TOASTS = 3;
const TIME = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Polls the caller's due reminders every minute while the tab is visible (and when it becomes visible again) and
 * shows each new one once as a toast; closing or opening it marks it seen. Mounted only for a brand with the CRM on.
 * {@code onCount} gets the number of reminders not yet seen after every poll.
 */
export const CrmReminders: React.FunctionComponent<{ onCount(n: number): void }> = ({ onCount }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const navigate = useNavigate();
  const [shown, setShown] = React.useState<Reminder[]>([]);
  // ids closed or opened: not toasted again while the server still returns them (a poll may race the "seen" call)
  const done = React.useRef(new Set<string>());
  const onCountRef = React.useRef(onCount);
  onCountRef.current = onCount;

  React.useEffect(() => {
    if (!token || !ws) return undefined;
    let live = true;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      listReminders(token, ws).then(
        (list) => {
          if (!live) return;
          // a handled reminder the server stopped returning was seen; if it comes back it was re-armed
          const returned = new Set(list.map((r) => r.taskId));
          done.current.forEach((id) => !returned.has(id) && done.current.delete(id));
          const fresh = list.filter((r) => !done.current.has(r.taskId));
          onCountRef.current(fresh.length);
          setShown((cur) => [...cur, ...fresh.filter((r) => !cur.some((c) => c.taskId === r.taskId))]);
        },
        () => undefined,
      );
    };
    poll();
    const timer = window.setInterval(poll, REMINDER_POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, ws]);

  const seen = (r: Reminder) => {
    done.current.add(r.taskId);
    setShown((cur) => {
      const next = cur.filter((c) => c.taskId !== r.taskId);
      onCountRef.current(next.length);
      return next;
    });
    if (token) markReminderSeen(token, ws, r.taskId).catch(() => undefined);
  };

  const visible = shown.slice(0, MAX_TOASTS);
  const more = shown.length - visible.length;
  return (
    <AlertGroup isToast isLiveRegion aria-label="Task reminders">
      {visible.map((r) => (
        <Alert
          key={r.taskId}
          variant="info"
          title={`Follow-up due: ${r.title}`}
          actionClose={<AlertActionCloseButton title={r.title} onClose={() => seen(r)} />}
          actionLinks={
            <AlertActionLink
              onClick={() => {
                seen(r);
                navigate(targetPath(r.target));
              }}
            >
              Open
            </AlertActionLink>
          }
        >
          {r.target.name && <div>{r.target.name}</div>}
          {r.dueAt && <div>{`due ${TIME.format(new Date(r.dueAt))}`}</div>}
        </Alert>
      ))}
      {more > 0 && <Alert variant="info" isPlain title={`and ${more} more`} />}
    </AlertGroup>
  );
};
