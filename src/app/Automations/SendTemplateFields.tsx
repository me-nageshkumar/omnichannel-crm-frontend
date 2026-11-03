import * as React from 'react';
import {
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextInput,
} from '@patternfly/react-core';
import type { AutomationAction, AutomationOptions } from '@app/api/automations';

const ErrorLine: React.FunctionComponent<{ message?: string }> = ({ message }) =>
  message ? <HelperTextItem variant="error">{message}</HelperTextItem> : null;

/** Send template: the template, and a value for each placeholder an agent would type (contact ones fill themselves). */
export const SendTemplateFields: React.FunctionComponent<{
  action: AutomationAction;
  options: AutomationOptions;
  errors: Record<string, string>;
  isDisabled: boolean;
  onChange(action: AutomationAction): void;
}> = ({ action, options, errors, isDisabled, onChange }) => {
  const id = React.useId();
  const templateId = action.templateId ?? '';
  const template = options.templates.find((t) => t.id === templateId);
  const agentPlaceholders = (template?.placeholders ?? []).filter((p) => p.kind === 'AGENT');
  const values = action.values ?? {};

  const chooseTemplate = (next: string) => {
    const names = (options.templates.find((t) => t.id === next)?.placeholders ?? [])
      .filter((p) => p.kind === 'AGENT')
      .map((p) => p.name);
    const kept: Record<string, string> = {};
    for (const n of names) if (values[n] !== undefined) kept[n] = values[n];
    onChange({ ...action, templateId: next === '' ? null : next, values: kept });
  };

  const setValue = (name: string, v: string) => {
    const next = { ...values };
    if (v === '') delete next[name];
    else next[name] = v;
    onChange({ ...action, values: next });
  };

  return (
    <>
      <FormGroup label="Template" fieldId={`${id}-template`}>
        <FormSelect
          id={`${id}-template`}
          value={templateId}
          isDisabled={isDisabled}
          validated={errors.templateId ? 'error' : 'default'}
          onChange={(_e, v) => chooseTemplate(v)}
        >
          <FormSelectOption value="" label="Choose a template" isPlaceholder />
          {templateId !== '' && !template && <FormSelectOption value={templateId} label="—" isDisabled />}
          {options.templates.map((t) => (
            <FormSelectOption key={t.id} value={t.id} label={t.name} />
          ))}
        </FormSelect>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>Contact details such as the name are filled from the contact.</HelperTextItem>
            <ErrorLine message={errors.templateId} />
          </HelperText>
        </FormHelperText>
      </FormGroup>
      {agentPlaceholders.map((p) => {
        const error = errors[`values.${p.name}`];
        return (
          <FormGroup
            key={p.name}
            label={`Value for “${p.label ?? p.name}”`}
            isRequired={p.required}
            fieldId={`${id}-value-${p.name}`}
          >
            <TextInput
              id={`${id}-value-${p.name}`}
              value={values[p.name] ?? ''}
              isRequired={p.required}
              isDisabled={isDisabled}
              validated={error ? 'error' : 'default'}
              onChange={(_e, v) => setValue(p.name, v)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>Every send uses this value.</HelperTextItem>
                {p.fallback !== null && <HelperTextItem>{`Empty: “${p.fallback}”`}</HelperTextItem>}
                <ErrorLine message={error} />
              </HelperText>
            </FormHelperText>
          </FormGroup>
        );
      })}
    </>
  );
};

/** The error keys these fields show; the card lists any others itself. */
export const sendTemplateShows = (key: string) => key === 'templateId' || key.indexOf('values.') === 0;
