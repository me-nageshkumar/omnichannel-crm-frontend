import * as React from 'react';
import { FormSelect, FormSelectOption } from '@patternfly/react-core';
import type { IndianState } from '@app/api/billing';

/** "29 · Karnataka": a state as GST knows it, by its code. */
export const stateText = (code: string | null, states: IndianState[]): string => {
  if (!code) return '';
  const state = states.find((s) => s.code === code);
  return state ? `${state.code} · ${state.name}` : code;
};

export const StateSelect: React.FunctionComponent<{
  id: string;
  value: string;
  states: IndianState[];
  isDisabled?: boolean;
  onChange(code: string): void;
}> = ({ id, value, states, isDisabled, onChange }) => (
  <FormSelect id={id} value={value} isDisabled={isDisabled} onChange={(_e, v) => onChange(v)}>
    <FormSelectOption value="" label="Select a state" isPlaceholder />
    {states.map((s) => (
      <FormSelectOption key={s.code} value={s.code} label={`${s.code} · ${s.name}`} />
    ))}
  </FormSelect>
);
