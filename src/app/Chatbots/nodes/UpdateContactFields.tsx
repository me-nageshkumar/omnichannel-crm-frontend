import * as React from 'react';
import { Button, Form, FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import type { NodeFieldsProps } from '@app/Chatbots/editor/NodeDrawer';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import { ErrorLine, asList, asMap, str, useVariables } from '@app/Chatbots/nodes/common';

export const UpdateContactFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const vars = useVariables(p);
  const s = p.settings;
  const setAttrs = asMap(s.setAttributes);
  const keys = Object.keys(setAttrs);
  const set = (patch: Record<string, unknown>) => p.onChange({ ...s, ...patch });
  const attributes = p.options?.attributes ?? [];
  const labels = p.options?.labels ?? [];
  const multi = (
    field: 'clearAttributes' | 'addLabels' | 'removeLabels',
    label: string,
    source: { id: string; name: string }[],
  ) => {
    const chosen = asList(s[field]);
    return (
      <FormGroup label={label} fieldId={`uc-${field}`}>
        <FormSelect
          id={`uc-${field}`}
          aria-label={label}
          value=""
          isDisabled={p.isDisabled}
          onChange={(_e, v) => v && chosen.indexOf(v) < 0 && set({ [field]: chosen.concat([v]) })}
        >
          <FormSelectOption value="" label="Add…" />
          {source
            .filter((x) => chosen.indexOf(x.id) < 0)
            .map((x) => (
              <FormSelectOption key={x.id} value={x.id} label={x.name} />
            ))}
        </FormSelect>
        <ul className="omni-chips" aria-label={`${label} chosen`}>
          {chosen.map((id, i) => (
            <li key={id}>
              {source.find((x) => x.id === id)?.name ?? id}{' '}
              <Button
                variant="plain"
                size="sm"
                aria-label={`Remove ${label} ${i + 1}`}
                isDisabled={p.isDisabled}
                onClick={() => set({ [field]: chosen.filter((x) => x !== id) })}
              >
                ×
              </Button>
              <ErrorLine message={p.errors[`settings.${field}[${i}]`]} />
            </li>
          ))}
        </ul>
      </FormGroup>
    );
  };
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <ErrorLine message={p.errors.settings} />
      <FormGroup label="Set attributes" fieldId="uc-set">
        {keys.map((id, i) => (
          <div key={id} className="omni-form-field__row">
            <FormSelect
              aria-label={`Attribute ${i + 1}`}
              value={id}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => {
                const next: Record<string, string> = {};
                keys.forEach((k) => (next[k === id ? v : k] = setAttrs[k]));
                set({ setAttributes: next });
              }}
            >
              <FormSelectOption value="" label="Choose an attribute" />
              {attributes.map((a) => (
                <FormSelectOption key={a.id} value={a.id} label={a.name} />
              ))}
            </FormSelect>
            <VariableInput
              id={`uc-val-${i}`}
              aria-label={`Value ${i + 1}`}
              value={setAttrs[id]}
              onChange={(v) => set({ setAttributes: { ...setAttrs, [id]: v } })}
              variables={vars}
              isDisabled={p.isDisabled}
            />
            <Button
              variant="plain"
              aria-label={`Remove attribute ${i + 1}`}
              isDisabled={p.isDisabled}
              onClick={() => {
                const next = { ...setAttrs };
                delete next[id];
                set({ setAttributes: next });
              }}
            >
              ×
            </Button>
            <ErrorLine message={p.errors[`settings.setAttributes.${id}`]} />
          </div>
        ))}
        <Button
          variant="link"
          isInline
          isDisabled={p.isDisabled || attributes.length === 0}
          onClick={() => {
            const free = attributes.find((a) => !setAttrs[a.id]);
            set({ setAttributes: { ...setAttrs, [free ? free.id : '']: '' } });
          }}
        >
          Set an attribute
        </Button>
      </FormGroup>
      {multi('clearAttributes', 'Clear attributes', attributes)}
      {multi('addLabels', 'Add labels', labels)}
      {multi('removeLabels', 'Remove labels', labels)}
      <FormGroup label="Name the contact if blank" fieldId="uc-name">
        <VariableInput
          id="uc-name"
          aria-label="Name if blank"
          value={str(s.nameIfBlank)}
          onChange={(v) => set({ nameIfBlank: v })}
          variables={vars}
          isDisabled={p.isDisabled}
        />
        <ErrorLine message={p.errors['settings.nameIfBlank']} />
      </FormGroup>
    </Form>
  );
};
