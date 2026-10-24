import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { createField, updateField } from '@app/api/crm';
import type { FieldDefinition, FieldDefinitionInput, FieldEntityType, FieldType } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { crmMessage } from '@app/Crm/errors';
import { Field } from '@app/Crm/deals/fields';
import { FieldInput } from '@app/Crm/common/fields/FieldInput';
import { isBlank, validateFieldValue } from '@app/Crm/common/fields/validateFieldValue';
import type { FieldDef } from '@app/Crm/common/fields/types';
import { OptionDraft, OptionsEditor } from '@app/Crm/Settings/OptionsEditor';
import { useBrandUsers } from '@app/Crm/fields/useBrandUsers';
import { isCode } from '@app/Crm/Settings/ConflictAlert';

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: 'TEXT', label: 'Text' },
  { type: 'LONG_TEXT', label: 'Long text' },
  { type: 'NUMBER', label: 'Number' },
  { type: 'CURRENCY', label: 'Amount' },
  { type: 'BOOLEAN', label: 'Yes or no' },
  { type: 'DATE', label: 'Date' },
  { type: 'DATETIME', label: 'Date and time' },
  { type: 'SELECT', label: 'Single choice' },
  { type: 'MULTI_SELECT', label: 'Multiple choice' },
  { type: 'URL', label: 'Web address' },
  { type: 'EMAIL', label: 'Email' },
  { type: 'PHONE', label: 'Phone' },
  { type: 'USER', label: 'User' },
];

const KEY = /^[a-z][a-zA-Z0-9_]{1,39}$/;
const FIELDS = ['label', 'key', 'type', 'options', 'defaultValue'];
const isChoice = (t: FieldType) => t === 'SELECT' || t === 'MULTI_SELECT';

/** A field key from a label, in camelCase: "Budget tier" becomes "budgetTier". */
export function fieldKey(label: string): string {
  const words = label
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const joined = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
    .replace(/^[^a-z]+/, '');
  return joined.slice(0, 40);
}

/** Creates a custom field of {@code entity}, or edits one: entity, key and type are fixed once saved. */
export const FieldFormModal: React.FunctionComponent<{
  entity: FieldEntityType;
  field?: FieldDefinition;
  readOnly?: boolean;
  onClose(): void;
  onSaved(saved: FieldDefinition): void;
}> = ({ entity, field, readOnly, onClose, onSaved }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const isEdit = !!field;
  const [label, setLabel] = React.useState(field?.label ?? '');
  const [key, setKey] = React.useState(field?.key ?? '');
  const [keyTouched, setKeyTouched] = React.useState(isEdit);
  const [type, setType] = React.useState<FieldType>(field?.type ?? 'TEXT');
  const [options, setOptions] = React.useState<OptionDraft[]>(
    () =>
      field?.options
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ uid: o.key, key: o.key, label: o.label, color: o.color, active: o.active, saved: true })) ?? [],
  );
  const [required, setRequired] = React.useState(field?.required ?? false);
  const [defaultValue, setDefaultValue] = React.useState<unknown>(field?.defaultValue ?? null);
  const [showInList, setShowInList] = React.useState(field?.showInList ?? false);
  const [showInCard, setShowInCard] = React.useState(field?.showInCard ?? false);
  const [checked, setChecked] = React.useState(false);
  const action = useAction(FIELDS);
  const users = useBrandUsers();

  const draftDef: FieldDef = {
    key: key || 'default',
    label: 'Default value',
    type,
    options: options.map((o, i) => ({ key: o.key, label: o.label, color: o.color, position: i, active: o.active })),
    required: false,
    active: true,
    showInList,
    showInCard,
    position: 0,
  };
  const choice = isChoice(type);
  const optionsOk = !choice || (options.length > 0 && options.every((o) => o.label.trim() && o.key));
  const errors = {
    label:
      checked && !label.trim()
        ? 'Give the field a label.'
        : checked && label.trim().length > 60
          ? 'Use at most 60 characters.'
          : null,
    key: checked && !KEY.test(key) ? 'Use 2 to 40 letters, digits or _, starting with a lower-case letter.' : null,
    options: checked && !optionsOk ? 'Add at least one option, and give every option a label.' : null,
    defaultValue: checked ? validateFieldValue(draftDef, defaultValue, field?.defaultValue) : null,
  };
  const shown = (k: keyof typeof errors) => errors[k] ?? action.fieldErrors[k] ?? null;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    const problems = {
      label: !label.trim() || label.trim().length > 60,
      key: !KEY.test(key),
      options: !optionsOk,
      defaultValue: validateFieldValue(draftDef, defaultValue, field?.defaultValue) !== null,
    };
    if (Object.values(problems).some(Boolean)) return;
    const body: FieldDefinitionInput = {
      entityType: entity,
      key,
      label: label.trim(),
      type,
      options: choice
        ? options.map((o) => ({ key: o.key, label: o.label.trim(), color: o.color, active: o.active }))
        : undefined,
      required,
      // On update a blank default is sent as "" so a stored one is cleared; on create blank is just absent.
      defaultValue: isBlank(defaultValue) ? (isEdit && !isBlank(field?.defaultValue) ? '' : undefined) : defaultValue,
      showInList,
      showInCard,
      version: field?.version,
    };
    const t = token as string;
    const saved = await action.run(
      () => (field ? updateField(t, ws, field.id, body) : createField(t, ws, body)),
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) return 'Someone else changed this field. Close this form and open it again.';
        if (isCode(e, 'FIELD_KEY_TAKEN')) return 'Another field of this record type already uses this key.';
        return crmMessage(e, 'Could not save the field. Try again.');
      },
    );
    if (saved) onSaved(saved);
  };

  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="crm-field-title">
      <ModalHeader title={isEdit ? 'Edit field' : 'New field'} labelId="crm-field-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} className="pf-v6-u-mb-md" />}
        <Form id="crm-field-form" onSubmit={onSubmit}>
          <Field label="Label" fieldId="crm-field-label" isRequired error={shown('label')}>
            <TextInput
              id="crm-field-label"
              value={label}
              isDisabled={readOnly}
              validated={shown('label') ? 'error' : 'default'}
              onChange={(_e, v) => {
                setLabel(v);
                if (!keyTouched) setKey(fieldKey(v));
              }}
            />
          </Field>
          <Field
            label="Key"
            fieldId="crm-field-key"
            isRequired
            error={shown('key')}
            help={
              isEdit
                ? 'The key never changes once the field is saved.'
                : 'Letters, digits and _; starts with a lower-case letter.'
            }
          >
            <TextInput
              id="crm-field-key"
              value={key}
              readOnlyVariant={isEdit ? 'default' : undefined}
              isDisabled={readOnly && !isEdit}
              validated={shown('key') ? 'error' : 'default'}
              onChange={(_e, v) => {
                setKey(v);
                setKeyTouched(true);
              }}
            />
          </Field>
          <Field label="Type" fieldId="crm-field-type" isRequired error={action.fieldErrors.type ?? null}>
            <FormSelect
              id="crm-field-type"
              value={type}
              isDisabled={isEdit || readOnly}
              onChange={(_e, v) => {
                setType(v as FieldType);
                setDefaultValue(null);
              }}
            >
              {FIELD_TYPES.map((t) => (
                <FormSelectOption key={t.type} value={t.type} label={t.label} />
              ))}
            </FormSelect>
          </Field>
          {choice && (
            <Field label="Options" fieldId="crm-field-options" isRequired error={shown('options')}>
              <OptionsEditor options={options} onChange={setOptions} readOnly={readOnly} />
            </Field>
          )}
          <FieldInput
            id="crm-field-default"
            def={draftDef}
            value={defaultValue}
            onChange={setDefaultValue}
            error={shown('defaultValue')}
            readOnly={readOnly}
            users={users}
          />
          <Checkbox
            id="crm-field-required"
            label="Required when someone saves the record"
            isChecked={required}
            isDisabled={readOnly}
            onChange={(_e, v) => setRequired(v)}
          />
          <Checkbox
            id="crm-field-list"
            label="Show in lists"
            isChecked={showInList}
            isDisabled={readOnly}
            onChange={(_e, v) => setShowInList(v)}
          />
          <Checkbox
            id="crm-field-card"
            label="Show on cards and in record details"
            isChecked={showInCard}
            isDisabled={readOnly}
            onChange={(_e, v) => setShowInCard(v)}
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        {!readOnly && (
          <Button
            variant="primary"
            type="submit"
            form="crm-field-form"
            isLoading={action.busy}
            isDisabled={action.busy}
          >
            Save
          </Button>
        )}
        <Button variant="link" onClick={onClose}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
