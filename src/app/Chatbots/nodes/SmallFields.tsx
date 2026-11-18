import * as React from 'react';
import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  NumberInput,
  Radio,
  TextInput,
} from '@patternfly/react-core';
import type { NodeFieldsProps } from '@app/Chatbots/editor/NodeDrawer';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import { ErrorLine, asMap, str, useVariables } from '@app/Chatbots/nodes/common';

export const DoNotContactFields: React.FunctionComponent<NodeFieldsProps> = (p) => (
  <Form onSubmit={(e) => e.preventDefault()}>
    <FormGroup role="radiogroup" label="What to do" fieldId="dnc">
      <Radio
        id="dnc-mark"
        name="dnc"
        label="Mark do-not-contact"
        isChecked={p.settings.mark !== false}
        isDisabled={p.isDisabled}
        onChange={() => p.onChange({ mark: true })}
      />
      <Radio
        id="dnc-clear"
        name="dnc"
        label="Clear the mark"
        isChecked={p.settings.mark === false}
        isDisabled={p.isDisabled}
        onChange={() => p.onChange({ mark: false })}
      />
    </FormGroup>
  </Form>
);

const UNITS: [string, string][] = [
  ['MINUTES', 'minutes'],
  ['HOURS', 'hours'],
  ['DAYS', 'days'],
];

export const WaitFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const amount = typeof p.settings.amount === 'number' ? p.settings.amount : 1;
  const set = (patch: Record<string, unknown>) =>
    p.onChange({ amount, unit: str(p.settings.unit) || 'HOURS', ...patch });
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup label="Wait for" fieldId="wait-amount">
        <div className="omni-form-field__row">
          <NumberInput
            id="wait-amount"
            inputAriaLabel="Amount"
            value={amount}
            min={1}
            isDisabled={p.isDisabled}
            onMinus={() => set({ amount: Math.max(1, amount - 1) })}
            onPlus={() => set({ amount: amount + 1 })}
            onChange={(e) => set({ amount: Math.max(1, Number((e.target as HTMLInputElement).value) || 1) })}
          />
          <FormSelect
            id="wait-unit"
            aria-label="Unit"
            value={str(p.settings.unit) || 'HOURS'}
            isDisabled={p.isDisabled}
            onChange={(_e, v) => set({ unit: v })}
          >
            {UNITS.map(([v, l]) => (
              <FormSelectOption key={v} value={v} label={l} />
            ))}
          </FormSelect>
        </div>
        <ErrorLine message={p.errors['settings.amount'] ?? p.errors['settings.unit']} />
        <p className="pf-v6-u-color-200">1 minute to 30 days</p>
      </FormGroup>
    </Form>
  );
};

export const JumpFields: React.FunctionComponent<NodeFieldsProps> = (p) => (
  <Form onSubmit={(e) => e.preventDefault()}>
    <FormGroup label="Chatbot" isRequired fieldId="jump-bot">
      <FormSelect
        id="jump-bot"
        aria-label="Chatbot"
        value={str(p.settings.chatbotId)}
        isDisabled={p.isDisabled}
        validated={p.errors['settings.chatbotId'] ? 'error' : 'default'}
        onChange={(_e, v) => p.onChange({ chatbotId: v || null })}
      >
        <FormSelectOption value="" label="Choose a chatbot" />
        {(p.options?.chatbots ?? [])
          .filter((c) => c.id !== p.chatbotId)
          .map((c) => (
            <FormSelectOption key={c.id} value={c.id} label={c.status === 'DRAFT' ? `${c.name} (draft)` : c.name} />
          ))}
      </FormSelect>
      <ErrorLine message={p.errors['settings.chatbotId']} />
      <p className="pf-v6-u-color-200">This chatbot ends here; the other one starts with the same variables.</p>
    </FormGroup>
  </Form>
);

export const AssignChatFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const s = p.settings;
  const mode = str(s.mode) || 'NUMBER_ROUTING';
  const set = (patch: Record<string, unknown>) =>
    p.onChange({ mode, userId: s.userId ?? null, teamId: s.teamId ?? null, whenAway: s.whenAway ?? null, ...patch });
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup role="radiogroup" label="Give the chat to" fieldId="ac-mode">
        <Radio
          id="ac-routing"
          name="ac-mode"
          label="The number's normal routing"
          isChecked={mode === 'NUMBER_ROUTING'}
          isDisabled={p.isDisabled}
          onChange={() => set({ mode: 'NUMBER_ROUTING', userId: null, teamId: null, whenAway: null })}
        />
        <Radio
          id="ac-agent"
          name="ac-mode"
          label="An agent"
          isChecked={mode === 'AGENT'}
          isDisabled={p.isDisabled}
          onChange={() => set({ mode: 'AGENT' })}
        />
        <Radio
          id="ac-queue"
          name="ac-mode"
          label="A team's queue"
          isChecked={mode === 'TEAM_QUEUE'}
          isDisabled={p.isDisabled}
          onChange={() => set({ mode: 'TEAM_QUEUE' })}
        />
        <Radio
          id="ac-rr"
          name="ac-mode"
          label="A team, round robin"
          isChecked={mode === 'TEAM_ROUND_ROBIN'}
          isDisabled={p.isDisabled}
          onChange={() => set({ mode: 'TEAM_ROUND_ROBIN' })}
        />
        <ErrorLine message={p.errors['settings.mode']} />
        <p className="pf-v6-u-color-200">
          The chatbot ends here. To tell the customer first, put a Send message node before this one.
        </p>
      </FormGroup>
      {mode === 'NUMBER_ROUTING' ? null : mode === 'AGENT' ? (
        <>
          <FormGroup label="Agent" isRequired fieldId="ac-user">
            <FormSelect
              id="ac-user"
              aria-label="Agent"
              value={str(s.userId)}
              isDisabled={p.isDisabled}
              validated={p.errors['settings.userId'] ? 'error' : 'default'}
              onChange={(_e, v) => set({ userId: v || null })}
            >
              <FormSelectOption value="" label="Choose an agent" />
              {(p.options?.agents ?? []).map((a) => (
                <FormSelectOption key={a.id} value={a.id} label={a.name} />
              ))}
            </FormSelect>
            <ErrorLine message={p.errors['settings.userId']} />
          </FormGroup>
          <FormGroup label="When the agent is away" fieldId="ac-away">
            <FormSelect
              id="ac-away"
              aria-label="When away"
              value={str(s.whenAway) || 'KEEP_WITH_AGENT'}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => set({ whenAway: v })}
            >
              <FormSelectOption value="KEEP_WITH_AGENT" label="Leave the chat with them" />
              <FormSelectOption value="OWNING_TEAM_QUEUE" label="Put it in the number's team queue" />
            </FormSelect>
          </FormGroup>
        </>
      ) : (
        <FormGroup label="Team" isRequired fieldId="ac-team">
          <FormSelect
            id="ac-team"
            aria-label="Team"
            value={str(s.teamId)}
            isDisabled={p.isDisabled}
            validated={p.errors['settings.teamId'] ? 'error' : 'default'}
            onChange={(_e, v) => set({ teamId: v || null })}
          >
            <FormSelectOption value="" label="Choose a team" />
            {(p.options?.teams ?? []).map((t) => (
              <FormSelectOption key={t.id} value={t.id} label={t.name} />
            ))}
          </FormSelect>
          <ErrorLine message={p.errors['settings.teamId']} />
        </FormGroup>
      )}
    </Form>
  );
};

export const AddToCrmFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const vars = useVariables(p);
  const s = p.settings;
  const crm = p.options?.crm;
  const set = (patch: Record<string, unknown>) =>
    p.onChange({
      pipelineId: s.pipelineId ?? null,
      stageId: s.stageId ?? null,
      dealTitle: s.dealTitle ?? null,
      ...patch,
    });
  const pipeline = crm?.pipelines.find((x) => x.id === s.pipelineId);
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      {crm && !crm.enabled && <ErrorLine message={p.errors['settings.pipelineId'] ?? 'CRM is off for this brand'} />}
      <FormGroup label="Pipeline" fieldId="crm-pipeline">
        <FormSelect
          id="crm-pipeline"
          aria-label="Pipeline"
          value={str(s.pipelineId)}
          isDisabled={p.isDisabled}
          onChange={(_e, v) => set({ pipelineId: v || null, stageId: null })}
        >
          <FormSelectOption value="" label="Default pipeline" />
          {(crm?.pipelines ?? []).map((x) => (
            <FormSelectOption key={x.id} value={x.id} label={x.name} />
          ))}
        </FormSelect>
        <ErrorLine message={p.errors['settings.pipelineId']} />
      </FormGroup>
      <FormGroup label="Lane" fieldId="crm-lane">
        <FormSelect
          id="crm-lane"
          aria-label="Lane"
          value={str(s.stageId)}
          isDisabled={p.isDisabled || !pipeline}
          onChange={(_e, v) => set({ stageId: v || null })}
        >
          <FormSelectOption value="" label="First open lane" />
          {(pipeline?.lanes ?? []).map((l) => (
            <FormSelectOption key={l.id} value={l.id} label={l.name ?? l.id} />
          ))}
        </FormSelect>
        <ErrorLine message={p.errors['settings.stageId']} />
      </FormGroup>
      <FormGroup label="Deal title" fieldId="crm-title">
        <VariableInput
          id="crm-title"
          aria-label="Deal title"
          value={str(s.dealTitle)}
          onChange={(v) => set({ dealTitle: v })}
          variables={vars.concat([
            { label: 'Deal', paths: [{ path: 'name', hint: "The contact's name, or the number" }] },
          ])}
          isDisabled={p.isDisabled}
        />
        <ErrorLine message={p.errors['settings.dealTitle']} />
      </FormGroup>
    </Form>
  );
};

export const SendTemplateFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const vars = useVariables(p);
  const s = p.settings;
  const templates = p.options?.templates ?? [];
  const templateId = str(s.templateId);
  const template = templates.find((t) => t.id === templateId);
  const values = asMap(s.values);
  const agentPlaceholders = (template?.placeholders ?? []).filter((x) => x.kind === 'AGENT');
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup label="Template" isRequired fieldId="st-template">
        <FormSelect
          id="st-template"
          aria-label="Template"
          value={templateId}
          isDisabled={p.isDisabled}
          validated={p.errors['settings.templateId'] ? 'error' : 'default'}
          onChange={(_e, v) => p.onChange({ templateId: v || null, values: {} })}
        >
          <FormSelectOption value="" label="Choose a template" />
          {templates.map((t) => (
            <FormSelectOption key={t.id} value={t.id} label={t.name} />
          ))}
        </FormSelect>
        <ErrorLine
          message={p.errors['settings.templateId'] ?? 'Contact details such as the name are filled from the contact.'}
        />
      </FormGroup>
      {agentPlaceholders.map((ph) => (
        <FormGroup
          key={ph.name}
          label={`Value for “${ph.label ?? ph.name}”`}
          isRequired={ph.required}
          fieldId={`st-${ph.name}`}
        >
          <VariableInput
            id={`st-${ph.name}`}
            aria-label={`Value for ${ph.label ?? ph.name}`}
            value={values[ph.name] ?? ''}
            onChange={(v) => p.onChange({ ...s, values: { ...values, [ph.name]: v } })}
            variables={vars}
            isDisabled={p.isDisabled}
          />
          <ErrorLine message={p.errors[`settings.values.${ph.name}`]} />
        </FormGroup>
      ))}
    </Form>
  );
};

export const HttpRequestFields: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const vars = useVariables(p);
  const s = p.settings;
  const headers = asMap(s.headers);
  const names = Object.keys(headers);
  const set = (patch: Record<string, unknown>) => p.onChange({ ...s, ...patch });
  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup label="Method" fieldId="http-method">
        <FormSelect
          id="http-method"
          aria-label="Method"
          value={str(s.method) || 'POST'}
          isDisabled={p.isDisabled}
          onChange={(_e, v) => set({ method: v })}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <FormSelectOption key={m} value={m} label={m} />
          ))}
        </FormSelect>
        <ErrorLine message={p.errors['settings.method']} />
      </FormGroup>
      <FormGroup label="URL" isRequired fieldId="http-url">
        <VariableInput
          id="http-url"
          aria-label="URL"
          placeholder="https://"
          value={str(s.url)}
          onChange={(v) => set({ url: v })}
          variables={vars}
          isDisabled={p.isDisabled}
          validated={p.errors['settings.url'] ? 'error' : 'default'}
        />
        <ErrorLine message={p.errors['settings.url']} />
      </FormGroup>
      <FormGroup label="Headers" fieldId="http-headers">
        {names.map((n, i) => (
          <div key={i} className="omni-form-field__row">
            <TextInput
              aria-label={`Header ${i + 1} name`}
              placeholder="Name"
              value={n}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => {
                const next: Record<string, string> = {};
                names.forEach((k) => (next[k === n ? v : k] = headers[k]));
                set({ headers: next });
              }}
            />
            <VariableInput
              id={`http-h-${i}`}
              aria-label={`Header ${i + 1} value`}
              value={headers[n]}
              onChange={(v) => set({ headers: { ...headers, [n]: v } })}
              variables={vars}
              isDisabled={p.isDisabled}
            />
            <Button
              variant="plain"
              aria-label={`Remove header ${i + 1}`}
              isDisabled={p.isDisabled}
              onClick={() => {
                const next = { ...headers };
                delete next[n];
                set({ headers: next });
              }}
            >
              ×
            </Button>
            <ErrorLine message={p.errors[`settings.headers.${n}`]} />
          </div>
        ))}
        <Button
          variant="link"
          isInline
          isDisabled={p.isDisabled}
          onClick={() => set({ headers: { ...headers, '': '' } })}
        >
          Add header
        </Button>
      </FormGroup>
      <FormGroup label="Content type" fieldId="http-ct">
        <FormSelect
          id="http-ct"
          aria-label="Content type"
          value={str(s.contentType) || 'application/json'}
          isDisabled={p.isDisabled}
          onChange={(_e, v) => set({ contentType: v })}
        >
          <FormSelectOption value="application/json" label="application/json" />
          <FormSelectOption value="application/x-www-form-urlencoded" label="application/x-www-form-urlencoded" />
          <FormSelectOption value="text/plain" label="text/plain" />
        </FormSelect>
      </FormGroup>
      <FormGroup label="Body" fieldId="http-body">
        <VariableInput
          id="http-body"
          aria-label="Body"
          multiline
          rows={6}
          value={str(s.body)}
          onChange={(v) => set({ body: v })}
          variables={vars}
          isDisabled={p.isDisabled}
          validated={p.errors['settings.body'] ? 'error' : 'default'}
        />
        <ErrorLine message={p.errors['settings.body']} />
      </FormGroup>
      <p className="pf-v6-u-color-200">
        The response is available as {`{{${p.node.data.name}.response.status}}`} and{' '}
        {`{{${p.node.data.name}.response.body…}}`}.
      </p>
    </Form>
  );
};
