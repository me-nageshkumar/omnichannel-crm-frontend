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

const FILL_WORDS: Record<string, string> = { name: 'the contact name', phone: 'the contact phone' };

/** Where a blank's value comes from when the rule gives none, in words; null when the rule must give one. */
function fillText(f: { kind: string; attributeKey?: string | null } | undefined): string | null {
  if (!f) return null;
  if (f.kind === 'CONTACT_FIELD') return FILL_WORDS[f.attributeKey ?? 'name'] ?? 'the contact';
  if (f.kind === 'CONTACT_ATTRIBUTE') return `the contact's ${f.attributeKey}`;
  return null;
}

/**
 * Send WhatsApp template: an approved Meta template on a Cloud API number, any time (spec 2026-11-20 §5.6), and a
 * value for each blank the template's fills do not cover.
 */
export const SendCloudTemplateFields: React.FunctionComponent<{
  action: AutomationAction;
  options: AutomationOptions;
  errors: Record<string, string>;
  isDisabled: boolean;
  onChange(action: AutomationAction): void;
}> = ({ action, options, errors, isDisabled, onChange }) => {
  const id = React.useId();
  const templates = options.cloudTemplates ?? [];
  const templateId = action.cloudTemplateId ?? '';
  const template = templates.find((t) => t.id === templateId);
  const values = action.values ?? {};

  const choose = (next: string) => {
    const keys = templates.find((t) => t.id === next)?.variables.map((v) => v.key) ?? [];
    const kept: Record<string, string> = {};
    for (const k of keys) if (values[k] !== undefined) kept[k] = values[k];
    onChange({ ...action, cloudTemplateId: next === '' ? null : next, values: kept });
  };

  const setValue = (key: string, v: string) => {
    const next = { ...values };
    if (v === '') delete next[key];
    else next[key] = v;
    onChange({ ...action, values: next });
  };

  return (
    <>
      <FormGroup label="WhatsApp template" fieldId={`${id}-template`}>
        <FormSelect
          id={`${id}-template`}
          value={templateId}
          isDisabled={isDisabled}
          validated={errors.cloudTemplateId ? 'error' : 'default'}
          onChange={(_e, v) => choose(v)}
        >
          <FormSelectOption value="" label="Choose a WhatsApp template" isPlaceholder />
          {templateId !== '' && !template && <FormSelectOption value={templateId} label="—" isDisabled />}
          {templates.map((t) => (
            <FormSelectOption key={t.id} value={t.id} label={`${t.name} (${t.language})`} />
          ))}
        </FormSelect>
        <FormHelperText>
          <HelperText>
            {templates.length === 0 ? (
              <HelperTextItem variant="warning">
                No approved WhatsApp templates yet — sync them on WhatsApp templates
              </HelperTextItem>
            ) : (
              <HelperTextItem>Sent on the chat&apos;s Cloud API number, also after the 24-hour window.</HelperTextItem>
            )}
            <ErrorLine message={errors.cloudTemplateId} />
          </HelperText>
        </FormHelperText>
      </FormGroup>
      {(template?.variables ?? []).map((v) => {
        const filled = fillText(template?.fills[v.key]);
        const error = errors[`values.${v.key}`];
        return (
          <FormGroup key={v.key} label={`Value for “${v.key}”`} isRequired={!filled} fieldId={`${id}-value-${v.key}`}>
            <TextInput
              id={`${id}-value-${v.key}`}
              value={values[v.key] ?? ''}
              isDisabled={isDisabled}
              placeholder={v.example ?? ''}
              validated={error ? 'error' : 'default'}
              onChange={(_e, value) => setValue(v.key, value)}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{filled ? `Empty: ${filled}` : 'Every send uses this value.'}</HelperTextItem>
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
export const sendCloudTemplateShows = (key: string) => key === 'cloudTemplateId' || key.indexOf('values.') === 0;
