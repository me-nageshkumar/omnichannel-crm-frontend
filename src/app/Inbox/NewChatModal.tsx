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
import { MessageView, lookupNumber, startChat } from '@app/api/inbox';
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

type Verdict = 'registered' | 'unregistered' | 'failed';
/** What is known about one phone number: a lookup under way, or its verdict. */
interface Answer {
  phone: string;
  state: 'checking' | Verdict;
}

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
  const [answer, setAnswer] = React.useState<Answer | null>(null);
  // The number as last typed, so a lookup that comes back late can tell it is about an old one.
  const latestPhone = React.useRef('');
  // The lookup under way, so a send or Template… click made meanwhile waits for it instead of starting another.
  const pending = React.useRef<{ phone: string; verdict: Promise<Verdict> } | null>(null);

  const cleaned = cleanPhone(phone);
  const phoneValid = isValidPhone(cleaned);
  const trimmed = text.trim();
  // An answer about another number is as good as none.
  const current = answer && answer.phone === cleaned ? answer : null;
  const unregistered = current?.state === 'unregistered';
  const canSend = numberConnected && phoneValid && trimmed.length > 0 && !sending && !unregistered;
  const shownPhoneError = phoneError ?? (touched && !phoneValid ? PHONE_INVALID : null);

  const check = (force: boolean): Promise<Verdict> => {
    const checked = cleaned;
    setAnswer({ phone: checked, state: 'checking' });
    const verdict = lookupNumber(token as string, ws, phoneNumberId, checked, force).then(
      (found): Verdict => (found.registered ? 'registered' : 'unregistered'),
      (): Verdict => 'failed',
    );
    const settled = verdict.then((state) => {
      if (latestPhone.current === checked) setAnswer({ phone: checked, state });
      // Dropped: do not leave this number's 'checking' behind, or it would never resolve if the number comes back.
      else setAnswer((a) => (a?.phone === checked && a.state === 'checking' ? null : a));
      return state;
    });
    pending.current = { phone: checked, verdict: settled };
    return settled;
  };

  /** Whether to go on with this number: only a number known not to be on WhatsApp stops the agent. */
  const ensureChecked = async () => {
    let state: Verdict;
    if (current?.state === 'registered' || current?.state === 'failed') state = current.state;
    else if (current?.state === 'checking' && pending.current?.phone === cleaned) state = await pending.current.verdict;
    else {
      state = await check(false);
      // A lookup that this very click had to start and that failed can have taken as long as the server's
      // timeout: sending now would make the server wait that long again. The next click goes ahead.
      if (state === 'failed') return false;
    }
    // The agent may have edited the number while the lookup was out.
    return state !== 'unregistered' && latestPhone.current === cleaned;
  };

  const send = async () => {
    setTouched(true);
    if (!canSend || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    setPhoneError(null);
    setTextError(null);
    try {
      if (!(await ensureChecked())) return;
      onStarted(await startChat(token as string, ws, phoneNumberId, { phone: cleaned, text: trimmed }));
    } catch (e) {
      const fields = e instanceof ApiError && e.code?.toUpperCase() === 'VALIDATION' ? e.fields : undefined;
      if (e instanceof ApiError && e.code?.toUpperCase() === 'NOT_ON_WHATSAPP') {
        // The cached answer said yes and was stale: show it where the lookup would have.
        setAnswer({ phone: cleaned, state: 'unregistered' });
      } else if (fields?.phone || fields?.text) {
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
                validated={shownPhoneError || unregistered ? 'error' : 'default'}
                onChange={(_e, v) => {
                  latestPhone.current = cleanPhone(v);
                  setPhone(v);
                  setPhoneError(null);
                }}
                onBlur={() => {
                  setTouched(true);
                  if (numberConnected && phoneValid && !current) void check(false);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  void send();
                }}
              />
              <FormHelperText>
                <HelperText isLiveRegion>
                  {shownPhoneError ? (
                    <HelperTextItem variant="error">{shownPhoneError}</HelperTextItem>
                  ) : current?.state === 'checking' ? (
                    <HelperTextItem variant="indeterminate">Checking WhatsApp…</HelperTextItem>
                  ) : current?.state === 'registered' ? (
                    <HelperTextItem variant="success">On WhatsApp</HelperTextItem>
                  ) : current?.state === 'unregistered' ? (
                    <HelperTextItem variant="error">
                      This number is not on WhatsApp{' '}
                      <Button variant="link" isInline onClick={() => void check(true)}>
                        Check again
                      </Button>
                    </HelperTextItem>
                  ) : current?.state === 'failed' ? (
                    <HelperTextItem variant="warning">Could not check this number</HelperTextItem>
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
            onClick={() => void ensureChecked().then((ok) => ok && setPicking(true))}
            isDisabled={!numberConnected || !phoneValid || sending || unregistered}
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
