import * as React from 'react';
import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import type { NodeFieldsProps } from '@app/Chatbots/editor/NodeDrawer';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import { ErrorLine, str, useVariables } from '@app/Chatbots/nodes/common';

interface FieldDraft {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  keyEdited?: boolean;
}

const TYPES: [string, string][] = [
  ['TEXT', 'Text'],
  ['LONG_TEXT', 'Long text'],
  ['NUMBER', 'Number'],
  ['EMAIL', 'Email'],
  ['PHONE', 'Phone'],
  ['DATE', 'Date'],
  ['CHOICE', 'Choice'],
];

const slugKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1')
    .slice(0, 40);

export const AskFormFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const s = p.settings;
  const vars = useVariables(p);
  const fields = (Array.isArray(s.fields) ? s.fields : []) as FieldDraft[];
  const set = (patch: Record<string, unknown>) => p.onChange({ ...s, ...patch });
  const setField = (i: number, patch: Partial<FieldDraft>) =>
    set({ fields: fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const move = (i: number, d: number) => {
    const next = fields.slice();
    const [f] = next.splice(i, 1);
    next.splice(i + d, 0, f);
    set({ fields: next });
  };
  const link = str(s.linkMessage);
  const linkError =
    p.errors['settings.linkMessage'] ??
    (link && link.indexOf('{{form.url}}') < 0 ? 'must contain {{form.url}}' : undefined);
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup label="Title" isRequired fieldId="af-title">
        <VariableInput
          id="af-title"
          aria-label="Title"
          value={str(s.title)}
          onChange={(v) => set({ title: v })}
          variables={vars}
          isDisabled={p.isDisabled}
          validated={p.errors['settings.title'] ? 'error' : 'default'}
        />
        <ErrorLine message={p.errors['settings.title']} />
      </FormGroup>
      <FormGroup label="Intro" fieldId="af-intro">
        <VariableInput
          id="af-intro"
          aria-label="Intro"
          multiline
          value={str(s.intro)}
          onChange={(v) => set({ intro: v })}
          variables={vars}
          isDisabled={p.isDisabled}
        />
      </FormGroup>
      <FormGroup label="Fields" fieldId="af-fields">
        <ErrorLine message={p.errors['settings.fields']} />
        {fields.map((f, i) => (
          <div key={i} className="omni-form-field" role="group" aria-label={`Field ${i + 1}`}>
            <div className="omni-form-field__row">
              <TextInput
                aria-label="Field label"
                placeholder="Label"
                value={f.label}
                isDisabled={p.isDisabled}
                onChange={(_e, v) => setField(i, { label: v, key: f.keyEdited ? f.key : slugKey(v) })}
                validated={p.errors[`settings.fields[${i}].label`] ? 'error' : 'default'}
              />
              <TextInput
                aria-label="Field key"
                placeholder="key"
                value={f.key}
                isDisabled={p.isDisabled}
                onChange={(_e, v) => setField(i, { key: v, keyEdited: true })}
                validated={p.errors[`settings.fields[${i}].key`] ? 'error' : 'default'}
              />
              <FormSelect
                aria-label="Field type"
                value={f.type || 'TEXT'}
                isDisabled={p.isDisabled}
                onChange={(_e, v) => setField(i, { type: v })}
              >
                {TYPES.map(([v, l]) => (
                  <FormSelectOption key={v} value={v} label={l} />
                ))}
              </FormSelect>
              <Checkbox
                id={`af-req-${i}`}
                label="Required"
                isChecked={!!f.required}
                isDisabled={p.isDisabled}
                onChange={(_e, v) => setField(i, { required: v })}
              />
              <Button
                variant="plain"
                aria-label={`Move field ${i + 1} up`}
                isDisabled={p.isDisabled || i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </Button>
              <Button
                variant="plain"
                aria-label={`Move field ${i + 1} down`}
                isDisabled={p.isDisabled || i === fields.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              <Button
                variant="plain"
                aria-label={`Remove field ${i + 1}`}
                isDisabled={p.isDisabled}
                onClick={() => set({ fields: fields.filter((_f, j) => j !== i) })}
              >
                ×
              </Button>
            </div>
            {f.type === 'CHOICE' && (
              <TextArea
                aria-label={`Field ${i + 1} options`}
                placeholder="One option per line"
                rows={3}
                value={(f.options ?? []).join('\n')}
                isDisabled={p.isDisabled}
                onChange={(_e, v) =>
                  setField(i, {
                    options: v
                      .split('\n')
                      .map((x) => x.trim())
                      .filter((x) => x),
                  })
                }
              />
            )}
            <ErrorLine
              message={
                p.errors[`settings.fields[${i}].key`] ??
                p.errors[`settings.fields[${i}].label`] ??
                p.errors[`settings.fields[${i}].options`]
              }
            />
          </div>
        ))}
        <Button
          variant="link"
          isInline
          isDisabled={p.isDisabled || fields.length >= 20}
          onClick={() =>
            set({ fields: fields.concat([{ key: '', label: '', type: 'TEXT', required: true, options: [] }]) })
          }
        >
          Add field
        </Button>
      </FormGroup>
      <FormGroup label="Submit button" fieldId="af-submit">
        <TextInput
          id="af-submit"
          aria-label="Submit button text"
          value={str(s.submitText)}
          isDisabled={p.isDisabled}
          onChange={(_e, v) => set({ submitText: v })}
        />
      </FormGroup>
      <FormGroup label="Thank-you text" fieldId="af-thanks">
        <VariableInput
          id="af-thanks"
          aria-label="Thank-you text"
          value={str(s.thanksText)}
          onChange={(v) => set({ thanksText: v })}
          variables={vars}
          isDisabled={p.isDisabled}
        />
      </FormGroup>
      <FormGroup label="Message that carries the link" isRequired fieldId="af-link">
        <VariableInput
          id="af-link"
          aria-label="Link message"
          multiline
          value={link}
          onChange={(v) => set({ linkMessage: v })}
          variables={vars.concat([{ label: 'Form', paths: [{ path: 'form.url', hint: 'The link to this form' }] }])}
          isDisabled={p.isDisabled}
          validated={linkError ? 'error' : 'default'}
        />
        <ErrorLine message={linkError} />
      </FormGroup>
      <p className="pf-v6-u-color-200">Answers are available as {`{{${p.node.data.name}.form.<key>}}`}.</p>
    </Form>
  );
};
