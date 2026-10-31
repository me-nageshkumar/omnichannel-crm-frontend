import * as React from 'react';
import { Checkbox, DatePicker, FormSelect, FormSelectOption, Radio, TextInput } from '@patternfly/react-core';
import { Field } from '@app/Crm/deals/fields';
import { REPEAT_OPTIONS, WEEKDAYS, weekdayOf } from '@app/Crm/tasks/taskDisplay';
import type { RepeatForm } from '@app/Crm/tasks/taskDisplay';
import type { RecurrenceFrequency, Weekday } from '@app/api/crm';

const UNITS: Record<RecurrenceFrequency, string> = { DAILY: 'day(s)', WEEKLY: 'week(s)', MONTHLY: 'month(s)' };

export type RepeatErrors = Partial<Record<'repeat' | 'interval' | 'weekdays' | 'count' | 'until', string>>;

const inline: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--pf-t--global--spacer--md)',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
};

/**
 * The task form's repeat fields (spec E C17): frequency, interval, weekdays (weekly), ends never / after N / on a
 * date, and the rule's summary. Picking Weekly with no day chosen defaults to the due date's weekday.
 */
export const RepeatFields: React.FunctionComponent<{
  value: RepeatForm;
  onChange(value: RepeatForm): void;
  dueAt: string | null;
  summary: string;
  errors: RepeatErrors;
}> = ({ value, onChange, dueAt, summary, errors }) => {
  const set = (patch: Partial<RepeatForm>) => onChange({ ...value, ...patch });
  const onFrequency = (frequency: RepeatForm['frequency']) => {
    const weekdays =
      frequency === 'WEEKLY' && value.weekdays.length === 0 && dueAt ? [weekdayOf(dueAt)] : value.weekdays;
    set({ frequency, weekdays });
  };
  const repeating = value.frequency !== 'NONE';
  return (
    <>
      <div style={inline}>
        <Field label="Repeat" fieldId="crm-task-repeat" error={errors.repeat}>
          <FormSelect
            id="crm-task-repeat"
            value={value.frequency}
            validated={errors.repeat ? 'error' : 'default'}
            onChange={(_e, v) => onFrequency(v as RepeatForm['frequency'])}
          >
            {REPEAT_OPTIONS.map((o) => (
              <FormSelectOption key={o.value} value={o.value} label={o.label} />
            ))}
          </FormSelect>
        </Field>
        {repeating && (
          <Field label="Every" fieldId="crm-task-interval" error={errors.interval}>
            <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', alignItems: 'center' }}>
              <TextInput
                id="crm-task-interval"
                type="number"
                min={1}
                max={99}
                value={value.interval}
                validated={errors.interval ? 'error' : 'default'}
                onChange={(_e, v) => set({ interval: v })}
                style={{ maxWidth: '6rem' }}
              />
              <span>{UNITS[value.frequency as RecurrenceFrequency]}</span>
            </div>
          </Field>
        )}
      </div>
      {value.frequency === 'WEEKLY' && (
        <Field label="On" fieldId="crm-task-weekdays" error={errors.weekdays}>
          <div
            id="crm-task-weekdays"
            style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--md)', flexWrap: 'wrap' }}
          >
            {WEEKDAYS.map((d) => (
              <Checkbox
                key={d.value}
                id={`crm-task-weekday-${d.value}`}
                label={d.label}
                isChecked={value.weekdays.includes(d.value)}
                onChange={(_e, checked) =>
                  set({
                    weekdays: checked
                      ? [...value.weekdays, d.value]
                      : value.weekdays.filter((w: Weekday) => w !== d.value),
                  })
                }
              />
            ))}
          </div>
        </Field>
      )}
      {repeating && (
        <div style={inline}>
          <Field label="Ends" fieldId="crm-task-ends">
            <div id="crm-task-ends" style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--md)' }}>
              {(['NEVER', 'AFTER', 'ON'] as const).map((k) => (
                <Radio
                  key={k}
                  id={`crm-task-ends-${k}`}
                  name="crm-task-ends"
                  label={k === 'NEVER' ? 'Never' : k === 'AFTER' ? 'After' : 'On'}
                  isChecked={value.ends === k}
                  onChange={() => set({ ends: k })}
                />
              ))}
            </div>
          </Field>
          {value.ends === 'AFTER' && (
            <Field label="Times" fieldId="crm-task-count" error={errors.count}>
              <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', alignItems: 'center' }}>
                <TextInput
                  id="crm-task-count"
                  aria-label="Number of times"
                  type="number"
                  min={2}
                  max={999}
                  value={value.count}
                  validated={errors.count ? 'error' : 'default'}
                  onChange={(_e, v) => set({ count: v })}
                  style={{ maxWidth: '6rem' }}
                />
                <span>times</span>
              </div>
            </Field>
          )}
          {value.ends === 'ON' && (
            <Field label="Last date" fieldId="crm-task-until" error={errors.until}>
              <DatePicker
                value={value.until}
                aria-label="Last date"
                placeholder="yyyy-mm-dd"
                inputProps={{ id: 'crm-task-until', validated: errors.until ? 'error' : 'default' }}
                onChange={(_e, until) => set({ until })}
              />
            </Field>
          )}
        </div>
      )}
      {repeating && summary && (
        <p className="pf-v6-u-color-200" style={{ margin: 0 }}>
          {summary}. The next task is created when this one is done.
        </p>
      )}
    </>
  );
};
