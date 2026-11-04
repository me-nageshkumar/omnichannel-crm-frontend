import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Label } from '@patternfly/react-core';
import { getActiveChatImport, isActive } from '@app/api/historyImports';
import { ChatView, claimChat, closeChat, getChat, reopenChat } from '@app/api/inbox';
import { PhoneNumber, shown } from '@app/api/phoneNumbers';
import { messageFor } from '@app/api/messages';
import { AssignMenu } from '@app/Inbox/AssignMenu';
import { ReassignMenu } from '@app/Inbox/ReassignMenu';
import { ApiError } from '@app/api/client';
import { contactName, otherChatLabel } from '@app/Inbox/chatDisplay';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { ImportHistoryModal } from '@app/HistoryImports/ImportHistoryModal';
import { HistoryImportControls } from '@app/HistoryImports/HistoryImportControls';
import { completedCleanly, progressText, statusLabel, stoppedText } from '@app/HistoryImports/historyImportDisplay';
import { useChatHistoryImport } from '@app/HistoryImports/useChatHistoryImport';

const GAP = 'var(--pf-t--global--spacer--sm)';
const TAKEN = 'Someone else took this chat';

/** Who the chat belongs to, as the pill shows it. */
export function assignmentText(chat: Pick<ChatView, 'assignedUser' | 'assignedTeam'>): string {
  if (chat.assignedUser) return `Agent: ${chat.assignedUser.name}`;
  if (chat.assignedTeam) return `Team: ${chat.assignedTeam.name}`;
  return 'Unassigned';
}

/** The strip above a thread: who the contact is, who has the chat, and what may be done with it. */
export const ChatHeader: React.FunctionComponent<{
  chat: ChatView;
  /** The number the chat is on, when the viewer looks at more than one. */
  number?: PhoneNumber;
  onChange(chat: ChatView): void;
  /**
   * Called once when a history import of this chat completes with its chat fetched, so the thread can show the
   * new messages.
   */
  onHistoryImported?(): void;
}> = ({ chat, number, onChange, onHistoryImported }) => {
  const { token, user, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const access = useAccess();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [controlling, setControlling] = React.useState(false);
  const history = useChatHistoryImport();
  const { current: imp, dismiss, start: follow } = history;
  const notified = React.useRef<string | null>(null);
  const onImported = React.useRef(onHistoryImported);
  onImported.current = onHistoryImported;
  const impId = imp && completedCleanly(imp) ? imp.id : null;
  React.useEffect(() => {
    if (impId && notified.current !== impId) {
      notified.current = impId;
      onImported.current?.();
    }
  }, [impId]);
  // Another chat's header must not show this chat's import.
  React.useEffect(() => dismiss, [chat.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // An import started earlier, here or from another screen, can still be paused or stopped.
  const canImport = access.hasInWorkspace('inbox:import-history');
  React.useEffect(() => {
    if (!canImport || !token) return undefined;
    let open = true;
    getActiveChatImport(token, ws, chat.id).then(
      (active) => {
        if (open && active) follow(active);
      },
      () => undefined,
    );
    return () => {
      open = false;
    };
  }, [canImport, chat.id, token, ws]); // eslint-disable-line react-hooks/exhaustive-deps
  const closed = chat.status === 'CLOSED';
  const name = contactName(chat);

  const changed = (updated: ChatView) => {
    setError(null);
    onChange(updated);
  };
  const failed = (e: unknown) => setError(messageFor(e));
  const canSend = access.hasInWorkspace('inbox:send');
  const manager = access.hasInWorkspace('inbox:assign');
  const mine = Boolean(user) && chat.assignedUser?.id === user?.id;
  const claim = async () => {
    setBusy(true);
    try {
      changed(await claimChat(token as string, ws, chat.id));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CHAT_TAKEN') {
        setError(TAKEN);
        try {
          onChange(await getChat(token as string, ws, chat.id));
        } catch {
          // the header keeps showing the chat it has; the next event will catch up
        }
      } else {
        failed(e);
      }
    } finally {
      setBusy(false);
    }
  };
  const control = async (action: () => Promise<void>) => {
    setControlling(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      failed(e);
    } finally {
      setControlling(false);
    }
  };
  const toggleStatus = async () => {
    setBusy(true);
    try {
      changed(await (closed ? reopenChat : closeChat)(token as string, ws, chat.id));
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="group"
      aria-label="Chat header"
      style={{
        flex: '0 0 auto',
        padding: GAP,
        borderBottom: '1px solid var(--pf-t--global--border--color--default)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: GAP, flexWrap: 'wrap' }}>
        <strong>{name}</strong>
        {chat.contact.name && <span>{chat.contact.phone ? `+${chat.contact.phone}` : 'Number hidden'}</span>}
        {access.hasInWorkspace('contact:view') && <Link to={`/contacts/${chat.contact.id}`}>Open contact</Link>}
        {number && (
          <Label isCompact color="teal" title={number.label ?? undefined}>
            {shown(number.number)}
          </Label>
        )}
        {chat.adClick && (
          <Label isCompact color="purple" title={chat.adClick.headline ?? chat.adClick.description ?? undefined}>
            Ad
          </Label>
        )}
        <Label isCompact color={chat.assignedUser || chat.assignedTeam ? 'blue' : 'grey'}>
          {assignmentText(chat)}
        </Label>
        <span style={{ marginInlineStart: 'auto', display: 'flex', gap: GAP }}>
          {canSend && !chat.assignedUser && !closed && (
            <Button variant="primary" onClick={() => void claim()} isDisabled={busy}>
              Claim
            </Button>
          )}
          {canSend && chat.assignedUser && (mine || manager) && (
            <ReassignMenu chat={chat} onChange={changed} onError={failed} />
          )}
          {canImport && (
            <Button variant="secondary" onClick={() => setImporting(true)}>
              Fetch history
            </Button>
          )}
          {manager && <AssignMenu chat={chat} onChange={changed} onError={failed} />}
          {access.hasInWorkspace('inbox:send') && (
            <Button variant="secondary" onClick={() => void toggleStatus()} isDisabled={busy}>
              {closed ? 'Reopen' : 'Close'}
            </Button>
          )}
        </span>
      </div>
      {chat.otherChats && chat.otherChats.length > 0 && (
        <div
          style={{ fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--subtle)' }}
        >
          {chat.otherChats.length === 1
            ? 'This person also has another chat on this number: '
            : 'This person also has other chats on this number: '}
          {chat.otherChats.map((o, i) => (
            <React.Fragment key={o.id}>
              {i > 0 && ', '}
              <Link to={`/inbox/chats/${encodeURIComponent(o.id)}`}>{otherChatLabel(o.remoteId)}</Link>
            </React.Fragment>
          ))}
        </div>
      )}
      {error && <Alert variant="danger" isInline isPlain title={error} />}
      {imp && isActive(imp.status) && (
        <Alert
          variant="info"
          isInline
          isPlain
          title={progressText(imp)}
          actionLinks={
            <HistoryImportControls
              status={imp.status}
              busy={controlling}
              onPause={() => void control(history.pause)}
              onPlay={() => void control(history.resume)}
              onStop={() => void control(history.stop)}
            />
          }
        />
      )}
      {imp && completedCleanly(imp) && (
        <Alert
          variant="info"
          isInline
          isPlain
          title={`History imported: ${imp.counts.messagesInserted} new messages`}
        />
      )}
      {imp?.status === 'COMPLETED' && imp.counts.chatsSkipped > 0 && (
        <Alert variant="warning" isInline isPlain title="No chat with this contact on the phone" />
      )}
      {imp?.status === 'COMPLETED' && imp.counts.chatsSkipped === 0 && imp.counts.chatsFailed > 0 && (
        <Alert
          variant="warning"
          isInline
          isPlain
          title={`Could not fetch this chat's history${imp.error ? `: ${imp.error}` : ''}`}
        />
      )}
      {imp?.status === 'CANCELLED' && <Alert variant="info" isInline isPlain title={stoppedText(imp)} />}
      {imp?.status === 'FAILED' && (
        <Alert
          variant="warning"
          isInline
          isPlain
          title={`${statusLabel(imp.status)}${imp.error ? `: ${imp.error}` : ''}`}
        />
      )}
      {importing && (
        <ImportHistoryModal
          target={{ kind: 'chat', chat }}
          onStarted={(started) => {
            setImporting(false);
            history.start(started);
          }}
          onCancel={() => setImporting(false)}
        />
      )}
    </div>
  );
};
