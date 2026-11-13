import * as React from 'react';
import {
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Switch,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import type { ChatbotSettings } from '@app/api/chatbots';

export const LIMITS = { reminder: [1, 1440], end: [5, 2880], retries: [0, 5] } as const;

const inRange = (n: number | null, [lo, hi]: readonly [number, number]) =>
  n !== null && Number.isInteger(n) && n >= lo && n <= hi;
const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));

interface Draft {
  reminder: boolean;
  reminderAfter: string;
  reminderMessage: string;
  endAfter: string;
  endMessage: string;
  retries: string;
  retryMessage: string;
  giveUpMessage: string;
  stopOnAgentReply: boolean;
}

const toDraft = (s: ChatbotSettings): Draft => ({
  reminder: s.reminderAfterMinutes !== null,
  reminderAfter: s.reminderAfterMinutes === null ? '' : String(s.reminderAfterMinutes),
  reminderMessage: s.reminderMessage ?? '',
  endAfter: String(s.endAfterMinutes),
  endMessage: s.endMessage ?? '',
  retries: String(s.invalidReplyRetries),
  retryMessage: s.retryMessage,
  giveUpMessage: s.giveUpMessage ?? '',
  stopOnAgentReply: s.stopOnAgentReply,
});

/** The field errors of a draft; empty when it can be saved. */
export function settingsProblems(d: Draft): Partial<Record<keyof Draft, string>> {
  const out: Partial<Record<keyof Draft, string>> = {};
  if (d.reminder) {
    if (!inRange(num(d.reminderAfter), LIMITS.reminder)) out.reminderAfter = 'Between 1 and 1440 minutes';
    if (!d.reminderMessage.trim()) out.reminderMessage = 'is required';
  }
  if (!inRange(num(d.endAfter), LIMITS.end)) out.endAfter = 'Between 5 and 2880 minutes';
  if (d.reminder && !out.reminderAfter && !out.endAfter && Number(d.reminderAfter) >= Number(d.endAfter))
    out.reminderAfter = 'must come before the end';
  if (!inRange(num(d.retries), LIMITS.retries)) out.retries = 'Between 0 and 5';
  if (!d.retryMessage.trim()) out.retryMessage = 'is required';
  return out;
}

const fromDraft = (d: Draft): ChatbotSettings => ({
  reminderAfterMinutes: d.reminder ? Number(d.reminderAfter) : null,
  reminderMessage: d.reminder ? d.reminderMessage.trim() : null,
  endAfterMinutes: Number(d.endAfter),
  endMessage: d.endMessage.trim() || null,
  invalidReplyRetries: Number(d.retries),
  retryMessage: d.retryMessage.trim(),
  giveUpMessage: d.giveUpMessage.trim() || null,
  stopOnAgentReply: d.stopOnAgentReply,
});

const Err: React.FunctionComponent<{ text?: string }> = ({ text }) =>
  text ? (
    <FormHelperText>
      <HelperText>
        <HelperTextItem variant="error">{text}</HelperTextItem>
      </HelperText>
    </FormHelperText>
  ) : null;

/** The chatbot's run settings (spec §8.1): reminders, the inactivity end, invalid replies, agent takeover. */
export const SettingsModal: React.FunctionComponent<{
  settings: ChatbotSettings;
  readOnly: boolean;
  onSave(settings: ChatbotSettings): void;
  onClose(): void;
}> = ({ settings, readOnly, onSave, onClose }) => {
  const [d, setD] = React.useState<Draft>(() => toDraft(settings));
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));
  const problems = settingsProblems(d);
  const ok = Object.keys(problems).length === 0;
  const dis = readOnly;
  return (
    <Modal isOpen variant="medium" onClose={onClose} aria-labelledby="chatbot-settings-title">
      <ModalHeader title="Chatbot settings" labelId="chatbot-settings-title" />
      <ModalBody>
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormGroup label="Inactivity reminder" fieldId="cs-reminder">
            <Switch
              id="cs-reminder"
              aria-label="Send a reminder"
              label="Send a reminder when the person goes quiet"
              isChecked={d.reminder}
              isDisabled={dis}
              onChange={(_e, on) => set({ reminder: on })}
            />
            {d.reminder && (
              <div className="omni-form-field__row">
                <FormGroup label="Remind after minutes" fieldId="cs-reminder-after">
                  <TextInput
                    id="cs-reminder-after"
                    type="number"
                    aria-label="Remind after minutes"
                    value={d.reminderAfter}
                    isDisabled={dis}
                    validated={problems.reminderAfter ? 'error' : 'default'}
                    onChange={(_e, v) => set({ reminderAfter: v })}
                  />
                  <Err text={problems.reminderAfter} />
                </FormGroup>
                <FormGroup label="Reminder message" fieldId="cs-reminder-message">
                  <TextArea
                    id="cs-reminder-message"
                    aria-label="Reminder message"
                    rows={2}
                    value={d.reminderMessage}
                    isDisabled={dis}
                    validated={problems.reminderMessage ? 'error' : 'default'}
                    onChange={(_e, v) => set({ reminderMessage: v })}
                  />
                  <Err text={problems.reminderMessage} />
                </FormGroup>
              </div>
            )}
          </FormGroup>
          <FormGroup label="Inactivity end" fieldId="cs-end-after">
            <div className="omni-form-field__row">
              <FormGroup label="End after minutes" isRequired fieldId="cs-end-after">
                <TextInput
                  id="cs-end-after"
                  type="number"
                  aria-label="End after minutes"
                  value={d.endAfter}
                  isDisabled={dis}
                  validated={problems.endAfter ? 'error' : 'default'}
                  onChange={(_e, v) => set({ endAfter: v })}
                />
                <Err text={problems.endAfter} />
              </FormGroup>
              <FormGroup label="Message when the chatbot ends (optional)" fieldId="cs-end-message">
                <TextArea
                  id="cs-end-message"
                  aria-label="End message"
                  rows={2}
                  value={d.endMessage}
                  isDisabled={dis}
                  onChange={(_e, v) => set({ endMessage: v })}
                />
              </FormGroup>
            </div>
            <p className="pf-v6-u-color-200">A run that waits longer than this for the person ends on its own.</p>
          </FormGroup>
          <FormGroup label="Invalid replies" fieldId="cs-retries">
            <div className="omni-form-field__row">
              <FormGroup label="Retries" isRequired fieldId="cs-retries">
                <TextInput
                  id="cs-retries"
                  type="number"
                  aria-label="Retries"
                  value={d.retries}
                  isDisabled={dis}
                  validated={problems.retries ? 'error' : 'default'}
                  onChange={(_e, v) => set({ retries: v })}
                />
                <Err text={problems.retries} />
              </FormGroup>
              <FormGroup label="Retry message" isRequired fieldId="cs-retry-message">
                <TextArea
                  id="cs-retry-message"
                  aria-label="Retry message"
                  rows={2}
                  value={d.retryMessage}
                  isDisabled={dis}
                  validated={problems.retryMessage ? 'error' : 'default'}
                  onChange={(_e, v) => set({ retryMessage: v })}
                />
                <Err text={problems.retryMessage} />
              </FormGroup>
            </div>
            <FormGroup label="Message after the last retry (optional)" fieldId="cs-give-up">
              <TextArea
                id="cs-give-up"
                aria-label="Give-up message"
                rows={2}
                value={d.giveUpMessage}
                isDisabled={dis}
                onChange={(_e, v) => set({ giveUpMessage: v })}
              />
            </FormGroup>
          </FormGroup>
          <FormGroup fieldId="cs-stop">
            <Switch
              id="cs-stop"
              aria-label="Stop when an agent replies"
              label="Stop when an agent replies in the chat"
              isChecked={d.stopOnAgentReply}
              isDisabled={dis}
              onChange={(_e, on) => set({ stopOnAgentReply: on })}
            />
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        {!readOnly && (
          <Button variant="primary" isDisabled={!ok} onClick={() => onSave(fromDraft(d))}>
            Save
          </Button>
        )}
        <Button variant="link" onClick={onClose}>
          {readOnly ? 'Close' : 'Cancel'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
