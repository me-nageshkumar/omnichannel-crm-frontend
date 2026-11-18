import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, FormHelperText, HelperText, HelperTextItem, TextArea } from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { ChatView, MessageView, sendTemplate, sendText } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { InteractiveComposer } from '@app/Inbox/InteractiveComposer';
import { TemplatePickerModal } from '@app/Inbox/TemplatePickerModal';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

export const MAX_LENGTH = 4096;
export const COUNTER_FROM = 3900;

/**
 * The text box under a thread: Enter sends, Shift+Enter breaks the line, and a template or an interactive message
 * can be sent instead. An interactive send answers with the message id only, so {@code onSentId} lets the thread
 * reload.
 */
export const Composer: React.FunctionComponent<{
  chat: ChatView;
  numberConnected: boolean;
  onSent(message: MessageView): void;
  onSentId?(messageId: string): void;
}> = ({ chat, numberConnected, onSent, onSentId }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // the wallet could not pay for the send: said with a way to the page where it is topped up
  const [walletEmpty, setWalletEmpty] = React.useState(false);
  const canSeeBilling = useAccess().has('billing:view');
  const [textError, setTextError] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState(false);
  const [composing, setComposing] = React.useState(false);
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
    setWalletEmpty(false);
    setTextError(null);
    try {
      const message = await sendText(token as string, ws, chat.id, trimmed);
      // Keep anything typed while the send was in flight.
      setText((now) => (now === text ? '' : now));
      onSent(message);
    } catch (e) {
      const field = e instanceof ApiError && e.code?.toUpperCase() === 'VALIDATION' ? e.fields?.text : undefined;
      if (field) setTextError(field);
      else if (e instanceof ApiError && e.code?.toUpperCase() === 'WALLET_EMPTY') setWalletEmpty(true);
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
      {walletEmpty && (
        <Alert
          variant="danger"
          isInline
          isPlain
          title={
            <>
              The wallet balance is too low to send.{' '}
              {canSeeBilling ? (
                <>
                  <Link to="/billing">Top up the wallet</Link>.
                </>
              ) : (
                'Ask your administrator to top up the wallet.'
              )}
            </>
          }
        />
      )}
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
        <Button variant="secondary" onClick={() => setComposing(true)} isDisabled={notice !== null || sending}>
          Interactive
        </Button>
        <Button variant="secondary" onClick={() => setPicking(true)} isDisabled={notice !== null || sending}>
          Template
        </Button>
        <Button variant="primary" onClick={() => void send()} isDisabled={!canSend}>
          Send
        </Button>
      </div>
      {composing && (
        <InteractiveComposer
          chat={chat}
          onClose={() => setComposing(false)}
          onSent={(id) => {
            setComposing(false);
            onSentId?.(id);
          }}
        />
      )}
      {picking && (
        <TemplatePickerModal
          contactId={chat.contact.id}
          send={(id, values) => sendTemplate(token as string, ws, chat.id, id, values)}
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
