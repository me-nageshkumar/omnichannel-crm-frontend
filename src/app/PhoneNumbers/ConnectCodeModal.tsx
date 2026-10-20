import * as React from 'react';
import { Alert, Button, Content, Modal, ModalBody, ModalFooter, ModalHeader, Spinner } from '@patternfly/react-core';
import { ConnectCode, PhoneNumber, shown } from '@app/api/phoneNumbers';
import { useAction } from '@app/admin/useAction';

function remaining(expiresAt: string, now: number): string {
  const secs = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

/**
 * Gets a one-time connect code and keeps it on screen with a countdown and the steps. A number that
 * already has a device asks first, since the new code replaces that device once used.
 */
export const ConnectCodeModal: React.FunctionComponent<{
  number: PhoneNumber;
  fetchCode(): Promise<ConnectCode>;
  onClose(): void;
}> = ({ number, fetchCode, onClose }) => {
  const [asked, setAsked] = React.useState(!number.hasDevice);
  const [code, setCode] = React.useState<ConnectCode | null>(null);
  const [now, setNow] = React.useState(Date.now());
  const [copied, setCopied] = React.useState(false);
  const action = useAction();
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => undefined,
    );
  };
  const fetchRef = React.useRef(fetchCode);
  fetchRef.current = fetchCode;

  React.useEffect(() => {
    if (!asked) return;
    action.run(() => fetchRef.current()).then((c) => c && setCode(c));
    // run once per confirmation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  React.useEffect(() => {
    if (!code) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [code]);

  const expired = code !== null && new Date(code.expiresAt).getTime() <= now;

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="code-modal-title">
      <ModalHeader title={`Connect ${shown(number.number)}`} labelId="code-modal-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        {!asked && (
          <Content component="p">
            This number already has a connected browser. A new code replaces the connected device when it is used.
          </Content>
        )}
        {asked && !code && !action.error && <Spinner aria-label="Getting a code" />}
        {code && (
          <>
            <Content component="p" style={{ fontFamily: 'monospace', fontSize: '2rem', letterSpacing: '0.15em' }}>
              {code.code}
            </Content>
            <Button variant="secondary" size="sm" onClick={() => copy(code.code)}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Content component="p">
              {expired ? 'This code has expired. Get a new one.' : `Expires in ${remaining(code.expiresAt, now)}`}
            </Content>
            <Content component="p">Any earlier code for this number has stopped working.</Content>
            <Content component="ol">
              <Content component="li">Open WhatsApp Web in Chrome and log in to {shown(number.number)}.</Content>
              <Content component="li">Click the extension icon, enter the server address and this code.</Content>
            </Content>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {!asked ? <Button onClick={() => setAsked(true)}>Get code</Button> : <Button onClick={onClose}>Done</Button>}
        {!asked && (
          <Button variant="link" onClick={onClose}>
            Cancel
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
