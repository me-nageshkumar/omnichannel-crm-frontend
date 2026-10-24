import * as React from 'react';
import { Alert, Button, Form, FormSelect, FormSelectOption, TextArea, TextInput } from '@patternfly/react-core';
import { logActivity } from '@app/api/crm';
import type { Activity, ManualActivityType, TargetType } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { Field } from '@app/Crm/deals/fields';

const MAX = 2000;
const pad = (n: number) => String(n).padStart(2, '0');
/** A local date-time as the datetime-local input writes it. */
const localInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Logs a call, meeting or email that already happened on {@code target}. */
export const LogActivityForm: React.FunctionComponent<{
  target: { type: TargetType; id: string };
  onLogged(activity: Activity): void;
}> = ({ target, onLogged }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [type, setType] = React.useState<ManualActivityType>('CALL');
  const [summary, setSummary] = React.useState('');
  const [when, setWhen] = React.useState(() => localInput(new Date()));
  const [checked, setChecked] = React.useState(false);
  const action = useAction(['summary', 'happenedAt']);

  const at = new Date(when);
  const timeError = !when || Number.isNaN(at.getTime())
    ? 'Enter when it happened.'
    : at.getTime() > Date.now()
      ? 'Choose a time that has already happened.'
      : null;
  const summaryError = !summary.trim() ? 'Write what happened.' : summary.length > MAX ? `Use at most ${MAX} characters.` : null;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    if (timeError || summaryError) return;
    const created = await action.run(() =>
      logActivity(token as string, ws, { target, type, summary: summary.trim(), happenedAt: at.toISOString() }),
    );
    if (created) {
      setSummary('');
      setChecked(false);
      setWhen(localInput(new Date()));
      onLogged(created);
    }
  };

  return (
    <Form onSubmit={onSubmit} aria-label="Log activity">
      {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
      <Field label="Type" fieldId="crm-log-type">
        <FormSelect id="crm-log-type" value={type} onChange={(_e, v) => setType(v as ManualActivityType)}>
          <FormSelectOption value="CALL" label="Call" />
          <FormSelectOption value="MEETING" label="Meeting" />
          <FormSelectOption value="EMAIL" label="Email" />
        </FormSelect>
      </Field>
      <Field
        label="Summary"
        fieldId="crm-log-summary"
        error={(checked && summaryError) || action.fieldErrors.summary}
        help={`${summary.length} / ${MAX}`}
      >
        <TextArea
          id="crm-log-summary"
          value={summary}
          resizeOrientation="vertical"
          validated={checked && summaryError ? 'error' : 'default'}
          onChange={(_e, v) => setSummary(v)}
        />
      </Field>
      <Field
        label="When it happened"
        fieldId="crm-log-when"
        error={(checked && timeError) || action.fieldErrors.happenedAt}
      >
        <TextInput
          id="crm-log-when"
          type="datetime-local"
          value={when}
          validated={checked && timeError ? 'error' : 'default'}
          onChange={(_e, v) => setWhen(v)}
        />
      </Field>
      <div>
        <Button type="submit" variant="secondary" isLoading={action.busy} isDisabled={action.busy}>
          Log activity
        </Button>
      </div>
    </Form>
  );
};
