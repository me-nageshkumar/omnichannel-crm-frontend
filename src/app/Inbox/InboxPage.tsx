import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  Label,
  PageSection,
  Spinner,
} from '@patternfly/react-core';
import { useLoad } from '@app/admin/useLoad';
import { ApiError } from '@app/api/client';
import { ChatView, InboxEvent, getChat, listInboxNumbers, markRead } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { ChatHeader } from '@app/Inbox/ChatHeader';
import { ChatList } from '@app/Inbox/ChatList';
import { Composer } from '@app/Inbox/Composer';
import { NewChatModal } from '@app/Inbox/NewChatModal';
import { NumberFilter } from '@app/Inbox/NumberFilter';
import { Thread } from '@app/Inbox/Thread';
import { defaultFilters } from '@app/Inbox/chatDisplay';
import { readInboxFilter, writeInboxFilter } from '@app/Inbox/inboxFilterStore';
import { useChatList } from '@app/Inbox/useChatList';
import { useInboxStream } from '@app/Inbox/useInboxStream';
import { useThread } from '@app/Inbox/useThread';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';

const GAP = 'var(--pf-t--global--spacer--sm)';
const BORDER = '1px solid var(--pf-t--global--border--color--default)';
const REASSIGNED = 'This chat was reassigned and is no longer in your inbox';
const NO_NUMBERS = 'No numbers assigned to your teams yet';

/**
 * The inbox over every number the user may open (design §3.7): the chats on the left, narrowed by the number filter,
 * the open chat on the right, kept live by one event stream over the selected numbers.
 */
export const InboxPage: React.FunctionComponent = () => {
  useDocumentTitle('Inbox | Omnichannel CRM');
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { token, user, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const meId = user?.id ?? '';
  const access = useAccess();

  const numbers = useLoad((t) => listInboxNumbers(t, ws), [ws]);
  const visible = numbers.data ?? [];
  // The stored selection, less any number the user can no longer see; an empty selection is every number.
  const [stored, setStored] = React.useState(() => readInboxFilter(meId, ws));
  const selected = React.useMemo(
    () => (numbers.data ? stored.filter((id) => visible.some((n) => n.id === id)) : stored),
    [numbers.data, stored, visible],
  );
  React.useEffect(() => {
    if (numbers.data && selected.length !== stored.length) {
      setStored(selected);
      writeInboxFilter(meId, ws, selected);
    }
  }, [numbers.data, selected, stored.length, meId, ws]);
  const select = (ids: string[]) => {
    setStored(ids);
    writeInboxFilter(meId, ws, ids);
  };
  const ready = Boolean(numbers.data) && visible.length > 0;
  const startable = visible.filter((n) => !n.guest);

  const [filters, setFilters] = React.useState(() => defaultFilters(access));
  const list = useChatList(selected, filters, ready);
  const thread = useThread(chatId ?? null);

  const [chat, setChat] = React.useState<ChatView | null>(null);
  const [openError, setOpenError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [readId, setReadId] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
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

  // The chat leaves this inbox: say so, and go back to the empty pane.
  const leave = () => {
    setNotice(REASSIGNED);
    navigate('/inbox');
  };

  const onEvent = (event: InboxEvent) => {
    if (event.type === 'chat' && event.chat.id === openId.current) {
      if (!event.visible) {
        leave();
      } else {
        setChat(event.chat);
        // Something arrived while the chat is on screen: it is read already.
        if (event.chat.unreadCount > 0 && token) markRead(token, ws, event.chat.id).catch(() => undefined);
      }
    }
    // Which list a chat belongs in (status, scope, search) is the list's own call.
    list.apply(event);
    thread.apply(event);
  };
  const { state: stream } = useInboxStream(selected, onEvent, () => {
    list.reload();
    numbers.reload();
    thread.reload();
    const reopened = openId.current;
    if (token && reopened) {
      getChat(token, ws, reopened).then(
        (fresh) => {
          if (openId.current === reopened) setChat(fresh);
        },
        (e) => {
          // A chat that vanished while the stream was down is no longer ours to show.
          if (e instanceof ApiError && e.status === 404 && openId.current === reopened) leave();
        },
      );
    }
  }, ready);

  const pick = (picked: ChatView) => {
    setNotice(null);
    navigate(`/inbox/chats/${encodeURIComponent(picked.id)}`);
  };

  const open = chat && chat.id === chatId ? chat : null;
  const openNumber = open ? visible.find((n) => n.id === open.phoneNumberId) : undefined;
  // Until the numbers are known, do not tell the agent the number is down.
  const numberConnected = openNumber ? openNumber.status === 'CONNECTED' : true;

  if (numbers.data && visible.length === 0) {
    return (
      <PageSection aria-label="Inbox">
        {numbers.error && <Alert variant="danger" isInline title={numbers.error} />}
        <EmptyState titleText={NO_NUMBERS} headingLevel="h2">
          <EmptyStateBody>
            Your teams work no WhatsApp number yet. An admin sets a number&apos;s team on the Phone numbers page.
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button variant="link" component={(props) => <Link {...props} to="/phone-numbers" />}>
              Go to phone numbers
            </Button>
          </EmptyStateFooter>
        </EmptyState>
      </PageSection>
    );
  }

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
          aria-label="Inbox numbers"
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: GAP,
            padding: GAP,
            borderBottom: BORDER,
          }}
        >
          <strong>Inbox</strong>
          {numbers.error && <Alert variant="danger" isInline isPlain title={numbers.error} />}
          {ready ? (
            <NumberFilter numbers={visible} selected={selected} onChange={select} />
          ) : (
            !numbers.error && <Spinner size="md" aria-label="Loading numbers" />
          )}
          {ready && startable.length > 0 && access.hasInWorkspace('inbox:send') && (
            <Button variant="secondary" size="sm" onClick={() => setStarting(true)}>
              New chat
            </Button>
          )}
          {stream === 'retrying' && (
            <Label isCompact color="orange">
              Reconnecting…
            </Label>
          )}
        </div>
        <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex' }}>
          <div style={{ flex: '0 0 360px', minHeight: 0, borderInlineEnd: BORDER }}>
            <ChatList
              numbers={selected.length > 0 ? visible.filter((n) => selected.includes(n.id)) : visible}
              selectedId={chatId ?? null}
              onSelect={pick}
              filters={filters}
              onFilters={setFilters}
              list={list}
            />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {stream === 'failed' && (
              <Alert
                variant="danger"
                isInline
                title="Live updates are unavailable; reload the page to try again"
              />
            )}
            {notice && <Alert variant="warning" isInline title={notice} />}
            {openError && <Alert variant="danger" isInline title={openError} />}
            {!chatId ? (
              <EmptyState titleText="Pick a chat" headingLevel="h2" />
            ) : open ? (
              <>
                <ChatHeader
                  chat={open}
                  number={visible.length > 1 ? openNumber : undefined}
                  onChange={(updated) => {
                    // The answer may come after another chat was opened; it still belongs in the list.
                    if (updated.id === openId.current) setChat(updated);
                    list.apply({ type: 'chat', chat: updated, visible: true });
                  }}
                />
                <div style={{ flex: '1 1 0', minHeight: 0 }}>
                  <Thread chat={open} thread={thread} meId={meId} />
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
      {starting && (
        <NewChatModal
          numbers={startable}
          onClose={() => setStarting(false)}
          onStarted={(started) => {
            setStarting(false);
            setNotice(null);
            list.reload();
            thread.apply({ type: 'message', chatId: started.chatId, message: started });
            if (token && started.chatId === openId.current) {
              // Navigating to the URL already open re-runs nothing, so the chat (it may have been closed) is fetched here.
              getChat(token, ws, started.chatId).then(
                (fresh) => {
                  if (openId.current === started.chatId) setChat(fresh);
                },
                () => undefined,
              );
            }
            navigate(`/inbox/chats/${encodeURIComponent(started.chatId)}`);
          }}
        />
      )}
    </PageSection>
  );
};
