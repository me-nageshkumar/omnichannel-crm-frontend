import * as React from 'react';
import {
  Button,
  Checkbox,
  Form,
  FormSelect,
  FormSelectOption,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Switch,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import type { InheritedSource, SettingField, SettingsLayer } from '@app/api/chatbots';
import { EMPTY_LAYER, FieldDraft, LayerDraft, effective, fromDraft, reminderWarning } from './settingsLayers';

const SOURCE_TEXT: Record<InheritedSource, string> = { BRAND: 'brand setting', PLATFORM: 'platform default' };
const FROM_TEXT: Record<InheritedSource, string> = {
  BRAND: "From the brand's settings",
  PLATFORM: 'From the platform defaults',
};
const CUT = 40;

const cut = (s: string) => (s.length > CUT ? `${s.slice(0, CUT).trimEnd()}…` : s);

interface Props {
  value: LayerDraft;
  onChange(d: LayerDraft): void;
  /** The value of every field from the layer above; `null` for the platform layer, which inherits nothing. */
  inherited: SettingsLayer | null;
  sources: Partial<Record<SettingField, InheritedSource>>;
  readOnly: boolean;
  errors: Partial<Record<SettingField, string>>;
}

const Helper: React.FunctionComponent<{ error?: string; note?: string }> = ({ error, note }) =>
  error || note ? (
    <FormHelperText>
      <HelperText>
        {error ? <HelperTextItem variant="error">{error}</HelperTextItem> : <HelperTextItem>{note}</HelperTextItem>}
      </HelperText>
    </FormHelperText>
  ) : null;

/**
 * The chatbot settings at one layer (spec 2026-11-14 §8): an inherited field is empty and shows the value above it and
 * where it comes from; a set field can be reset; the end and give-up messages can be set to "send no message".
 */
export const LayeredSettingsForm: React.FunctionComponent<Props> = ({
  value,
  onChange,
  inherited,
  sources,
  readOnly,
  errors,
}) => {
  const layered = inherited !== null;
  const eff = effective(fromDraft(value), inherited ?? EMPTY_LAYER);
  const set = (f: SettingField, d: FieldDraft) => onChange({ ...value, [f]: d });
  const source = (f: SettingField): InheritedSource => sources[f] ?? 'PLATFORM';

  const shown = (f: SettingField): string => {
    const v = inherited?.[f];
    if (v === null || v === undefined) return '';
    return v === '' ? 'No message' : cut(String(v));
  };
  // a set field whose box was cleared saves as inherited, so it reads as inherited too
  const inheriting = (f: SettingField) => {
    const d = value[f];
    return d.kind === 'inherit' || (d.kind === 'set' && d.text.trim() === '');
  };
  const placeholder = (f: SettingField) =>
    layered && inheriting(f) ? `${shown(f)} — ${SOURCE_TEXT[source(f)]}` : undefined;
  const text = (f: SettingField) => {
    const d = value[f];
    return d.kind === 'set' ? d.text : '';
  };

  const reset = (f: SettingField, label: string) =>
    layered && !readOnly && !inheriting(f) ? (
      <Button variant="link" isInline aria-label={`Reset ${label}`} onClick={() => set(f, { kind: 'inherit' })}>
        Reset
      </Button>
    ) : null;

  const numberField = (f: SettingField, id: string, label: string, required = false) => (
    <FormGroup label={label} isRequired={required && !layered} fieldId={id} labelHelp={reset(f, label) ?? undefined}>
      <TextInput
        id={id}
        type="number"
        aria-label={label}
        value={text(f)}
        placeholder={placeholder(f)}
        isDisabled={readOnly}
        validated={errors[f] ? 'error' : 'default'}
        onChange={(_e, v) => set(f, { kind: 'set', text: v })}
      />
      <Helper error={errors[f]} />
    </FormGroup>
  );

  const messageField = (f: SettingField, id: string, label: string, groupLabel: string, noneLabel?: string) => (
    <FormGroup label={groupLabel} fieldId={id} labelHelp={reset(f, label) ?? undefined}>
      <TextArea
        id={id}
        aria-label={label}
        rows={2}
        value={text(f)}
        placeholder={placeholder(f)}
        isDisabled={readOnly || value[f].kind === 'none'}
        validated={errors[f] ? 'error' : 'default'}
        onChange={(_e, v) => set(f, { kind: 'set', text: v })}
      />
      {noneLabel && (
        <Checkbox
          id={`${id}-none`}
          label={noneLabel}
          isChecked={value[f].kind === 'none'}
          isDisabled={readOnly}
          onChange={(_e, on) => set(f, on ? { kind: 'none' } : { kind: 'inherit' })}
        />
      )}
      <Helper error={errors[f]} />
    </FormGroup>
  );

  const switchField = (f: SettingField, id: string, ariaLabel: string, label: string) => {
    const inheritedNote = layered && inheriting(f) ? FROM_TEXT[source(f)] : undefined;
    return (
      <>
        <Switch
          id={id}
          aria-label={ariaLabel}
          label={label}
          isChecked={Boolean(eff[f])}
          isDisabled={readOnly}
          onChange={(_e, on) => set(f, { kind: 'set', text: String(on) })}
        />
        {reset(f, ariaLabel)}
        <Helper error={errors[f]} note={inheritedNote} />
      </>
    );
  };

  /** A choice among {@code options}; in a layer, the empty option inherits and names the value above it. */
  const choiceField = (f: SettingField, id: string, label: string, options: [string, string][]) => {
    const labelOf = (v: unknown) => options.find(([value]) => value === v)?.[1] ?? '';
    return (
      <FormGroup label={label} fieldId={id}>
        <FormSelect
          id={id}
          aria-label={label}
          value={text(f)}
          isDisabled={readOnly}
          validated={errors[f] ? 'error' : 'default'}
          onChange={(_e, v) => set(f, v ? { kind: 'set', text: v } : { kind: 'inherit' })}
        >
          {layered ? (
            <FormSelectOption value="" label={`${labelOf(inherited?.[f])} — ${SOURCE_TEXT[source(f)]}`} />
          ) : (
            text(f) === '' && <FormSelectOption value="" label="Choose" isPlaceholder />
          )}
          {options.map(([value, optionLabel]) => (
            <FormSelectOption key={value} value={value} label={optionLabel} />
          ))}
        </FormSelect>
        <Helper error={errors[f]} />
      </FormGroup>
    );
  };

  const warning = reminderWarning(eff);

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup label="Inactivity reminder" fieldId="cs-reminder">
        {switchField('reminderOn', 'cs-reminder', 'Send a reminder', 'Send a reminder when the person goes quiet')}
        {eff.reminderOn && (
          <div className="omni-form-field__row">
            {numberField('reminderAfterMinutes', 'cs-reminder-after', 'Remind after minutes')}
            {messageField('reminderMessage', 'cs-reminder-message', 'Reminder message', 'Reminder message')}
          </div>
        )}
        {warning && (
          <HelperText>
            <HelperTextItem variant="warning">{warning}</HelperTextItem>
          </HelperText>
        )}
      </FormGroup>
      <FormGroup label="Inactivity end" fieldId="cs-end-after">
        <div className="omni-form-field__row">
          {numberField('endAfterMinutes', 'cs-end-after', 'End after minutes', true)}
          {messageField(
            'endMessage',
            'cs-end-message',
            'End message',
            'Message when the chatbot ends',
            'Send no end message',
          )}
        </div>
        <p className="pf-v6-u-color-200">A run that waits longer than this for the person ends on its own.</p>
      </FormGroup>
      <FormGroup label="Invalid replies" fieldId="cs-retries">
        <div className="omni-form-field__row">
          {numberField('invalidReplyRetries', 'cs-retries', 'Retries', true)}
          {messageField('retryMessage', 'cs-retry-message', 'Retry message', 'Retry message')}
        </div>
        {messageField(
          'giveUpMessage',
          'cs-give-up',
          'Give-up message',
          'Message after the last retry',
          'Send no give-up message',
        )}
      </FormGroup>
      <FormGroup label="Agent reply" fieldId="cs-stop">
        {switchField(
          'stopOnAgentReply',
          'cs-stop',
          'Stop when an agent replies',
          'Stop when an agent replies in the chat',
        )}
      </FormGroup>
      <FormGroup label="When the chatbot ends" fieldId="cs-after" role="group">
        {choiceField('whenCompleted', 'cs-completed', 'When the chatbot finishes', [
          ['CLOSE', 'Close the chat'],
          ['ROUTE', 'Send to the team'],
        ])}
        {choiceField('whenAbandoned', 'cs-abandoned', 'When the customer stops answering', [
          ['ROUTE', 'Send to the team'],
          ['CLOSE', 'Close the chat'],
        ])}
        <Helper note="A chatbot that fails always sends the chat to the team." />
      </FormGroup>
    </Form>
  );
};
