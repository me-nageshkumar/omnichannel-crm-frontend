import * as React from 'react';
import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import type { NodeFieldsProps } from '@app/Chatbots/editor/NodeDrawer';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import { OPERATOR_LABELS } from '@app/Automations/automationModel';
import { ErrorLine, str, useVariables } from '@app/Chatbots/nodes/common';
import type { VariableGroup } from '@app/Chatbots/variables';

export interface Leaf {
  field: string;
  operator: string;
  value: unknown;
}
export interface Group {
  combinator: 'and' | 'or';
  not: boolean;
  rules: Leaf[];
}
interface Case {
  id: string;
  label: string;
  conditions: Group | null;
}

const OPERATORS = Object.keys(OPERATOR_LABELS);
const NO_VALUE = ['is_empty', 'is_not_empty'];
const newId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

export const ConditionFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const vars = useVariables(p);
  const cases = (Array.isArray(p.settings.cases) ? p.settings.cases : []) as Case[];
  const setCases = (next: Case[]) => p.onChange({ ...p.settings, cases: next });
  const setCase = (i: number, patch: Partial<Case>) =>
    setCases(cases.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const group = (c: Case): Group => c.conditions ?? { combinator: 'and', not: false, rules: [] };
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <ErrorLine message={p.errors['settings.cases']} />
      {cases.map((c, i) => {
        const g = group(c);
        return (
          <FormGroup key={c.id} label={`Case ${i + 1}`} fieldId={`cond-${i}`} role="group" aria-label={`Case ${i + 1}`}>
            <div className="omni-form-field__row">
              <TextInput
                id={`cond-${i}`}
                aria-label={`Case ${i + 1} label`}
                placeholder="Label (the output's name)"
                value={c.label ?? ''}
                isDisabled={p.isDisabled}
                onChange={(_e, v) => setCase(i, { label: v })}
              />
              <ToggleGroup aria-label="Match">
                <ToggleGroupItem
                  text="All of these"
                  isSelected={g.combinator === 'and'}
                  isDisabled={p.isDisabled}
                  onChange={() => setCase(i, { conditions: { ...g, combinator: 'and' } })}
                />
                <ToggleGroupItem
                  text="Any of these"
                  isSelected={g.combinator === 'or'}
                  isDisabled={p.isDisabled}
                  onChange={() => setCase(i, { conditions: { ...g, combinator: 'or' } })}
                />
              </ToggleGroup>
              <Button
                variant="plain"
                aria-label={`Move case ${i + 1} up`}
                isDisabled={p.isDisabled || i === 0}
                onClick={() => {
                  const n = cases.slice();
                  [n[i - 1], n[i]] = [n[i], n[i - 1]];
                  setCases(n);
                }}
              >
                ↑
              </Button>
              <Button
                variant="plain"
                aria-label={`Remove case ${i + 1}`}
                isDisabled={p.isDisabled}
                onClick={() => setCases(cases.filter((_c, j) => j !== i))}
              >
                ×
              </Button>
            </div>
            <ErrorLine
              message={
                p.errors[`settings.cases[${i}].label`] ??
                p.errors[`settings.cases[${i}].conditions`] ??
                p.errors[`settings.cases[${i}].conditions.rules`]
              }
            />
            <ConditionGroupFields
              group={g}
              onChange={(next) => setCase(i, { conditions: next })}
              vars={vars}
              isDisabled={p.isDisabled}
              idPrefix={`cond-${i}`}
              label={`Case ${i + 1}`}
              errors={p.errors}
              errorBase={`settings.cases[${i}].conditions`}
            />
          </FormGroup>
        );
      })}
      <Button
        variant="secondary"
        isDisabled={p.isDisabled}
        onClick={() =>
          setCases(
            cases.concat([
              {
                id: newId(),
                label: `Case ${cases.length + 1}`,
                conditions: { combinator: 'and', not: false, rules: [] },
              },
            ]),
          )
        }
      >
        Add case
      </Button>
      <p className="pf-v6-u-color-200">
        The first case that matches wins; nothing matching takes the Otherwise output.
      </p>
    </Form>
  );
};

/**
 * One group of conditions (all/any of these rules), shared by the condition node's cases and the AI node's exit
 * condition. Aria labels read "<label> condition <n>"; errors are looked up under `<errorBase>.rules[<k>]`.
 */
export const ConditionGroupFields: React.FunctionComponent<{
  group: Group;
  onChange(group: Group): void;
  vars: VariableGroup[];
  isDisabled?: boolean;
  idPrefix: string;
  label: string;
  errors: Record<string, string>;
  errorBase: string;
}> = ({ group: g, onChange, vars, isDisabled, idPrefix, label, errors, errorBase }) => {
  const setRule = (k: number, patch: Partial<Leaf>) =>
    onChange({ ...g, rules: g.rules.map((x, m) => (m === k ? { ...x, ...patch } : x)) });
  return (
    <>
      {g.rules.map((r, k) => {
        const base = `${errorBase}.rules[${k}]`;
        const between = r.operator === 'between';
        const values = Array.isArray(r.value) ? (r.value as unknown[]).map(str) : [str(r.value), ''];
        return (
          <div
            key={k}
            className="omni-form-field__row omni-rule"
            role="group"
            aria-label={`${label} condition ${k + 1}`}
          >
            <VariableInput
              id={`${idPrefix}-${k}-field`}
              aria-label="Variable"
              placeholder="{{AskBudget.answer}}"
              value={r.field}
              onChange={(v) => setRule(k, { field: v })}
              variables={vars}
              isDisabled={isDisabled}
              validated={errors[`${base}.field`] ? 'error' : 'default'}
            />
            <FormSelect
              aria-label="Operator"
              value={r.operator}
              isDisabled={isDisabled}
              onChange={(_e, v) =>
                setRule(k, {
                  operator: v,
                  value: v === 'between' ? ['', ''] : NO_VALUE.indexOf(v) >= 0 ? null : str(r.value),
                })
              }
            >
              {OPERATORS.map((o) => (
                <FormSelectOption key={o} value={o} label={OPERATOR_LABELS[o]} />
              ))}
            </FormSelect>
            {NO_VALUE.indexOf(r.operator) < 0 && !between && (
              <VariableInput
                id={`${idPrefix}-${k}-value`}
                aria-label="Value"
                value={str(r.value)}
                onChange={(v) => setRule(k, { value: v })}
                variables={vars}
                isDisabled={isDisabled}
                validated={errors[`${base}.value`] ? 'error' : 'default'}
              />
            )}
            {between && (
              <>
                <TextInput
                  aria-label="Low"
                  value={values[0] ?? ''}
                  isDisabled={isDisabled}
                  onChange={(_e, v) => setRule(k, { value: [v, values[1] ?? ''] })}
                />
                <TextInput
                  aria-label="High"
                  value={values[1] ?? ''}
                  isDisabled={isDisabled}
                  onChange={(_e, v) => setRule(k, { value: [values[0] ?? '', v] })}
                />
              </>
            )}
            <Button
              variant="plain"
              aria-label={`Remove ${label.toLowerCase().startsWith('case') ? label.toLowerCase() : label} condition ${k + 1}`}
              isDisabled={isDisabled}
              onClick={() => onChange({ ...g, rules: g.rules.filter((_x, m) => m !== k) })}
            >
              ×
            </Button>
            <ErrorLine message={errors[`${base}.field`] ?? errors[`${base}.operator`] ?? errors[`${base}.value`]} />
          </div>
        );
      })}
      <Button
        variant="link"
        isInline
        isDisabled={isDisabled}
        onClick={() => onChange({ ...g, rules: g.rules.concat([{ field: '', operator: 'is', value: '' }]) })}
      >
        Add condition
      </Button>
    </>
  );
};
