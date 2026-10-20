import * as React from 'react';
import { Alert, Button, FormHelperText, HelperText, HelperTextItem, TextArea } from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { ChatView, MessageView, sendText } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { TemplatePickerModal } from '@app/Inbox/TemplatePickerModal';
import { useSession } from '@app/session/SessionContext';

const MAX_LENGTH = 4096;
const COUNTER_FROM = 3900;

/** The text box under a thread: Enter sends, Shift+Enter breaks the line, and a template can be sent instead. */
export const Composer: React.FunctionComponent<{
  chat: ChatView;
  numberConnected: boolean;
  onSent(message: MessageView): void;
}> = ({ chat, numberConnected, onSent }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [textError, setTextError] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState(false);
  // A second Enter can arrive before the first send has re-rendered the button as disabled.
  const inFlight = React.useRef(false);

  const notice =
    chat.status === 'CLOSED' ? 'Reopen to reply' : !numberConnected ? 'WhatsApp is not connected on this number' : null;
  const trimmed = text.trim();
  const canSend = notice === null && !sending && trimmed.length > 0;

  const send = async () => {
    if (!canSend || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    setTextError(null);
    try {
      const message = await sendText(token as string, ws, chat.id, trimmed);
      // Keep anything typed while the send was in flight.
      setText((now) => (now === text ? '' : now));
      onSent(message);
    } catch (e) {
      const field = e instanceof ApiError && e.code?.toUpperCase() === 'VALIDATION' ? e.fields?.text : undefined;
      if (field) setTextError(field);
      else setError(messageFor(e));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void send();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pf-t--global--spacer--sm)' }}>
      {notice && <Alert variant="info" isInline isPlain title={notice} />}
      {error && <Alert variant="danger" isInline isPlain title={error} />}
      <TextArea
        aria-label="Message"
        placeholder="Type a message"
        resizeOrientation="vertical"
        rows={2}
        maxLength={MAX_LENGTH}
        value={text}
        isDisabled={notice !== null}
        validated={textError ? 'error' : 'default'}
        onChange={(_e, v) => {
          setText(v);
          setTextError(null);
        }}
        onKeyDown={onKeyDown}
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
      <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={() => setPicking(true)} isDisabled={notice !== null || sending}>
          Template
        </Button>
        <Button variant="primary" onClick={() => void send()} isDisabled={!canSend}>
          Send
        </Button>
      </div>
      {picking && (
        <TemplatePickerModal
          chat={chat}
          onClose={() => setPicking(false)}
          onSent={(message) => {
            setPicking(false);
            onSent(message);
          }}
        />
      )}
    </div>
  );
};
