import * as React from 'react';
import {
  Button,
  Checkbox,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  FormSelectOptionGroup,
  HelperText,
  HelperTextItem,
  TextInput,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import { SOURCES } from '@app/api/contacts';
import type { ContactAttribute, ContactLabel, ContactSource, Rule } from '@app/api/contacts';
import { SOURCE_TEXT } from '@app/Contacts/contactDisplay';
import { LabelPicker } from '@app/Contacts/FilterPanel';
import {
  FieldGroup,
  MAX_VALUES,
  MAX_VALUE_LENGTH,
  OPERATORS,
  OPERATOR_LABELS,
  Path,
  fieldOptions,
  fieldType,
  nodeName,
  ruleMissing,
  rulePath,
  valueKind,
  withField,
  withOperator,
} from '@app/Contacts/Filters/filterModel';

const FIELD_GROUPS: FieldGroup[] = ['Contact fields', 'Labels', 'Attributes'];
const MISSING_TEXT = { attribute: 'Missing attribute', label: 'Missing label' } as const;

/** One rule: field, operator, a value editor that follows the operator, and Remove rule. */
export const RuleEditor: React.FunctionComponent<{
  rule: Rule;
  path: Path;
  labels: ContactLabel[];
  attributes: ContactAttribute[];
  error?: string;
  isDisabled?: boolean;
  onChange(rule: Rule): void;
  onRemove(): void;
}> = ({ rule, path, labels, attributes, error, isDisabled = false, onChange, onRemove }) => {
  const id = rulePath(path);
  const type = fieldType(rule.field);
  const missing = ruleMissing(rule, labels, attributes);
  const options = fieldOptions(attributes);
  const text = typeof rule.value === 'string' ? rule.value : '';
  const list = Array.isArray(rule.value) ? rule.value : [];
  const setValue = (value: Rule['value']) => onChange({ ...rule, value });

  const valueEditor = () => {
    if (!type) return null;
    switch (valueKind(type, rule.operator)) {
      case 'none':
        return null;
      case 'text':
        return (
          <TextInput
            aria-label="Value"
            value={text}
            maxLength={MAX_VALUE_LENGTH}
            isDisabled={isDisabled}
            onChange={(_e, v) => setValue(v)}
          />
        );
      case 'option':
        return (
          <FormSelect aria-label="Value" value={text} isDisabled={isDisabled} onChange={(_e, v) => setValue(v)}>
            <FormSelectOption value="" label="Choose a value" isPlaceholder />
            {type === 'enum'
              ? SOURCES.map((s) => <FormSelectOption key={s} value={s} label={SOURCE_TEXT[s]} />)
              : [
                  <FormSelectOption key="true" value="true" label="Yes" />,
                  <FormSelectOption key="false" value="false" label="No" />,
                ]}
          </FormSelect>
        );
      case 'options': {
        const toggle = (s: ContactSource, on: boolean) =>
          setValue(SOURCES.filter((x) => (x === s ? on : list.includes(x))));
        return (
          <Flex role="group" aria-label="Value">
            {SOURCES.map((s) => (
              <Checkbox
                key={s}
                id={`${id}-source-${s}`}
                label={SOURCE_TEXT[s]}
                isChecked={list.includes(s)}
                isDisabled={isDisabled}
                onChange={(_e, on) => toggle(s, on)}
              />
            ))}
          </Flex>
        );
      }
      case 'date':
        return (
          <TextInput
            type="date"
            aria-label="Value"
            value={text}
            isDisabled={isDisabled}
            onChange={(_e, v) => setValue(v)}
          />
        );
      case 'dateRange': {
        const [from = '', to = ''] = list;
        return (
          <>
            <TextInput
              type="date"
              aria-label="From"
              value={from}
              isDisabled={isDisabled}
              onChange={(_e, v) => setValue([v, to])}
            />
            <TextInput
              type="date"
              aria-label="To"
              value={to}
              isDisabled={isDisabled}
              onChange={(_e, v) => setValue([from, v])}
            />
          </>
        );
      }
      case 'label':
        return (
          <FormSelect aria-label="Value" value={text} isDisabled={isDisabled} onChange={(_e, v) => setValue(v)}>
            <FormSelectOption value="" label="Choose a label" isPlaceholder />
            {text !== '' && !labels.some((l) => l.id === text) && (
              <FormSelectOption value={text} label="—" isDisabled />
            )}
            {labels.map((l) => (
              <FormSelectOption key={l.id} value={l.id} label={l.name} />
            ))}
          </FormSelect>
        );
      case 'labels':
        return (
          <LabelPicker title="Choose labels" labels={labels} selected={list} onChange={setValue} max={MAX_VALUES} />
        );
    }
  };

  return (
    <div role="group" aria-label={nodeName(path, false)}>
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <FormSelect
            aria-label="Field"
            value={rule.field}
            isDisabled={isDisabled}
            onChange={(_e, v) => onChange(withField(rule, v))}
          >
            <FormSelectOption value="" label="Choose a field" isPlaceholder />
            {missing === 'attribute' && <FormSelectOption value={rule.field} label="—" isDisabled />}
            {FIELD_GROUPS.map((g) => (
              <FormSelectOptionGroup key={g} label={g}>
                {options
                  .filter((o) => o.group === g)
                  .map((o) => (
                    <FormSelectOption key={o.field} value={o.field} label={o.label} />
                  ))}
              </FormSelectOptionGroup>
            ))}
          </FormSelect>
        </FlexItem>
        <FlexItem>
          <FormSelect
            aria-label="Operator"
            value={rule.operator}
            isDisabled={!type || isDisabled}
            onChange={(_e, v) => onChange(withOperator(rule, v))}
          >
            {(type ? OPERATORS[type] : []).map((op) => (
              <FormSelectOption key={op} value={op} label={OPERATOR_LABELS[op]} />
            ))}
          </FormSelect>
        </FlexItem>
        <FlexItem>{valueEditor()}</FlexItem>
        <FlexItem>
          <Button variant="plain" aria-label="Remove rule" icon={<TimesIcon />} onClick={onRemove} />
        </FlexItem>
      </Flex>
      {(missing || error) && (
        <HelperText>
          {missing && <HelperTextItem variant="error">{MISSING_TEXT[missing]}</HelperTextItem>}
          {error && <HelperTextItem variant="error">{error}</HelperTextItem>}
        </HelperText>
      )}
    </div>
  );
};
