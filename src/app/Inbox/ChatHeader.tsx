import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Label } from '@patternfly/react-core';
import { ChatView, closeChat, reopenChat } from '@app/api/inbox';
import { PhoneNumber, shown } from '@app/api/phoneNumbers';
import { messageFor } from '@app/api/messages';
import { AssignMenu } from '@app/Inbox/AssignMenu';
import { contactName } from '@app/Inbox/chatDisplay';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

const GAP = 'var(--pf-t--global--spacer--sm)';

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
}> = ({ chat, number, onChange }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const access = useAccess();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const closed = chat.status === 'CLOSED';
  const name = contactName(chat);

  const changed = (updated: ChatView) => {
    setError(null);
    onChange(updated);
  };
  const failed = (e: unknown) => setError(messageFor(e));
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
        <Label isCompact color={chat.assignedUser || chat.assignedTeam ? 'blue' : 'grey'}>
          {assignmentText(chat)}
        </Label>
        <span style={{ marginInlineStart: 'auto', display: 'flex', gap: GAP }}>
          {access.hasInWorkspace('inbox:assign') && <AssignMenu chat={chat} onChange={changed} onError={failed} />}
          {access.hasInWorkspace('inbox:send') && (
            <Button variant="secondary" onClick={() => void toggleStatus()} isDisabled={busy}>
              {closed ? 'Reopen' : 'Close'}
            </Button>
          )}
        </span>
      </div>
      {error && <Alert variant="danger" isInline isPlain title={error} />}
    </div>
  );
};
