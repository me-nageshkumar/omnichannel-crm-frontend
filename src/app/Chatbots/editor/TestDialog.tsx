import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core';
import type { TestContact } from '@app/api/automations';
import type { Chatbot, Run } from '@app/api/chatbots';
import { startChatbotTest } from '@app/api/chatbots';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { ContactSearchField } from '@app/Automations/TestContactPicker';
import { useSession } from '@app/session/SessionContext';

export const REAL_MESSAGES_HINT = 'Messages really go to this contact.';

/**
 * Starts a test run of the chatbot with a real contact (spec §8.2): the run then shows on the canvas.
 * A chatbot already running on that chat can be stopped and replaced from here.
 */
export const TestDialog: React.FunctionComponent<{
  chatbot: Chatbot;
  /** No ERROR problems in the flow. */
  canStart: boolean;
  /** Unsaved changes: the server would test the saved flow, so the editor asks for a save first. */
  dirty: boolean;
  onStarted(run: Run): void;
  onClose(): void;
}> = ({ chatbot, canStart, dirty, onStarted, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [contact, setContact] = React.useState<TestContact | null>(null);
  const [numberId, setNumberId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<string | null>(null);

  const numbers = contact?.numbers ?? [];
  const pickNumber = numbers.length > 1;
  const chosenNumber = pickNumber ? numberId : (numbers[0]?.id ?? '');
  const ready = Boolean(contact) && canStart && !dirty && !busy && (!pickNumber || numberId !== '');

  const start = async (stopRunning: boolean) => {
    if (!contact || !token) return;
    setBusy(true);
    setError(null);
    setRunning(null);
    try {
      const body = {
        contactId: contact.contactId,
        ...(chosenNumber ? { phoneNumberId: chosenNumber } : {}),
        ...(stopRunning ? { stopRunning: true } : {}),
      };
      onStarted(await startChatbotTest(token, ws, chatbot.id, body));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CHATBOT_RUNNING') setRunning(e.extra?.chatbotName ?? 'another chatbot');
      else setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="chatbot-test-title">
      <ModalHeader title={`Test “${chatbot.name}”`} labelId="chatbot-test-title" />
      <ModalBody>
        {error && <Alert variant="danger" isInline title={error} />}
        {running && (
          <Alert
            variant="warning"
            isInline
            title={`Chatbot “${running}” is running on this chat`}
            actionLinks={
              <Button variant="link" isInline onClick={() => void start(true)} isDisabled={busy}>
                Stop it and start the test
              </Button>
            }
          />
        )}
        <Form onSubmit={(e) => e.preventDefault()}>
          <FormGroup label="Test contact" isStack fieldId="chatbot-test-contact">
            <ContactSearchField
              onPick={(c) => {
                setContact(c);
                setNumberId('');
                setRunning(null);
              }}
            />
          </FormGroup>
          {pickNumber && (
            <FormGroup label="Number" isRequired fieldId="chatbot-test-number">
              <FormSelect
                id="chatbot-test-number"
                aria-label="Number"
                value={numberId}
                onChange={(_e, v) => setNumberId(v)}
              >
                <FormSelectOption value="" label="Choose the number to send from" />
                {numbers.map((n) => (
                  <FormSelectOption key={n.id} value={n.id} label={n.label ?? `+${n.number}`} />
                ))}
              </FormSelect>
            </FormGroup>
          )}
          <HelperText>
            <HelperTextItem>{REAL_MESSAGES_HINT}</HelperTextItem>
            {!canStart && <HelperTextItem variant="error">Fix the problems first</HelperTextItem>}
            {canStart && dirty && <HelperTextItem variant="warning">Save first</HelperTextItem>}
          </HelperText>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!ready} isLoading={busy} onClick={() => void start(false)}>
          Start test
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
