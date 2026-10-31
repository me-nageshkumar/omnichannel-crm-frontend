import type { Recurrence, RecurrenceFrequency, Task, Weekday } from '@app/api/crm';

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

// --- delegation, checklists and repeats (phase E) ------------------------------------------------------------

/** Ticked and total steps. */
export const checklistProgress = (task: Pick<Task, 'checklist'>): { done: number; total: number } => ({
  done: task.checklist.filter((i) => i.done).length,
  total: task.checklist.length,
});

/** Someone else handed this task to the signed-in user. */
export const isDelegatedToMe = (task: Pick<Task, 'assignedBy' | 'assignee'>, userId: string | undefined): boolean =>
  !!userId && !!task.assignedBy && task.assignedBy.id !== userId && task.assignee?.id === userId;

/** The assignee may complete, reopen, skip and tick their own task without edit rights (the server decides). */
export const canWorkTask = (task: Pick<Task, 'assignee'>, canEdit: boolean, userId: string | undefined): boolean =>
  canEdit || (!!userId && task.assignee?.id === userId);

export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' },
];

export const REPEAT_OPTIONS: { value: 'NONE' | RecurrenceFrequency; label: string }[] = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

/** The local weekday of an instant. */
export const weekdayOf = (iso: string): Weekday => WEEKDAYS[(new Date(iso).getDay() + 6) % 7].value;

/** The task form's repeat fields. */
export interface RepeatForm {
  frequency: 'NONE' | RecurrenceFrequency;
  interval: string;
  weekdays: Weekday[];
  ends: 'NEVER' | 'AFTER' | 'ON';
  count: string;
  until: string;
}

export const recurrenceToForm = (r: Recurrence | null): RepeatForm => ({
  frequency: r?.frequency ?? 'NONE',
  interval: String(r?.interval ?? 1),
  weekdays: r?.weekdays ?? [],
  ends: r?.endsAfter ? 'AFTER' : r?.endsOn ? 'ON' : 'NEVER',
  count: r?.endsAfter ? String(r.endsAfter) : '',
  until: r?.endsOn ?? '',
});

/**
 * The rule to send for the form's repeat fields; null when the task does not repeat. When editing, {@code existing}
 * keeps its time zone and, while it stays monthly, its day of the month (an occurrence clamped to a short month must
 * not move the rest of the series).
 */
export function recurrenceFromForm(
  f: RepeatForm,
  dueAt: string | null,
  zone: string,
  existing: Recurrence | null,
): Recurrence | null {
  if (f.frequency === 'NONE') return null;
  const interval = Math.trunc(Number(f.interval)) || 1;
  let dayOfMonth: number | null = null;
  if (f.frequency === 'MONTHLY') {
    if (existing?.frequency === 'MONTHLY' && existing.dayOfMonth) dayOfMonth = existing.dayOfMonth;
    else if (dueAt) dayOfMonth = new Date(dueAt).getDate();
  }
  return {
    frequency: f.frequency,
    interval,
    weekdays: f.frequency === 'WEEKLY' ? WEEKDAYS.map((d) => d.value).filter((d) => f.weekdays.includes(d)) : null,
    dayOfMonth,
    timeZone: existing?.timeZone || zone,
    endsAfter: f.ends === 'AFTER' && f.count ? Math.trunc(Number(f.count)) : null,
    endsOn: f.ends === 'ON' && f.until ? f.until : null,
  };
}

const UNITS: Record<RecurrenceFrequency, [string, string]> = {
  DAILY: ['daily', 'day'],
  WEEKLY: ['weekly', 'week'],
  MONTHLY: ['monthly', 'month'],
};
const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Repeats every 2 weeks on Mon, Thu until 31 Dec 2026"; '' when the task does not repeat. */
export function recurrenceSummary(r: Recurrence | null): string {
  if (!r) return '';
  const [adverb, unit] = UNITS[r.frequency];
  let text = r.interval === 1 ? `Repeats ${adverb}` : `Repeats every ${r.interval} ${unit}s`;
  if (r.frequency === 'WEEKLY' && r.weekdays?.length) {
    text += ` on ${r.weekdays.map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? d).join(', ')}`;
  }
  if (r.frequency === 'MONTHLY' && r.dayOfMonth) text += ` on day ${r.dayOfMonth}`;
  if (r.endsOn) {
    const [y, m, d] = r.endsOn.split('-').map(Number);
    text += ` until ${LONG_DATE.format(new Date(y, m - 1, d))}`;
  }
  if (r.endsAfter) text += `, ${r.endsAfter} times`;
  return text;
}
