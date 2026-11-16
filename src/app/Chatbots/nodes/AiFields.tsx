import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Content,
  ExpandableSection,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextArea,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { type AiCapabilities, getAiProfile, listAiProviders } from '@app/api/ai';
import type { NodeFieldsProps } from '@app/Chatbots/editor/NodeDrawer';
import { VariableInput } from '@app/Chatbots/editor/VariableInput';
import { ConditionGroupFields, type Group } from '@app/Chatbots/nodes/ConditionFields';
import { ErrorLine, str, useVariables } from '@app/Chatbots/nodes/common';
import { ancestors } from '@app/Chatbots/variables';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Outcome {
  id: string;
  label: string;
  description: string;
}
interface Field {
  key: string;
  description: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN';
}

const EFFORTS = ['minimal', 'low', 'medium', 'high'];

/** An outcome id from its label: lower-case letters, digits and underscores, at most 30 (the server's rule). */
export const slugOf = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);

const Hint: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => (
  <FormHelperText>
    <HelperText>
      <HelperTextItem>{children}</HelperTextItem>
    </HelperText>
  </FormHelperText>
);

/**
 * The AI node's form (spec 2026-11-15 §5.9–§5.10). The drawer stays mounted when another node is picked, so the form
 * is keyed on the node: its local text (exit words, schema) and id-slugging state never carry over.
 */
export const AiFields: React.FunctionComponent<NodeFieldsProps> = (p) => <AiNodeForm key={p.node.id} {...p} />;

const tryParse = (text: string): unknown => {
  try {
    return text.trim() === '' ? null : JSON.parse(text);
  } catch {
    return null;
  }
};

/** Fields a provider cannot use are hidden, unless they still hold a value the server would check. */
const AiNodeForm: React.FunctionComponent<NodeFieldsProps> = (p) => {
  const vars = useVariables(p);
  const s = p.settings as Any;
  const set = (patch: Any) => p.onChange({ ...s, ...patch });
  const id = (f: string) => `ai-${p.node.id}-${f}`;
  const err = (f: string) => p.errors[`settings.${f}`];
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const canSeeAi = useAccess().hasInWorkspace('ai:view');
  const profiles = p.options?.aiProfiles ?? [];
  const profileId = str(s.profileId);
  const chosen = profiles.find((x) => x.id === profileId) ?? null;
  const conversation = s.mode !== 'SINGLE';

  const providers = useLoad((tk) => listAiProviders(tk, ws), [ws]);
  const caps: AiCapabilities | null = providers.data?.find((x) => x.id === chosen?.provider)?.capabilities ?? null;
  const shows = (flag: keyof AiCapabilities) => caps == null || Boolean(caps[flag]);
  // The profile's own values, for the overrides' placeholders; only for people who may read profiles.
  const profile = useLoad(
    (tk) => (canSeeAi && ws && profileId ? getAiProfile(tk, ws, profileId) : Promise.resolve(null)),
    [ws, profileId, canSeeAi],
  );

  // Outcome ids follow their label while the row is new and the id was not typed (spec: a saved id keeps its edge).
  const outcomes = (Array.isArray(s.outcomes) ? s.outcomes : []) as Outcome[];
  const [auto, setAuto] = React.useState<boolean[]>(() => outcomes.map(() => false));
  const setOutcome = (i: number, patch: Partial<Outcome>) =>
    set({ outcomes: outcomes.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  const collect = (Array.isArray(s.collect) ? s.collect : []) as Field[];
  const setField = (i: number, patch: Partial<Field>) =>
    set({ collect: collect.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const format = (s.replyFormat ?? { type: 'TEXT' }) as Any;
  const [schemaText, setSchemaText] = React.useState(() =>
    format.schema ? JSON.stringify(format.schema, null, 2) : '',
  );
  const [schemaError, setSchemaError] = React.useState<string | null>(null);
  const stringProps = Object.entries((format.schema?.properties ?? {}) as Record<string, Any>)
    .filter(([, v]) => v && v.type === 'string')
    .map(([k]) => k);

  const [wordsText, setWordsText] = React.useState(() => ((s.exitWords as string[]) ?? []).join(', '));
  const condition = (s.exitCondition ?? null) as Group | null;

  const overrides = (s.overrides ?? {}) as Any;
  const setOverride = (key: string, value: unknown) => set({ overrides: { ...overrides, [key]: value } });
  const present = (key: string) => overrides[key] !== null && overrides[key] !== undefined && overrides[key] !== '';
  const inherited = (key: string): string => {
    const v = (profile.data as Any | null | undefined)?.[key];
    if (v === null || v === undefined || v === '') return 'Profile default';
    const text = String(v);
    return `${text.length > 60 ? `${text.slice(0, 60)}…` : text} — profile`;
  };
  const reset = (key: string, label: string) =>
    overrides[key] !== null && overrides[key] !== undefined && overrides[key] !== '' ? (
      <Button variant="link" isInline isDisabled={p.isDisabled} onClick={() => setOverride(key, null)}>
        {label}
      </Button>
    ) : null;

  const up = ancestors(p.flow, p.node.id);
  const earlierAi = p.flow.nodes.filter((n) => n.type === 'ai' && n.id !== p.node.id && up[n.id]);

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <FormGroup label="AI profile" fieldId={id('profile')} isRequired>
        <FormSelect
          id={id('profile')}
          aria-label="AI profile"
          value={profileId}
          isDisabled={p.isDisabled}
          validated={err('profileId') ? 'error' : 'default'}
          onChange={(_e, v) => set({ profileId: v })}
        >
          <FormSelectOption value="" label="Choose a profile" isPlaceholder />
          {profiles.map((x) => (
            <FormSelectOption key={x.id} value={x.id} label={x.name} />
          ))}
        </FormSelect>
        {profiles.length === 0 && (
          <Content component="small">
            No AI profiles yet. {canSeeAi && <Link to="/ai?tab=profiles">Set one up on the AI page</Link>}
          </Content>
        )}
        <ErrorLine message={err('profileId')} />
      </FormGroup>

      <FormGroup label="Mode" fieldId={id('mode')} role="radiogroup">
        <ToggleGroup aria-label="Mode">
          <ToggleGroupItem
            text="One call"
            isSelected={!conversation}
            isDisabled={p.isDisabled}
            onChange={() => {
              // The exit words and condition belong to a conversation; the server would still check them.
              setWordsText('');
              set({ mode: 'SINGLE', exitWords: [], exitCondition: null });
            }}
          />
          <ToggleGroupItem
            text="Conversation"
            isSelected={conversation}
            isDisabled={p.isDisabled}
            onChange={() => set({ mode: 'CONVERSATION' })}
          />
        </ToggleGroup>
      </FormGroup>

      <FormGroup label="User message" fieldId={id('user')} isRequired={!conversation}>
        <VariableInput
          id={id('user')}
          aria-label="User message"
          multiline
          rows={3}
          value={str(s.userMessage)}
          onChange={(v) => set({ userMessage: v })}
          variables={vars}
          isDisabled={p.isDisabled}
          validated={err('userMessage') ? 'error' : 'default'}
        />
        <Hint>
          {conversation
            ? 'Empty: the AI waits for the customer’s next message. To answer the message that started the chatbot, use {{event.message.text}}.'
            : 'What the AI is asked.'}
        </Hint>
        <ErrorLine message={err('userMessage')} />
      </FormGroup>
      {conversation && (
        <FormGroup label="Initial message" fieldId={id('initial')}>
          <VariableInput
            id={id('initial')}
            aria-label="Initial message"
            multiline
            rows={2}
            value={str(s.initialMessage)}
            onChange={(v) => set({ initialMessage: v })}
            variables={vars}
            isDisabled={p.isDisabled}
          />
          <Hint>Sent to the customer before the conversation starts.</Hint>
          <ErrorLine message={err('initialMessage')} />
        </FormGroup>
      )}
      <FormGroup label="Extra instructions" fieldId={id('extra')}>
        <VariableInput
          id={id('extra')}
          aria-label="Extra instructions"
          multiline
          rows={2}
          value={str(s.extraInstructions)}
          onChange={(v) => set({ extraInstructions: v })}
          variables={vars}
          isDisabled={p.isDisabled}
        />
        <Hint>Added to the profile’s instructions on every turn, e.g. the customer’s name or order.</Hint>
        <ErrorLine message={err('extraInstructions')} />
      </FormGroup>
      {!conversation && (
        <Checkbox
          id={id('send')}
          label="Send the reply to the customer"
          isChecked={Boolean(s.sendReply)}
          isDisabled={p.isDisabled}
          onChange={(_e, v) => set({ sendReply: v })}
        />
      )}

      <FormGroup label="Outcomes" fieldId={id('outcomes')}>
        <Hint>
          {conversation
            ? 'The AI ends the conversation by choosing one; each is an output.'
            : 'The AI must choose one; each is an output. None: one Next output.'}
        </Hint>
        {outcomes.map((o, i) => (
          <div key={i} role="group" aria-label={`Outcome ${i + 1}`} className="omni-form-field__row">
            <TextInput
              aria-label={`Outcome ${i + 1} label`}
              placeholder="Label, e.g. Booked"
              value={o.label}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => setOutcome(i, auto[i] ? { label: v, id: slugOf(v) } : { label: v })}
            />
            <TextInput
              aria-label={`Outcome ${i + 1} id`}
              value={o.id}
              isDisabled={p.isDisabled}
              validated={err(`outcomes.${i}.id`) ? 'error' : 'default'}
              onChange={(_e, v) => {
                setAuto(auto.map((a, j) => (j === i ? false : a)));
                setOutcome(i, { id: v });
              }}
            />
            <TextInput
              aria-label={`Outcome ${i + 1} description`}
              placeholder="When the AI should choose it"
              value={o.description ?? ''}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => setOutcome(i, { description: v })}
            />
            <Button
              variant="plain"
              aria-label={`Remove outcome ${i + 1}`}
              isDisabled={p.isDisabled}
              onClick={() => {
                setAuto(auto.filter((_a, j) => j !== i));
                set({ outcomes: outcomes.filter((_o, j) => j !== i) });
              }}
            >
              ×
            </Button>
            <ErrorLine
              message={err(`outcomes.${i}.id`) ?? err(`outcomes.${i}.label`) ?? err(`outcomes.${i}.description`)}
            />
          </div>
        ))}
        <ErrorLine message={err('outcomes')} />
        {conversation && (
          <Checkbox
            id={id('closing')}
            label="Send the AI's closing message when it chooses an outcome"
            description={`Turn off when the next node sends its own message; the AI's line stays in {{${p.node.data.name}.reply}}.`}
            isChecked={s.sendClosingMessage !== false}
            isDisabled={p.isDisabled}
            onChange={(_e, v) => set({ sendClosingMessage: v })}
          />
        )}
        <Button
          variant="link"
          isInline
          isDisabled={p.isDisabled}
          onClick={() => {
            setAuto([...auto, true]);
            set({ outcomes: [...outcomes, { id: '', label: '', description: '' }] });
          }}
        >
          Add outcome
        </Button>
      </FormGroup>

      <FormGroup label="Collect" fieldId={id('collect')}>
        <Hint>Details the AI fills in when it chooses an outcome, e.g. size or city.</Hint>
        {collect.map((f, i) => (
          <div key={i} role="group" aria-label={`Field ${i + 1}`} className="omni-form-field__row">
            <TextInput
              aria-label={`Field ${i + 1} key`}
              placeholder="key, e.g. city"
              value={f.key}
              isDisabled={p.isDisabled}
              validated={err(`collect.${i}.key`) ? 'error' : 'default'}
              onChange={(_e, v) => setField(i, { key: v })}
            />
            <TextInput
              aria-label={`Field ${i + 1} description`}
              placeholder="What it is"
              value={f.description ?? ''}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => setField(i, { description: v })}
            />
            <FormSelect
              aria-label={`Field ${i + 1} type`}
              value={f.type ?? 'TEXT'}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => setField(i, { type: v as Field['type'] })}
            >
              <FormSelectOption value="TEXT" label="Text" />
              <FormSelectOption value="NUMBER" label="Number" />
              <FormSelectOption value="BOOLEAN" label="Yes / no" />
            </FormSelect>
            <Button
              variant="plain"
              aria-label={`Remove field ${i + 1}`}
              isDisabled={p.isDisabled}
              onClick={() => set({ collect: collect.filter((_f, j) => j !== i) })}
            >
              ×
            </Button>
            <ErrorLine message={err(`collect.${i}.key`) ?? err(`collect.${i}.description`)} />
          </div>
        ))}
        <Button
          variant="link"
          isInline
          isDisabled={p.isDisabled}
          onClick={() => set({ collect: [...collect, { key: '', description: '', type: 'TEXT' }] })}
        >
          Add field
        </Button>
      </FormGroup>

      <FormGroup label="Reply format" fieldId={id('format')}>
        <FormSelect
          id={id('format')}
          aria-label="Reply format"
          value={format.type === 'JSON' ? 'JSON' : 'TEXT'}
          isDisabled={p.isDisabled}
          onChange={(_e, v) =>
            set({
              replyFormat:
                v === 'JSON'
                  ? {
                      type: 'JSON',
                      schema: tryParse(schemaText) ?? format.schema ?? null,
                      messageField: format.messageField ?? null,
                    }
                  : { type: 'TEXT' },
            })
          }
        >
          <FormSelectOption value="TEXT" label="Text" />
          <FormSelectOption value="JSON" label="JSON" />
        </FormSelect>
      </FormGroup>
      {format.type === 'JSON' && (
        <>
          <FormGroup label="JSON schema" fieldId={id('schema')} isRequired>
            <TextArea
              id={id('schema')}
              aria-label="JSON schema"
              rows={6}
              value={schemaText}
              isDisabled={p.isDisabled}
              validated={schemaError || err('replyFormat.schema') ? 'error' : 'default'}
              onChange={(_e, v) => {
                setSchemaText(v);
                try {
                  const parsed = JSON.parse(v);
                  setSchemaError(null);
                  set({ replyFormat: { ...format, schema: parsed } });
                } catch {
                  setSchemaError('Not valid JSON');
                }
              }}
            />
            <ErrorLine message={schemaError ?? err('replyFormat.schema')} />
          </FormGroup>
          <FormGroup label="Message field" fieldId={id('message-field')}>
            <FormSelect
              id={id('message-field')}
              aria-label="Message field"
              value={str(format.messageField)}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => set({ replyFormat: { ...format, messageField: v === '' ? null : v } })}
            >
              <FormSelectOption value="" label="Choose…" />
              {stringProps.map((k) => (
                <FormSelectOption key={k} value={k} label={k} />
              ))}
            </FormSelect>
            <Hint>The text property the customer gets.</Hint>
            <ErrorLine message={err('replyFormat.messageField')} />
          </FormGroup>
        </>
      )}

      {conversation && (
        <>
          <FormGroup label="Exit words" fieldId={id('words')}>
            <TextInput
              id={id('words')}
              aria-label="Exit words"
              placeholder="stop, agent"
              value={wordsText}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => {
                setWordsText(v);
                set({
                  exitWords: v
                    .split(',')
                    .map((w) => w.trim())
                    .filter((w) => w !== ''),
                });
              }}
            />
            <Hint>Comma separated. A customer message equal to one ends the conversation without asking the AI.</Hint>
            <ErrorLine message={err('exitWords')} />
          </FormGroup>
          <FormGroup label="Exit condition" fieldId={id('exit')}>
            {condition && condition.rules.length > 0 ? (
              <ConditionGroupFields
                group={condition}
                onChange={(g) => set({ exitCondition: g.rules.length === 0 ? null : g })}
                vars={vars}
                isDisabled={p.isDisabled}
                idPrefix={id('exit')}
                label="Exit"
                errors={p.errors}
                errorBase="settings.exitCondition"
              />
            ) : (
              <Button
                variant="link"
                isInline
                isDisabled={p.isDisabled}
                onClick={() =>
                  set({
                    exitCondition: {
                      combinator: 'and',
                      not: false,
                      rules: [{ field: `{{${p.node.data.name}.json.`, operator: 'is', value: '' }],
                    },
                  })
                }
              >
                Add exit condition
              </Button>
            )}
            <Hint>Checked after every reply, usually on a field of the JSON reply.</Hint>
          </FormGroup>
          <FormGroup label="Max turns" fieldId={id('turns')}>
            <TextInput
              id={id('turns')}
              aria-label="Max turns"
              type="number"
              min={1}
              max={100}
              value={str(s.maxTurns)}
              isDisabled={p.isDisabled}
              validated={err('maxTurns') ? 'error' : 'default'}
              onChange={(_e, v) => set({ maxTurns: v === '' ? null : Number(v) })}
            />
            <ErrorLine message={err('maxTurns')} />
          </FormGroup>
        </>
      )}

      <ExpandableSection toggleText="Advanced">
        <FormGroup label="Model override" fieldId={id('model')}>
          <TextInput
            id={id('model')}
            aria-label="Model override"
            placeholder={inherited('model')}
            value={str(overrides.model)}
            isDisabled={p.isDisabled}
            onChange={(_e, v) => setOverride('model', v === '' ? null : v)}
          />
          {reset('model', 'Reset model')}
          <ErrorLine message={err('overrides.model')} />
        </FormGroup>
        <FormGroup label="Instructions override" fieldId={id('instructions')}>
          <TextArea
            id={id('instructions')}
            aria-label="Instructions override"
            rows={3}
            placeholder={inherited('instructions')}
            value={str(overrides.instructions)}
            isDisabled={p.isDisabled}
            onChange={(_e, v) => setOverride('instructions', v === '' ? null : v)}
          />
          {reset('instructions', 'Reset instructions')}
          <ErrorLine message={err('overrides.instructions')} />
        </FormGroup>
        {(shows('reasoningEffort') || present('reasoningEffort')) && (
          <FormGroup label="Reasoning effort override" fieldId={id('effort')}>
            <FormSelect
              id={id('effort')}
              aria-label="Reasoning effort override"
              value={str(overrides.reasoningEffort)}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => setOverride('reasoningEffort', v === '' ? null : v)}
            >
              <FormSelectOption value="" label={inherited('reasoningEffort')} />
              {EFFORTS.map((x) => (
                <FormSelectOption key={x} value={x} label={x} />
              ))}
            </FormSelect>
            <ErrorLine message={err('overrides.reasoningEffort')} />
          </FormGroup>
        )}
        <FormGroup label="Max output tokens override" fieldId={id('max')}>
          <TextInput
            id={id('max')}
            aria-label="Max output tokens override"
            type="number"
            placeholder={inherited('maxOutputTokens')}
            value={str(overrides.maxOutputTokens)}
            isDisabled={p.isDisabled}
            onChange={(_e, v) => setOverride('maxOutputTokens', v === '' ? null : Number(v))}
          />
          {reset('maxOutputTokens', 'Reset max output tokens')}
          <ErrorLine message={err('overrides.maxOutputTokens')} />
        </FormGroup>
        {(shows('temperature') || present('temperature')) && (
          <FormGroup label="Temperature override" fieldId={id('temperature')}>
            <TextInput
              id={id('temperature')}
              aria-label="Temperature override"
              type="number"
              placeholder={inherited('temperature')}
              value={str(overrides.temperature)}
              isDisabled={p.isDisabled}
              onChange={(_e, v) => setOverride('temperature', v === '' ? null : Number(v))}
            />
            {reset('temperature', 'Reset temperature')}
            <ErrorLine message={err('overrides.temperature')} />
          </FormGroup>
        )}
        <FormGroup label="Continue the conversation of" fieldId={id('continue')}>
          <FormSelect
            id={id('continue')}
            aria-label="Continue the conversation of"
            value={str(s.continueFrom)}
            isDisabled={p.isDisabled}
            onChange={(_e, v) => set({ continueFrom: v === '' ? null : v })}
          >
            <FormSelectOption value="" label="A new conversation" />
            {earlierAi.map((n) => (
              <FormSelectOption key={n.id} value={n.data.name} label={n.data.name} />
            ))}
          </FormSelect>
          <ErrorLine message={err('continueFrom')} />
        </FormGroup>
      </ExpandableSection>
    </Form>
  );
};
