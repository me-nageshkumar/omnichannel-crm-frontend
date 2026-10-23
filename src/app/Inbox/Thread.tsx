import * as React from 'react';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import type { ActionView, ChatView, ThreadItem } from '@app/api/inbox';
import { dayLabel } from '@app/Inbox/chatDisplay';
import { MessageBubble } from '@app/Inbox/MessageBubble';
import { ThreadState, itemKey } from '@app/Inbox/useThread';

const GAP = 'var(--pf-t--global--spacer--sm)';
/** How close to the bottom (px) still counts as "at the bottom" for following new items. */
const NEAR_BOTTOM = 40;

/** The system line for a chat action, e.g. "Assigned to Demo Agent by Demo Lead". */
export function actionText(action: ActionView): string {
  const target = action.toUser?.name ?? action.toTeam?.name;
  const by = action.by ? ` by ${action.by.name}` : '';
  switch (action.type) {
    case 'ROUTED':
      return `Routed to ${target ?? 'the team'}${routedReason(action)}`;
    case 'ASSIGNED':
      return `Assigned to ${target ?? 'someone'}${by}`;
    case 'UNASSIGNED':
      return `Unassigned${by}`;
    case 'CLOSED':
      return `Closed${by}`;
    case 'REOPENED':
      // A campaign that reopens a chat is named (its by has no id and reads "Campaign: <name>").
      return action.by && action.by.id === null ? `Reopened by ${action.by.name}` : 'Reopened';
    case 'TRANSFERRED':
      return `Transferred ${action.fromTeam ? `from ${action.fromTeam.name} ` : ''}to ${action.toTeam?.name ?? 'another team'}${by}`;
  }
}

/** Why routing chose as it did, when it was not the plain setting. */
function routedReason(action: ActionView): string {
  switch (action.reason) {
    case 'STICKY':
      return ' (returning customer)';
    case 'HANDED_BACK':
      return action.by ? ` (handed back by ${action.by.name})` : ' (handed back)';
    case 'OWNER_CHANGED':
      return ' (the number changed team)';
    case 'MEMBER_REMOVED':
      return ' (the previous agent left the team)';
    default:
      return '';
  }
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export interface ThreadProps {
  chat: ChatView;
  thread: ThreadState;
  meId: string;
}

/** The messages and system lines of a chat; fills its container and scrolls on its own. */
export const Thread: React.FunctionComponent<ThreadProps> = ({ chat, thread }) => {
  const { items, loading, error, hasMore, loadEarlier } = thread;
  const scroller = React.useRef<HTMLDivElement>(null);
  const nearBottom = React.useRef(true);
  const seen = React.useRef<{ first: string | null; last: string | null; height: number }>({
    first: null,
    last: null,
    height: 0,
  });

  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const first = items.length > 0 ? itemKey(items[0]) : null;
    const last = items.length > 0 ? itemKey(items[items.length - 1]) : null;
    const before = seen.current;
    if (before.first === null || first === null) {
      el.scrollTop = el.scrollHeight;
      nearBottom.current = true;
    } else if (last !== before.last) {
      if (nearBottom.current) el.scrollTop = el.scrollHeight;
    } else if (first !== before.first) {
      // Older items went in above: keep what the user was looking at where it was.
      el.scrollTop += el.scrollHeight - before.height;
    }
    seen.current = { first, last, height: el.scrollHeight };
  }, [items]);

  // Images and videos grow the content once they have loaded, after the scroll to the bottom has run. These
  // events do not bubble, so they are listened for in the capture phase.
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const grown = () => {
      if (nearBottom.current) el.scrollTop = el.scrollHeight;
    };
    el.addEventListener('load', grown, true);
    el.addEventListener('loadedmetadata', grown, true);
    return () => {
      el.removeEventListener('load', grown, true);
      el.removeEventListener('loadedmetadata', grown, true);
    };
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM;
  };

  const rows: React.ReactNode[] = [];
  let day = '';
  for (const item of items as ThreadItem[]) {
    const key = dayKey(item.at);
    if (key !== day) {
      day = key;
      rows.push(
        <div
          key={`d:${key}`}
          role="separator"
          style={{ alignSelf: 'center', padding: '2px 12px', borderRadius: 12, fontSize: 'small' }}
        >
          {dayLabel(item.at)}
        </div>,
      );
    }
    if (item.kind === 'message' && item.message) {
      rows.push(
        <MessageBubble
          key={itemKey(item)}
          message={item.message}
          side={item.message.direction === 'OUT' ? 'right' : 'left'}
        />,
      );
    } else if (item.action) {
      rows.push(
        <div key={itemKey(item)} style={{ alignSelf: 'center', fontSize: 'small', fontStyle: 'italic' }}>
          {actionText(item.action)}
        </div>,
      );
    }
  }

  return (
    <div
      ref={scroller}
      role="log"
      aria-label="Messages"
      data-chat={chat.id}
      onScroll={onScroll}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: GAP,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        padding: GAP,
      }}
    >
      {hasMore && (
        <div style={{ alignSelf: 'center' }}>
          <Button variant="link" onClick={loadEarlier} isDisabled={loading} isLoading={loading}>
            Load earlier
          </Button>
        </div>
      )}
      {error && <Alert variant="danger" isInline title={error} />}
      {rows}
      {loading && items.length === 0 && <Spinner aria-label="Loading messages" style={{ alignSelf: 'center' }} />}
      {!loading && !error && items.length === 0 && <p style={{ alignSelf: 'center' }}>No messages yet</p>}
    </div>
  );
};
