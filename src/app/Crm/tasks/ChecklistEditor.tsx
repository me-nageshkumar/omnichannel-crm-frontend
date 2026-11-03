import * as React from 'react';
import { Button, HelperText, HelperTextItem, Label, TextInput } from '@patternfly/react-core';
import { AngleDownIcon, AngleUpIcon, PlusIcon, TimesIcon } from '@patternfly/react-icons';

export const MAX_STEPS = 30;

/** A step in the editor: a stored one keeps its id (and its tick); a new one has none. */
export interface StepDraft {
  id?: string;
  text: string;
  done?: boolean;
  /** A stable React key for steps that have no id yet. */
  key: string;
}

let nextKey = 0;
export const newStep = (text: string): StepDraft => ({ text, key: `new-${nextKey++}` });

const row: React.CSSProperties = { display: 'flex', gap: 'var(--pf-t--global--spacer--xs)', alignItems: 'center' };

/**
 * The task form's steps (spec E C17): text inputs in order, move up/down, remove, and an "Add a step" input (Enter
 * adds). Ticking happens on the task row, not here; a ticked step only shows "done".
 */
export const ChecklistEditor: React.FunctionComponent<{
  value: StepDraft[];
  onChange(items: StepDraft[]): void;
  /** Server errors by step index. */
  errors?: Record<number, string>;
  /** The text in "Add a step", held by the form so a save can keep it. */
  draft: string;
  onDraftChange(draft: string): void;
}> = ({ value, onChange, errors = {}, draft, onDraftChange }) => {
  const full = value.length >= MAX_STEPS;
  const add = () => {
    const text = draft.trim();
    if (!text || full) return;
    onChange([...value, newStep(text)]);
    onDraftChange('');
  };
  const move = (index: number, delta: number) => {
    const items = [...value];
    const [item] = items.splice(index, 1);
    items.splice(index + delta, 0, item);
    onChange(items);
  };
  return (
    <div style={{ display: 'grid', gap: 'var(--pf-t--global--spacer--xs)' }}>
      {value.map((item, index) => (
        <div key={item.key}>
          <div style={row}>
            <TextInput
              aria-label={`Step ${index + 1}`}
              value={item.text}
              maxLength={200}
              validated={errors[index] ? 'error' : 'default'}
              onChange={(_e, text) => onChange(value.map((s, i) => (i === index ? { ...s, text } : s)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
            />
            {item.done && (
              <Label isCompact color="green">
                done
              </Label>
            )}
            <Button
              variant="plain"
              aria-label={`Move step ${index + 1} up`}
              icon={<AngleUpIcon />}
              isDisabled={index === 0}
              onClick={() => move(index, -1)}
            />
            <Button
              variant="plain"
              aria-label={`Move step ${index + 1} down`}
              icon={<AngleDownIcon />}
              isDisabled={index === value.length - 1}
              onClick={() => move(index, 1)}
            />
            <Button
              variant="plain"
              isDanger
              aria-label={`Remove step ${index + 1}`}
              icon={<TimesIcon />}
              onClick={() => onChange(value.filter((_s, i) => i !== index))}
            />
          </div>
          {errors[index] && (
            // the form scrolls to the first error helper text after a failed save
            <HelperText>
              <HelperTextItem variant="error">{errors[index]}</HelperTextItem>
            </HelperText>
          )}
        </div>
      ))}
      <div style={row}>
        <TextInput
          aria-label="Add a step"
          value={draft}
          maxLength={200}
          isDisabled={full}
          placeholder={full ? `At most ${MAX_STEPS} steps` : 'Add a step and press Enter'}
          onChange={(_e, v) => onDraftChange(v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" icon={<PlusIcon />} isDisabled={full || !draft.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
};
