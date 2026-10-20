import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, EmptyState, Label, PageSection, Spinner } from '@patternfly/react-core';
import { useLoad } from '@app/admin/useLoad';
import { ChatView, InboxEvent, getChat, listInboxNumbers, markRead } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { shown } from '@app/api/phoneNumbers';
import { ChatHeader } from '@app/Inbox/ChatHeader';
import { ChatList } from '@app/Inbox/ChatList';
import { Composer } from '@app/Inbox/Composer';
import { Thread } from '@app/Inbox/Thread';
import { defaultFilters } from '@app/Inbox/chatDisplay';
import { useChatList } from '@app/Inbox/useChatList';
import { useInboxStream } from '@app/Inbox/useInboxStream';
import { useThread } from '@app/Inbox/useThread';
import { PhoneNumberStatusLabel } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';

const GAP = 'var(--pf-t--global--spacer--sm)';
const BORDER = '1px solid var(--pf-t--global--border--color--default)';
const REASSIGNED = 'This chat was reassigned and is no longer in your inbox';

/** The inbox of one number: the chats on the left, the open chat on the right, kept live by the event stream. */
export const InboxPage: React.FunctionComponent = () => {
  useDocumentTitle('Inbox | Omnichannel CRM');
  const { phoneNumberId = '', chatId } = useParams();
  const navigate = useNavigate();
  const { token, user, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const access = useAccess();

  const [filters, setFilters] = React.useState(() => defaultFilters(access));
  const list = useChatList(phoneNumberId, filters);
  const thread = useThread(chatId ?? null);
  const numbers = useLoad((t) => listInboxNumbers(t, ws), [ws]);
  const number = numbers.data?.find((n) => n.id === phoneNumberId);
  // Until the numbers are known, do not tell the agent the number is down.
  const numberConnected = number ? number.status === 'CONNECTED' : true;

  const [chat, setChat] = React.useState<ChatView | null>(null);
  const [openError, setOpenError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [readId, setReadId] = React.useState<string | null>(null);
  const openId = React.useRef(chatId);
  openId.current = chatId;

  // The URL decides which chat is open; opening it loads it and marks it read.
  React.useEffect(() => {
    setChat(null);
    setOpenError(null);
    setReadId(null);
    if (!token || !chatId) return undefined;
    let live = true;
    (async () => {
      try {
        const opened = await getChat(token, ws, chatId);
        if (!live) return;
        setChat(opened);
        await markRead(token, ws, chatId);
        if (live) setReadId(chatId);
      } catch (e) {
        // A chat that did not load is the error; a read mark that failed is only retried on the next open.
        if (live) setOpenError((current) => current ?? messageFor(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [token, ws, chatId]);

  // The chat being read has no unread badge, whichever of the list and the read mark arrives first.
  const { apply: applyToList, items: rows } = list;
  React.useEffect(() => {
    const row = rows.find((c) => c.id === readId);
    if (row && row.unreadCount > 0) applyToList({ type: 'chat', chat: { ...row, unreadCount: 0 }, visible: true });
  }, [rows, readId, applyToList]);

  // A chat that moved to the other of the Open / Closed lists no longer belongs in this one.
  const applyToShownList = (event: InboxEvent) =>
    list.apply(event.type === 'chat' && event.chat.status !== filters.status ? { ...event, visible: false } : event);

  const onEvent = (event: InboxEvent) => {
    if (event.type === 'chat' && event.chat.id === openId.current) {
      if (!event.visible) {
        setNotice(REASSIGNED);
        navigate(`/inbox/${encodeURIComponent(phoneNumberId)}`);
      } else {
        setChat(event.chat);
        // Something arrived while the chat is on screen: it is read already.
        if (event.chat.unreadCount > 0 && token) markRead(token, ws, event.chat.id).catch(() => undefined);
      }
    }
    applyToShownList(event);
    thread.apply(event);
  };
  const { connected } = useInboxStream(phoneNumberId, onEvent, () => {
    list.reload();
    numbers.reload();
    thread.reload();
    const reopened = openId.current;
    if (token && reopened) {
      getChat(token, ws, reopened).then(
        (fresh) => {
          if (openId.current === reopened) setChat(fresh);
        },
        () => undefined,
      );
    }
  });

  const select = (picked: ChatView) => {
    setNotice(null);
    navigate(`/inbox/${encodeURIComponent(phoneNumberId)}/${encodeURIComponent(picked.id)}`);
  };

  const open = chat && chat.id === chatId ? chat : null;
  return (
    <PageSection
      aria-label="Inbox"
      isFilled
      hasOverflowScroll
      hasBodyWrapper={false}
      padding={{ default: 'noPadding' }}
    >
      <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          role="group"
          aria-label="Inbox number"
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: GAP,
            padding: GAP,
            borderBottom: BORDER,
          }}
        >
          {number ? (
            <>
              <strong>{shown(number.number)}</strong>
              {number.label && <span>{number.label}</span>}
              <PhoneNumberStatusLabel number={number} />
            </>
          ) : (
            <strong>Inbox</strong>
          )}
          <Link to="/inbox">Change number</Link>
          {!connected && (
            <Label isCompact color="orange">
              Reconnecting…
            </Label>
          )}
        </div>
        <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex' }}>
          <div style={{ flex: '0 0 360px', minHeight: 0, borderInlineEnd: BORDER }}>
            <ChatList
              phoneNumberId={phoneNumberId}
              selectedId={chatId ?? null}
              onSelect={select}
              filters={filters}
              onFilters={setFilters}
              list={list}
            />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {notice && <Alert variant="warning" isInline title={notice} />}
            {openError && <Alert variant="danger" isInline title={openError} />}
            {!chatId ? (
              <EmptyState titleText="Pick a chat" headingLevel="h2" />
            ) : open ? (
              <>
                <ChatHeader
                  chat={open}
                  onChange={(updated) => {
                    setChat(updated);
                    applyToShownList({ type: 'chat', chat: updated, visible: true });
                  }}
                />
                <div style={{ flex: '1 1 0', minHeight: 0 }}>
                  <Thread chat={open} thread={thread} meId={user?.id ?? ''} />
                </div>
                <div style={{ flex: '0 0 auto', padding: GAP, borderTop: BORDER }}>
                  <Composer
                    chat={open}
                    numberConnected={numberConnected}
                    onSent={(message) => thread.apply({ type: 'message', chatId: open.id, message })}
                  />
                </div>
              </>
            ) : (
              !openError && <Spinner aria-label="Loading chat" style={{ margin: 'auto' }} />
            )}
          </div>
        </div>
      </div>
    </PageSection>
  );
};
