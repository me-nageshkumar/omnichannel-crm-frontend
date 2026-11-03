import * as React from 'react';
import {
  Button,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import type { AutomationOptions, ConditionLeaf, EventKind } from '@app/api/automations';
import { type AutomationField, FIELDS, OPERATOR_LABELS } from '@app/Automations/automationModel';
import { ConditionValueInput } from '@app/Automations/ConditionValueInput';

/** The value a field starts with under an operator, keeping what still fits of the one before. */
function valueFor(spec: AutomationField, operator: string, before: ConditionLeaf['value']): ConditionLeaf['value'] {
  if (operator === 'is_empty' || operator === 'is_not_empty') return null;
  switch (spec.type) {
    case 'boolean':
      return typeof before === 'boolean' ? before : true;
    case 'text':
      return typeof before === 'string' ? before : '';
    case 'number':
      if (operator === 'between') return Array.isArray(before) ? before : [];
      return typeof before === 'number' ? before : null;
    case 'choice':
      if (operator === 'is_one_of') {
        if (Array.isArray(before)) return before;
        return typeof before === 'string' && before !== '' ? [before] : [];
      }
      if (typeof before === 'string') return before;
      return Array.isArray(before) && before.length > 0 ? String(before[0]) : '';
  }
}

/** One condition: field (its description under it), operator (none for yes/no fields), value, and Remove. */
export const ConditionRow: React.FunctionComponent<{
  event: EventKind;
  leaf: ConditionLeaf;
  options: AutomationOptions;
  error?: string;
  isDisabled: boolean;
  onChange(leaf: ConditionLeaf): void;
  onRemove(): void;
}> = ({ event, leaf, options, error, isDisabled, onChange, onRemove }) => {
  const fields = FIELDS[event];
  const spec = fields.find((f) => f.field === leaf.field);
  const chooseField = (field: string) => {
    const next = fields.find((f) => f.field === field);
    if (!next) return;
    const operator = next.operators[0];
    onChange({ field, operator, value: valueFor(next, operator, null) });
  };
  return (
    <div>
      <Flex alignItems={{ default: 'alignItemsFlexStart' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <FormSelect
            aria-label="Field"
            value={leaf.field}
            isDisabled={isDisabled}
            onChange={(_e, v) => chooseField(v)}
          >
            {!spec && <FormSelectOption value={leaf.field} label="Unknown field" isDisabled />}
            {fields.map((f) => (
              <FormSelectOption key={f.field} value={f.field} label={f.label} />
            ))}
          </FormSelect>
          {spec && (
            <HelperText>
              <HelperTextItem>{spec.description}</HelperTextItem>
            </HelperText>
          )}
        </FlexItem>
        {spec && spec.type !== 'boolean' && (
          <FlexItem>
            <FormSelect
              aria-label="Operator"
              value={leaf.operator}
              isDisabled={isDisabled}
              onChange={(_e, operator) => onChange({ ...leaf, operator, value: valueFor(spec, operator, leaf.value) })}
            >
              {spec.operators.map((op) => (
                <FormSelectOption key={op} value={op} label={OPERATOR_LABELS[op] ?? op} />
              ))}
            </FormSelect>
          </FlexItem>
        )}
        {spec && (
          <FlexItem>
            <ConditionValueInput
              field={spec}
              operator={leaf.operator}
              value={leaf.value}
              options={options}
              isDisabled={isDisabled}
              onChange={(value) => onChange({ ...leaf, value })}
            />
          </FlexItem>
        )}
        <FlexItem>
          <Button
            variant="plain"
            aria-label="Remove condition"
            icon={<TimesIcon />}
            isDisabled={isDisabled}
            onClick={onRemove}
          />
        </FlexItem>
      </Flex>
      {error && (
        <HelperText>
          <HelperTextItem variant="error">{error}</HelperTextItem>
        </HelperText>
      )}
    </div>
  );
};
