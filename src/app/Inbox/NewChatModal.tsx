import * as React from 'react';
import {
  Alert,
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
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { MessageView, startChat } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { COUNTER_FROM, MAX_LENGTH } from '@app/Inbox/Composer';
import { TemplatePickerModal } from '@app/Inbox/TemplatePickerModal';
import { useSession } from '@app/session/SessionContext';

const NOT_CONNECTED = 'WhatsApp is not connected on this number';
const PHONE_HINT = 'Country code first, digits only, e.g. 919812345678';
const PHONE_INVALID = 'Enter 8 to 15 digits with the country code';

/** What the server is sent: the number as typed, minus the punctuation people put in it. */
const cleanPhone = (raw: string) => raw.replace(/[+\s\-()]/g, '');
const isValidPhone = (cleaned: string) => /^[1-9][0-9]{7,14}$/.test(cleaned);

/** Starts a chat with a phone number by sending it a first message: text, or a template. */
export const NewChatModal: React.FunctionComponent<{
  phoneNumberId: string;
  numberConnected: boolean;
  onClose(): void;
  onStarted(message: MessageView): void;
}> = ({ phoneNumberId, numberConnected, onClose, onStarted }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [phone, setPhone] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [textError, setTextError] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState(false);
  // A second click or Enter can arrive before the first send has re-rendered the button as disabled.
  const inFlight = React.useRef(false);

  const cleaned = cleanPhone(phone);
  const phoneValid = isValidPhone(cleaned);
  const trimmed = text.trim();
  const canSend = numberConnected && phoneValid && trimmed.length > 0 && !sending;
  const shownPhoneError = phoneError ?? (touched && !phoneValid ? PHONE_INVALID : null);

  const send = async () => {
    setTouched(true);
    if (!canSend || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    setPhoneError(null);
    setTextError(null);
    try {
      onStarted(await startChat(token as string, ws, phoneNumberId, { phone: cleaned, text: trimmed }));
    } catch (e) {
      const fields = e instanceof ApiError && e.code?.toUpperCase() === 'VALIDATION' ? e.fields : undefined;
      if (fields?.phone || fields?.text) {
        setPhoneError(fields.phone ?? null);
        setTextError(fields.text ?? null);
      } else setError(messageFor(e));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <>
      <Modal
        isOpen
        variant="small"
        // Closing mid-send would still navigate on success, from wherever the agent has gone.
        onClose={sending ? () => undefined : onClose}
        // Every open Modal hears Escape: leave this one to the template picker while it is on top.
        onEscapePress={() => {
          if (!picking && !sending) onClose();
        }}
        elementToFocus="#new-chat-phone"
        aria-labelledby="new-chat-title"
      >
        <ModalHeader title="New chat" labelId="new-chat-title" />
        <ModalBody>
          {!numberConnected && <Alert variant="info" isInline isPlain title={NOT_CONNECTED} />}
          {error && <Alert variant="danger" isInline isPlain title={error} />}
          <Form onSubmit={(e) => e.preventDefault()}>
            <FormGroup label="Phone number" fieldId="new-chat-phone" isRequired>
              <TextInput
                id="new-chat-phone"
                type="tel"
                value={phone}
                isRequired
                validated={shownPhoneError ? 'error' : 'default'}
                onChange={(_e, v) => {
                  setPhone(v);
                  setPhoneError(null);
                }}
                onBlur={() => setTouched(true)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  void send();
                }}
              />
              <FormHelperText>
                <HelperText>
                  {shownPhoneError ? (
                    <HelperTextItem variant="error">{shownPhoneError}</HelperTextItem>
                  ) : (
                    <HelperTextItem>{PHONE_HINT}</HelperTextItem>
                  )}
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup label="Message" fieldId="new-chat-text">
              <TextArea
                id="new-chat-text"
                resizeOrientation="vertical"
                rows={3}
                maxLength={MAX_LENGTH}
                value={text}
                validated={textError ? 'error' : 'default'}
                onChange={(_e, v) => {
                  setText(v);
                  setTextError(null);
                }}
              />
              {(textError || text.length > COUNTER_FROM) && (
                <FormHelperText>
                  <HelperText>
                    {textError && <HelperTextItem variant="error">{textError}</HelperTextItem>}
                    {text.length > COUNTER_FROM && (
                      <HelperTextItem>
                        {text.length} / {MAX_LENGTH}
                      </HelperTextItem>
                    )}
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => void send()} isDisabled={!canSend}>
            Send
          </Button>
          <Button
            variant="secondary"
            onClick={() => setPicking(true)}
            isDisabled={!numberConnected || !phoneValid || sending}
          >
            Template…
          </Button>
          <Button variant="link" onClick={onClose} isDisabled={sending}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      {picking && (
        <TemplatePickerModal
          contactId={null}
          send={(templateId, values) =>
            startChat(token as string, ws, phoneNumberId, { phone: cleaned, templateId, values })
          }
          onClose={() => setPicking(false)}
          onSent={(message) => {
            setPicking(false);
            onStarted(message);
          }}
        />
      )}
    </>
  );
};
