import type { Task } from '@app/api/crm';

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

/** The largest whole unit of a duration: minutes under an hour, hours under a day, else days. */
function unitOf(ms: number): { n: number; unit: 'minute' | 'hour' | 'day' } {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return { n: Math.max(minutes, 1), unit: 'minute' };
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return { n: hours, unit: 'hour' };
  return { n: Math.round(ms / 86_400_000), unit: 'day' };
}

/** "in 2 hours", "3 days overdue", or "No due date". */
export function dueLabel(dueAt: string | null, now: Date = new Date()): string {
  if (!dueAt) return 'No due date';
  const diff = new Date(dueAt).getTime() - now.getTime();
  const { n, unit } = unitOf(Math.abs(diff));
  if (diff >= 0) return RELATIVE.format(n, unit);
  return `${n} ${unit}${n === 1 ? '' : 's'} overdue`;
}

/** An open task whose due time has passed. */
export const isOverdue = (task: Pick<Task, 'status' | 'dueAt'>, now: Date = new Date()): boolean =>
  task.status === 'OPEN' && !!task.dueAt && new Date(task.dueAt).getTime() < now.getTime();

/** The browser's IANA time zone; it decides where "today" starts. */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** The record page a task's target opens. */
export function targetPath(target: Task['target']): string {
  const id = encodeURIComponent(target.id);
  if (target.type === 'DEAL') return `/crm/deals/${id}`;
  if (target.type === 'COMPANY') return `/crm/companies/${id}`;
  return `/crm/contacts/${id}`;
}

export const PRIORITY_LABELS: Record<Task['priority'], string> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High' };
