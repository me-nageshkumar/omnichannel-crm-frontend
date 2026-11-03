import * as React from 'react';
import { Checkbox, Flex, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import type { AutomationOptions, ConditionLeaf } from '@app/api/automations';
import { type AutomationField, BOOLEAN_CHOICES, MESSAGE_KINDS, choicesFor } from '@app/Automations/automationModel';

type Value = ConditionLeaf['value'];

const asNumber = (v: string): number | null => (v.trim() === '' || isNaN(Number(v)) ? null : Number(v));
const shownNumber = (v: unknown): string => (typeof v === 'number' ? String(v) : '');

/** The value control of one condition, by its field's type and operator. */
export const ConditionValueInput: React.FunctionComponent<{
  field: AutomationField;
  operator: string;
  value: Value;
  options: AutomationOptions;
  isDisabled: boolean;
  onChange(value: Value): void;
}> = ({ field, operator, value, options, isDisabled, onChange }) => {
  const id = React.useId();
  if (operator === 'is_empty' || operator === 'is_not_empty') return null;
  const list: (string | number)[] = Array.isArray(value) ? value : [];
  switch (field.type) {
    case 'boolean': {
      const [yes, no] = BOOLEAN_CHOICES[field.field as keyof typeof BOOLEAN_CHOICES];
      return (
        <FormSelect
          aria-label="Value"
          value={value === false ? 'false' : 'true'}
          isDisabled={isDisabled}
          onChange={(_e, v) => onChange(v === 'true')}
        >
          <FormSelectOption value="true" label={yes} />
          <FormSelectOption value="false" label={no} />
        </FormSelect>
      );
    }
    case 'text':
      return (
        <TextInput
          aria-label="Value"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          isDisabled={isDisabled}
          onChange={(_e, v) => onChange(v)}
        />
      );
    case 'number': {
      if (operator !== 'between') {
        return (
          <TextInput
            type="number"
            aria-label="Value"
            value={shownNumber(value)}
            placeholder={field.placeholder}
            isDisabled={isDisabled}
            onChange={(_e, v) => onChange(asNumber(v))}
          />
        );
      }
      // a half-typed range keeps its empty end as null, which the server names as missing
      const range = (from: unknown, to: unknown) => [from ?? null, to ?? null] as unknown as number[];
      return (
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <TextInput
            type="number"
            aria-label="From"
            value={shownNumber(list[0])}
            placeholder={field.placeholder}
            isDisabled={isDisabled}
            onChange={(_e, v) => onChange(range(asNumber(v), list[1]))}
          />
          <span>and</span>
          <TextInput
            type="number"
            aria-label="To"
            value={shownNumber(list[1])}
            placeholder={field.placeholder}
            isDisabled={isDisabled}
            onChange={(_e, v) => onChange(range(list[0], asNumber(v)))}
          />
        </Flex>
      );
    }
    case 'choice': {
      const choices = choicesFor(field.field, options);
      if (operator !== 'is_one_of') {
        const text = typeof value === 'string' ? value : '';
        return (
          <FormSelect aria-label="Value" value={text} isDisabled={isDisabled} onChange={(_e, v) => onChange(v)}>
            <FormSelectOption value="" label="Choose a value" isPlaceholder />
            {text !== '' && !choices.some((c) => c.value === text) && (
              <FormSelectOption value={text} label="—" isDisabled />
            )}
            {choices.map((c) => (
              <FormSelectOption key={c.value} value={c.value} label={c.label} />
            ))}
          </FormSelect>
        );
      }
      const picked = list.map(String);
      // kept in the choices' order, whatever order they were ticked in
      const tick = (on: boolean, v: string) =>
        onChange(choices.map((c) => c.value).filter((c) => (c === v ? on : picked.indexOf(c) >= 0)));
      const all = field.field === 'message.type';
      return (
        <Flex role="group" aria-label="Value" spaceItems={{ default: 'spaceItemsMd' }}>
          {all && (
            <Checkbox
              id={`${id}-all`}
              label="All"
              isChecked={MESSAGE_KINDS.every((k) => picked.indexOf(k.kind) >= 0)}
              isDisabled={isDisabled}
              onChange={(_e, on) => onChange(on ? MESSAGE_KINDS.map((k) => k.kind) : [])}
            />
          )}
          {choices.map((c) => (
            <Checkbox
              key={c.value}
              id={`${id}-${c.value}`}
              label={c.label}
              isChecked={picked.indexOf(c.value) >= 0}
              isDisabled={isDisabled}
              onChange={(_e, on) => tick(on, c.value)}
            />
          ))}
        </Flex>
      );
    }
  }
};
