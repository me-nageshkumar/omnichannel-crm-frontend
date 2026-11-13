import * as React from 'react';
import {
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Radio,
} from '@patternfly/react-core';
import type { AutomationAction, AutomationOptions } from '@app/api/automations';

export const startChatbotShows = (key: string) => key === 'chatbotId' || key === 'ifRunning';

/** Start chatbot: which chatbot runs on the chat, and what happens when one is already running there. */
export const StartChatbotFields: React.FunctionComponent<{
  action: AutomationAction;
  options: AutomationOptions;
  errors: Record<string, string>;
  isDisabled: boolean;
  onChange(action: AutomationAction): void;
}> = ({ action, options, errors, isDisabled, onChange }) => {
  const id = React.useId();
  const chatbotId = action.chatbotId ?? '';
  const ifRunning = action.ifRunning ?? 'SKIP';
  // published first, then drafts (a draft cannot be published with the rule, but can be chosen ahead of time)
  const chatbots = (options.chatbots ?? [])
    .slice()
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'PUBLISHED' ? -1 : 1));
  const known = chatbots.some((c) => c.id === chatbotId);
  return (
    <>
      <FormGroup label="Chatbot" isRequired fieldId={`${id}-chatbot`}>
        <FormSelect
          id={`${id}-chatbot`}
          aria-label="Chatbot"
          value={chatbotId}
          isDisabled={isDisabled}
          validated={errors.chatbotId ? 'error' : 'default'}
          onChange={(_e, v) => onChange({ ...action, chatbotId: v === '' ? null : v })}
        >
          <FormSelectOption value="" label="Choose a chatbot" />
          {chatbotId !== '' && !known && <FormSelectOption value={chatbotId} label="—" isDisabled />}
          {chatbots.map((c) => (
            <FormSelectOption key={c.id} value={c.id} label={c.status === 'PUBLISHED' ? c.name : `${c.name} (draft)`} />
          ))}
        </FormSelect>
        <FormHelperText>
          <HelperText>
            {errors.chatbotId ? (
              <HelperTextItem variant="error">{errors.chatbotId}</HelperTextItem>
            ) : (
              <HelperTextItem>Only a published chatbot can run; a draft blocks publishing the rule.</HelperTextItem>
            )}
          </HelperText>
        </FormHelperText>
      </FormGroup>
      <FormGroup role="radiogroup" label="If a chatbot is already running on the chat" fieldId={`${id}-if-running`}>
        <Radio
          id={`${id}-skip`}
          name={`${id}-if-running`}
          label="Skip"
          description="Leave the running chatbot alone; this action does nothing."
          isChecked={ifRunning === 'SKIP'}
          isDisabled={isDisabled}
          onChange={() => onChange({ ...action, ifRunning: 'SKIP' })}
        />
        <Radio
          id={`${id}-replace`}
          name={`${id}-if-running`}
          label="Replace the running chatbot"
          description="Stop it and start this one."
          isChecked={ifRunning === 'REPLACE'}
          isDisabled={isDisabled}
          onChange={() => onChange({ ...action, ifRunning: 'REPLACE' })}
        />
        {errors.ifRunning && (
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant="error">{errors.ifRunning}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
    </>
  );
};
