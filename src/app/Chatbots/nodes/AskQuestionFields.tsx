import * as React from 'react';
import { Form, FormGroup, FormSelect, FormSelectOption, NumberInput, TextInput } from '@patternfly/react-core';
import type { NodeFieldsProps } from '@app/Chatbots/editor/NodeDrawer';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import { ErrorLine, str, useVariables } from '@app/Chatbots/nodes/common';

const TYPES: [string, string][] = [
  ['TEXT', 'Text'],
  ['NUMBER', 'Number'],
  ['EMAIL', 'Email'],
  ['PHONE', 'Phone'],
  ['DATE', 'Date'],
  ['LOCATION', 'Location'],
  ['FILE', 'File (any)'],
  ['IMAGE', 'Image'],
  ['VIDEO', 'Video'],
  ['AUDIO', 'Audio'],
  ['DOCUMENT', 'Document'],
];

export const AskQuestionFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const s = p.settings;
  const vars = useVariables(p);
  const set = (patch: Record<string, unknown>) => p.onChange({ ...s, ...patch });
  const retries = typeof s.retries === 'number' ? s.retries : 2;
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup label="Question" isRequired fieldId="aq-text">
        <VariableInput
          id="aq-text"
          aria-label="Question"
          multiline
          value={str(s.text)}
          onChange={(v) => set({ text: v })}
          variables={vars}
          isDisabled={p.isDisabled}
          validated={p.errors['settings.text'] ? 'error' : 'default'}
        />
        <ErrorLine message={p.errors['settings.text']} />
      </FormGroup>
      <FormGroup label="Answer type" fieldId="aq-type">
        <FormSelect
          id="aq-type"
          aria-label="Answer type"
          value={str(s.answerType) || 'TEXT'}
          isDisabled={p.isDisabled}
          onChange={(_e, v) => set({ answerType: v })}
        >
          {TYPES.map(([v, l]) => (
            <FormSelectOption key={v} value={v} label={l} />
          ))}
        </FormSelect>
        <ErrorLine message={p.errors['settings.answerType']} />
      </FormGroup>
      <FormGroup label="Save as" fieldId="aq-save" labelHelp={undefined}>
        <TextInput
          id="aq-save"
          aria-label="Save as"
          placeholder={p.node.data.name}
          value={str(s.saveAs)}
          isDisabled={p.isDisabled}
          onChange={(_e, v) => set({ saveAs: v })}
          validated={p.errors['settings.saveAs'] ? 'error' : 'default'}
        />
        <ErrorLine
          message={p.errors['settings.saveAs'] ?? `The answer is {{${str(s.saveAs) || p.node.data.name}.answer}}`}
        />
      </FormGroup>
      <FormGroup label="Also save into a contact attribute" fieldId="aq-attr">
        <FormSelect
          id="aq-attr"
          aria-label="Contact attribute"
          value={str(s.attributeId)}
          isDisabled={p.isDisabled}
          onChange={(_e, v) => set({ attributeId: v || null })}
        >
          <FormSelectOption value="" label="None" />
          {(p.options?.attributes ?? []).map((a) => (
            <FormSelectOption key={a.id} value={a.id} label={a.name} />
          ))}
        </FormSelect>
        <ErrorLine message={p.errors['settings.attributeId']} />
      </FormGroup>
      <FormGroup label="Re-ask up to" fieldId="aq-retries">
        <NumberInput
          id="aq-retries"
          inputAriaLabel="Retries"
          value={retries}
          min={0}
          max={5}
          isDisabled={p.isDisabled}
          onMinus={() => set({ retries: Math.max(0, retries - 1) })}
          onPlus={() => set({ retries: Math.min(5, retries + 1) })}
          onChange={(e) =>
            set({ retries: Math.min(5, Math.max(0, Number((e.target as HTMLInputElement).value) || 0)) })
          }
          unit="times"
        />
        <ErrorLine message={p.errors['settings.retries']} />
      </FormGroup>
      <FormGroup label="Re-ask message" fieldId="aq-retry">
        <VariableInput
          id="aq-retry"
          aria-label="Re-ask message"
          value={str(s.retryMessage)}
          onChange={(v) => set({ retryMessage: v })}
          variables={vars}
          isDisabled={p.isDisabled}
          placeholder="The chatbot's default re-ask message"
        />
        <ErrorLine message={p.errors['settings.retryMessage']} />
      </FormGroup>
      <FormGroup label="Give-up message" fieldId="aq-giveup">
        <VariableInput
          id="aq-giveup"
          aria-label="Give-up message"
          value={str(s.giveUpMessage)}
          onChange={(v) => set({ giveUpMessage: v })}
          variables={vars}
          isDisabled={p.isDisabled}
        />
        <ErrorLine message={p.errors['settings.giveUpMessage']} />
      </FormGroup>
    </Form>
  );
};
