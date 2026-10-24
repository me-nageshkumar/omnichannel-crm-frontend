import * as React from 'react';
import {
  DatePicker,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Switch,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import type { FieldDef, FieldUser } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** The local date (yyyy-MM-dd) and time (HH:mm) of an ISO instant; blanks when there is none. */
function localParts(iso: unknown): { date: string; time: string } {
  if (typeof iso !== 'string' || !iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** The ISO instant of a local date and time; the date alone means midnight. */
function instantOf(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || '00:00'}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const MultiSelect: React.FunctionComponent<{
  id: string;
  def: FieldDef;
  value: string[];
  onChange(v: string[]): void;
  readOnly?: boolean;
  invalid: boolean;
}> = ({ id, def, value, onChange, readOnly, invalid }) => {
  const [open, setOpen] = React.useState(false);
  const shown = def.options.filter((o) => o.active || value.includes(o.key)).sort((a, b) => a.position - b.position);
  const labels = value.map((k) => def.options.find((o) => o.key === k)?.label ?? k);
  return (
    <Select
      isOpen={open}
      onOpenChange={setOpen}
      onSelect={(_e, picked) => {
        const key = String(picked);
        onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
      }}
      selected={value}
      toggle={(ref) => (
        <MenuToggle
          ref={ref}
          id={id}
          aria-label={def.label}
          isDisabled={readOnly}
          isExpanded={open}
          status={invalid ? 'danger' : undefined}
          onClick={() => setOpen((o) => !o)}
          isFullWidth
        >
          {labels.length ? labels.join(', ') : 'Choose options'}
        </MenuToggle>
      )}
    >
      <SelectList>
        {shown.map((o) => (
          <SelectOption key={o.key} value={o.key} hasCheckbox isSelected={value.includes(o.key)}>
            {o.active ? o.label : `${o.label} (inactive)`}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};

/**
 * One custom field as a labelled form control, per type: text, long text, number, switch, date (and time), select,
 * multi-select, web address, email, phone or a brand user. {@code onChange} gets the value to send: numbers as
 * numbers, dates as yyyy-MM-dd, date-times as ISO instants, blank as null.
 */
export const FieldInput: React.FunctionComponent<{
  def: FieldDef;
  value: unknown;
  onChange(v: unknown): void;
  error?: string | null;
  readOnly?: boolean;
  users?: FieldUser[];
  id?: string;
}> = ({ def, value, onChange, error, readOnly, users = [], id }) => {
  const fieldId = id ?? `crm-field-${def.key}`;
  const invalid = !!error;
  const validated = invalid ? 'error' : 'default';
  const text = value === null || value === undefined ? '' : String(value);
  const blankToNull = (v: string) => (v.trim() === '' ? null : v);

  let control: React.ReactNode;
  switch (def.type) {
    case 'LONG_TEXT':
      control = (
        <TextArea
          id={fieldId}
          value={text}
          onChange={(_e, v) => onChange(blankToNull(v))}
          isDisabled={readOnly}
          validated={validated}
          autoResize
        />
      );
      break;
    case 'NUMBER':
    case 'CURRENCY':
      control = (
        <TextInput
          id={fieldId}
          type="number"
          min={def.type === 'CURRENCY' ? 0 : undefined}
          value={text}
          onChange={(_e, v) => onChange(v.trim() === '' ? null : Number.isFinite(Number(v)) ? Number(v) : v)}
          isDisabled={readOnly}
          validated={validated}
        />
      );
      break;
    case 'BOOLEAN':
      control = (
        <Switch
          id={fieldId}
          isChecked={value === true || value === 'true'}
          onChange={(_e, checked) => onChange(checked)}
          isDisabled={readOnly}
          aria-label={def.label}
        />
      );
      break;
    case 'DATE':
      control = (
        <DatePicker
          value={text}
          onChange={(_e, v) => onChange(blankToNull(v))}
          isDisabled={readOnly}
          aria-label={def.label}
          inputProps={{ id: fieldId, validated }}
          placeholder="yyyy-mm-dd"
        />
      );
      break;
    case 'DATETIME': {
      const parts = localParts(value);
      control = (
        <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', flexWrap: 'wrap' }}>
          <DatePicker
            value={parts.date}
            onChange={(_e, v) => onChange(instantOf(v, parts.time))}
            isDisabled={readOnly}
            aria-label={def.label}
            inputProps={{ id: fieldId, validated }}
            placeholder="yyyy-mm-dd"
          />
          <TextInput
            type="time"
            aria-label={`${def.label} time`}
            value={parts.time}
            onChange={(_e, v) => onChange(instantOf(parts.date, v))}
            isDisabled={readOnly || !parts.date}
            style={{ maxWidth: '9rem' }}
          />
        </div>
      );
      break;
    }
    case 'SELECT': {
      const shown = def.options.filter((o) => o.active || o.key === value).sort((a, b) => a.position - b.position);
      control = (
        <FormSelect
          id={fieldId}
          value={text}
          onChange={(_e, v) => onChange(blankToNull(v))}
          isDisabled={readOnly}
          validated={validated}
        >
          <FormSelectOption value="" label="Not set" />
          {shown.map((o) => (
            <FormSelectOption key={o.key} value={o.key} label={o.active ? o.label : `${o.label} (inactive)`} />
          ))}
        </FormSelect>
      );
      break;
    }
    case 'MULTI_SELECT':
      control = (
        <MultiSelect
          id={fieldId}
          def={def}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(v) => onChange(v.length ? v : null)}
          readOnly={readOnly}
          invalid={invalid}
        />
      );
      break;
    case 'USER': {
      const known = users.some((u) => u.id === value);
      control = (
        <FormSelect
          id={fieldId}
          value={text}
          onChange={(_e, v) => onChange(blankToNull(v))}
          isDisabled={readOnly}
          validated={validated}
        >
          <FormSelectOption value="" label="Nobody" />
          {!known && text && <FormSelectOption value={text} label="Unknown user" />}
          {users.map((u) => (
            <FormSelectOption key={u.id} value={u.id} label={u.name} />
          ))}
        </FormSelect>
      );
      break;
    }
    default: {
      const type = def.type === 'URL' ? 'url' : def.type === 'EMAIL' ? 'email' : def.type === 'PHONE' ? 'tel' : 'text';
      control = (
        <TextInput
          id={fieldId}
          type={type}
          value={text}
          onChange={(_e, v) => onChange(blankToNull(v))}
          isDisabled={readOnly}
          validated={validated}
        />
      );
    }
  }

  return (
    <FormGroup label={def.label} fieldId={fieldId} isRequired={def.required}>
      {control}
      {error && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
};
