import * as React from 'react';
import {
  Alert,
  Button,
  Content,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Radio,
} from '@patternfly/react-core';
import type { AutomationAction, AutomationOptions } from '@app/api/automations';
import { agentBlindNumbers } from '@app/Automations/automationModel';

type Mode = 'AGENT' | 'TEAM_QUEUE' | 'TEAM_ROUND_ROBIN';
type WhenAway = 'KEEP_WITH_AGENT' | 'OWNING_TEAM_QUEUE';

/** Chooses who an Assign chat action gives the chat to. */
export const AssignChatModal: React.FunctionComponent<{
  action: AutomationAction;
  options: AutomationOptions;
  onSave(a: AutomationAction): void;
  onCancel(): void;
}> = ({ action, options, onSave, onCancel }) => {
  const [mode, setMode] = React.useState<Mode>((action.mode as Mode | null | undefined) ?? 'AGENT');
  const [userId, setUserId] = React.useState(action.userId ?? '');
  const [teamId, setTeamId] = React.useState(action.teamId ?? '');
  const [whenAway, setWhenAway] = React.useState<WhenAway>((action.whenAway as WhenAway | null) ?? 'KEEP_WITH_AGENT');

  const isAgent = mode === 'AGENT';
  const chosen = isAgent ? userId !== '' : teamId !== '';
  const agent = options.agents.find((a) => a.id === userId);
  const blind = isAgent && agent ? agentBlindNumbers(agent.id, options) : [];

  const save = () => {
    if (!chosen) return;
    onSave(
      isAgent
        ? { type: 'ASSIGN_CHAT', mode, userId, teamId: null, whenAway }
        : { type: 'ASSIGN_CHAT', mode, userId: null, teamId, whenAway: null },
    );
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="assign-chat-title">
      <ModalHeader title="Assign chat" labelId="assign-chat-title" />
      <ModalBody>
        <Form
          id="assign-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            save();
          }}
        >
          <FormGroup role="radiogroup" label="Give the chat to" isStack fieldId="assign-mode">
            <Radio
              id="assign-mode-agent"
              name="assign-mode"
              label="An agent"
              isChecked={isAgent}
              onChange={() => setMode('AGENT')}
            />
            <Radio
              id="assign-mode-queue"
              name="assign-mode"
              label="A team, to its queue"
              isChecked={mode === 'TEAM_QUEUE'}
              onChange={() => setMode('TEAM_QUEUE')}
            />
            <Radio
              id="assign-mode-rr"
              name="assign-mode"
              label="A team, round robin"
              isChecked={mode === 'TEAM_ROUND_ROBIN'}
              onChange={() => setMode('TEAM_ROUND_ROBIN')}
            />
          </FormGroup>
          {isAgent ? (
            <>
              <FormGroup label="Agent" fieldId="assign-agent">
                <FormSelect id="assign-agent" aria-label="Agent" value={userId} onChange={(_e, v) => setUserId(v)}>
                  <FormSelectOption value="" label="Choose an agent" />
                  {options.agents.map((a) => (
                    <FormSelectOption key={a.id} value={a.id} label={a.name} />
                  ))}
                </FormSelect>
              </FormGroup>
              <FormGroup
                role="radiogroup"
                label="If the agent is away or cannot take chats:"
                isStack
                fieldId="assign-away"
              >
                <Radio
                  id="assign-away-keep"
                  name="assign-away"
                  label="Leave the chat with them"
                  isChecked={whenAway === 'KEEP_WITH_AGENT'}
                  onChange={() => setWhenAway('KEEP_WITH_AGENT')}
                />
                <Radio
                  id="assign-away-queue"
                  name="assign-away"
                  label="Put it in the queue of the team that owns the chat's number"
                  isChecked={whenAway === 'OWNING_TEAM_QUEUE'}
                  onChange={() => setWhenAway('OWNING_TEAM_QUEUE')}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>When the number has no team, the chat stays with the agent.</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              {blind.length > 0 && agent && (
                <Alert variant="warning" isInline title="Some numbers are out of reach">
                  This rule applies to every number of the brand. {agent.name} cannot see{' '}
                  {blind.map((n) => n.label).join(', ')}; the chat will not be assigned on those numbers.
                </Alert>
              )}
            </>
          ) : (
            <FormGroup label="Team" fieldId="assign-team">
              <FormSelect id="assign-team" aria-label="Team" value={teamId} onChange={(_e, v) => setTeamId(v)}>
                <FormSelectOption value="" label="Choose a team" />
                {options.teams.map((t) => (
                  <FormSelectOption key={t.id} value={t.id} label={t.name} />
                ))}
              </FormSelect>
              {mode === 'TEAM_ROUND_ROBIN' && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      The next available member in turn, sharing the team&apos;s turn with the inbox&apos;s routing.
                      Nobody available: the team&apos;s queue.
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          )}
          <Content component="small">This replaces whatever the inbox&apos;s routing did.</Content>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!chosen} onClick={save}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
