import * as React from 'react';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { createTask, updateTask } from '@app/api/crm';
import { personName } from '@app/Crm/personName';
import type { PicklistItem, Ref, Task, TaskInput, TaskPriority, TaskTargetType } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { Field } from '@app/Crm/deals/fields';
import { isCode } from '@app/Crm/Settings/ConflictAlert';
import { crmMessage } from '@app/Crm/errors';
import {
  PRIORITY_LABELS,
  browserTimeZone,
  recurrenceFromForm,
  recurrenceSummary,
  recurrenceToForm,
} from '@app/Crm/tasks/taskDisplay';
import type { RepeatForm } from '@app/Crm/tasks/taskDisplay';
import { useBrandUsers } from '@app/Crm/fields/useBrandUsers';
import { ChecklistEditor } from '@app/Crm/tasks/ChecklistEditor';
import type { StepDraft } from '@app/Crm/tasks/ChecklistEditor';
import { RepeatFields } from '@app/Crm/tasks/RepeatFields';
import type { RepeatErrors } from '@app/Crm/tasks/RepeatFields';

const FIELDS = [
  'title',
  'description',
  'type',
  'priority',
  'dueAt',
  'reminderAt',
  'assigneeId',
  'checklist',
  'recurrence',
  'recurrence.frequency',
  'recurrence.interval',
  'recurrence.weekdays',
  'recurrence.dayOfMonth',
  'recurrence.timeZone',
  'recurrence.endsAfter',
  'recurrence.endsOn',
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TIME = '09:00';
const pad = (n: number) => String(n).padStart(2, '0');

function parts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** The ISO instant of a local date and time (9:00 when only the date is given); null without a valid date. */
function instant(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T${time || DEFAULT_TIME}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Plans a task on a record, or edits one: title, type, priority, due and reminder times, assignee, notes. */
export const TaskFormModal: React.FunctionComponent<{
  target: { type: TaskTargetType; id: string };
  task?: Task;
  /** The brand's task types (inactive ones are offered only when the task already has one). */
  taskTypes: PicklistItem[];
  /** People to assign besides the user and the current assignee. */
  people?: Ref[];
  /** Runs on a version conflict, so the caller can refetch and the next Edit opens the current version. */
  onConflict?(): void;
  onSaved(task: Task): void;
  onClose(): void;
}> = ({ target, task, taskTypes, people = [], onConflict, onSaved, onClose }) => {
  const { token, workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const [title, setTitle] = React.useState(task?.title ?? '');
  const [type, setType] = React.useState(task?.type ?? '');
  const [priority, setPriority] = React.useState<TaskPriority>(task?.priority ?? 'NORMAL');
  const [due, setDue] = React.useState(parts(task?.dueAt));
  const [reminder, setReminder] = React.useState(parts(task?.reminderAt));
  const [assigneeId, setAssigneeId] = React.useState(task?.assignee?.id ?? user?.id ?? '');
  const [description, setDescription] = React.useState(task?.description ?? '');
  const [steps, setSteps] = React.useState<StepDraft[]>(() =>
    (task?.checklist ?? []).map((i) => ({ id: i.id, text: i.text, done: i.done, key: i.id })),
  );
  const [repeat, setRepeat] = React.useState<RepeatForm>(() => recurrenceToForm(task?.recurrence ?? null));
  const [checked, setChecked] = React.useState(false);
  const action = useAction([...FIELDS, ...steps.map((_s, i) => `checklist[${i}].text`)]);
  const brandUsers = useBrandUsers();

  const types = taskTypes.filter((t) => t.active || t.key === task?.type).sort((a, b) => a.position - b.position);
  const assignees: Ref[] = [];
  const add = (r: Ref | null | undefined) => r && !assignees.some((a) => a.id === r.id) && assignees.push(r);
  if (user) add({ id: user.id, name: `${user.name} (you)` });
  add(task?.assignee);
  people.forEach(add);
  brandUsers.forEach(add);

  const dueAt = instant(due.date, due.time);
  const reminderAt = instant(reminder.date, reminder.time);
  const recurrence = recurrenceFromForm(repeat, dueAt, browserTimeZone(), task?.recurrence ?? null);
  const repeating = repeat.frequency !== 'NONE';
  const interval = Number(repeat.interval);
  const count = Number(repeat.count);
  const repeatProblems: RepeatErrors = {
    repeat: repeating && !dueAt ? 'Set a due date to repeat.' : undefined,
    interval: repeating && !(Number.isInteger(interval) && interval >= 1 && interval <= 99) ? '1 to 99' : undefined,
    weekdays: repeat.frequency === 'WEEKLY' && repeat.weekdays.length === 0 ? 'Pick at least one day.' : undefined,
    count:
      repeating && repeat.ends === 'AFTER' && !(Number.isInteger(count) && count >= 2 && count <= 999)
        ? '2 to 999'
        : undefined,
    until:
      repeating && repeat.ends === 'ON'
        ? !DATE.test(repeat.until)
          ? 'Pick the last date.'
          : dueAt && repeat.until < due.date
            ? 'Must not be before the due date.'
            : undefined
        : undefined,
  };
  const repeatErrors: RepeatErrors = checked ? repeatProblems : {};
  const serverRepeat: RepeatErrors = {
    repeat:
      action.fieldErrors.recurrence ??
      action.fieldErrors['recurrence.frequency'] ??
      action.fieldErrors['recurrence.timeZone'] ??
      action.fieldErrors['recurrence.dayOfMonth'],
    interval: action.fieldErrors['recurrence.interval'],
    weekdays: action.fieldErrors['recurrence.weekdays'],
    count: action.fieldErrors['recurrence.endsAfter'],
    until: action.fieldErrors['recurrence.endsOn'],
  };
  const repeatShown: RepeatErrors = Object.fromEntries(
    (['repeat', 'interval', 'weekdays', 'count', 'until'] as const).map((k) => [k, repeatErrors[k] ?? serverRepeat[k]]),
  );
  const repeatBad = Object.values(repeatProblems).some(Boolean);
  const stepErrors: Record<number, string> = {};
  Object.entries(action.fieldErrors).forEach(([k, v]) => {
    const m = /^checklist\[(\d+)\]\.text$/.exec(k);
    if (m) stepErrors[Number(m[1])] = v;
  });
  const errors = {
    title:
      checked && !title.trim()
        ? 'Give the task a title.'
        : checked && title.trim().length > 200
          ? 'Use at most 200 characters.'
          : null,
    dueAt: checked && due.date && !dueAt ? 'Use the format yyyy-mm-dd.' : null,
    reminderAt:
      checked && reminder.date && !reminderAt
        ? 'Use the format yyyy-mm-dd.'
        : checked && dueAt && reminderAt && reminderAt > dueAt
          ? 'The reminder must be at or before the due time.'
          : null,
    description: checked && description.length > 5000 ? 'Use at most 5,000 characters.' : null,
  };
  const err = (k: keyof typeof errors) => errors[k] ?? action.fieldErrors[k] ?? null;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    const bad =
      !title.trim() ||
      title.trim().length > 200 ||
      (due.date && !dueAt) ||
      (reminder.date && !reminderAt) ||
      (dueAt && reminderAt && reminderAt > dueAt) ||
      description.length > 5000 ||
      repeatBad;
    if (bad) return;
    const body: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      type: type || null,
      priority,
      dueAt,
      reminderAt,
      assigneeId: assigneeId || null,
      checklist: steps
        .map((s) => ({ id: s.id, text: s.text.trim() }))
        .filter((s) => s.text)
        .map((s) => (s.id ? s : { text: s.text })),
      recurrence,
    };
    const t = token as string;
    const saved = await action.run(
      () =>
        task ? updateTask(t, ws, task.id, { ...body, version: task.version }) : createTask(t, ws, { ...body, target }),
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) {
          onConflict?.();
          return 'Someone else changed this task. Close this form and open it again.';
        }
        return crmMessage(e, 'Could not save the task. Try again.');
      },
    );
    if (saved) onSaved(saved);
  };

  const when = (
    label: string,
    value: { date: string; time: string },
    set: (v: { date: string; time: string }) => void,
    error: string | null,
  ) => (
    <Field label={label} fieldId={`crm-task-${label.toLowerCase()}`} error={error}>
      <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', flexWrap: 'wrap' }}>
        <DatePicker
          value={value.date}
          aria-label={`${label} date`}
          placeholder="yyyy-mm-dd"
          inputProps={{ id: `crm-task-${label.toLowerCase()}`, validated: error ? 'error' : 'default' }}
          onChange={(_e, date) => set({ ...value, date })}
        />
        <TextInput
          type="time"
          aria-label={`${label} time`}
          value={value.time}
          onChange={(_e, time) => set({ ...value, time })}
          style={{ maxWidth: '9rem' }}
        />
      </div>
    </Field>
  );

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="crm-task-title">
      <ModalHeader title={task ? 'Edit task' : 'New task'} labelId="crm-task-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} className="pf-v6-u-mb-md" />}
        <Form id="crm-task-form" onSubmit={onSubmit}>
          <Field label="Title" fieldId="crm-task-name" isRequired error={err('title')}>
            <TextInput
              id="crm-task-name"
              value={title}
              maxLength={200}
              validated={err('title') ? 'error' : 'default'}
              onChange={(_e, v) => setTitle(v)}
            />
          </Field>
          {types.length > 0 && (
            <Field label="Type" fieldId="crm-task-type" error={action.fieldErrors.type}>
              <FormSelect id="crm-task-type" value={type} onChange={(_e, v) => setType(v)}>
                <FormSelectOption value="" label="No type" />
                {types.map((t) => (
                  <FormSelectOption key={t.key} value={t.key} label={t.label} />
                ))}
              </FormSelect>
            </Field>
          )}
          <Field label="Priority" fieldId="crm-task-priority">
            <FormSelect id="crm-task-priority" value={priority} onChange={(_e, v) => setPriority(v as TaskPriority)}>
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <FormSelectOption key={p} value={p} label={PRIORITY_LABELS[p]} />
              ))}
            </FormSelect>
          </Field>
          {when('Due', due, setDue, err('dueAt'))}
          {when('Reminder', reminder, setReminder, err('reminderAt'))}
          <Field label="Assignee" fieldId="crm-task-assignee" error={action.fieldErrors.assigneeId}>
            <FormSelect id="crm-task-assignee" value={assigneeId} onChange={(_e, v) => setAssigneeId(v)}>
              {assignees.map((a) => (
                <FormSelectOption key={a.id} value={a.id} label={personName(a)} />
              ))}
            </FormSelect>
          </Field>
          <Field label="Description" fieldId="crm-task-description" error={err('description')}>
            <TextArea
              id="crm-task-description"
              value={description}
              resizeOrientation="vertical"
              onChange={(_e, v) => setDescription(v)}
            />
          </Field>
          <Field label="Steps" fieldId="crm-task-steps" error={action.fieldErrors.checklist}>
            <ChecklistEditor value={steps} onChange={setSteps} errors={stepErrors} />
          </Field>
          <RepeatFields
            value={repeat}
            onChange={setRepeat}
            dueAt={dueAt}
            summary={recurrenceSummary(recurrence)}
            errors={repeatShown}
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="crm-task-form" isDisabled={action.busy} isLoading={action.busy}>
          Save task
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
