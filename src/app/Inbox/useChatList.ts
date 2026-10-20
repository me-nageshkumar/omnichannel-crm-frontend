import * as React from 'react';
import { ChatView, InboxEvent, listChats } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import type { ChatListFilters } from '@app/Inbox/chatDisplay';
import { useSession } from '@app/session/SessionContext';

export const SEARCH_DEBOUNCE_MS = 300;

export interface ChatList {
  items: ChatView[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  /** Appends the page older than the last chat shown. */
  loadMore(): void;
  /** Fetches the list again from the top. */
  reload(): void;
  /** Folds a live event into the list; only `chat` events of this number matter here. */
  apply(event: InboxEvent): void;
}

const time = (chat: ChatView) => (chat.lastMessageAt ? Date.parse(chat.lastMessageAt) : 0);
const byRecent = (a: ChatView, b: ChatView) => time(b) - time(a);

/** The chats of one number for {@code filters}, newest first, kept current by {@link ChatList.apply}. */
export function useChatList(phoneNumberId: string, filters: ChatListFilters): ChatList {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { scope, status, unread } = filters;
  const [q, setQ] = React.useState(filters.q);
  const [items, setItems] = React.useState<ChatView[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  const epoch = React.useRef(0);
  const latest = React.useRef({ items, hasMore, loading, phoneNumberId, status });
  latest.current = { items, hasMore, loading, phoneNumberId, status };

  React.useEffect(() => {
    const timer = setTimeout(() => setQ(filters.q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.q]);

  // Chats loaded for other filters must not be shown while the new ones load.
  const keyId = JSON.stringify([ws, phoneNumberId, scope, status, q, unread]);
  const shownKey = React.useRef(keyId);
  if (shownKey.current !== keyId) {
    shownKey.current = keyId;
    setItems([]);
    setHasMore(false);
    setLoading(true);
  }

  React.useEffect(() => {
    if (!token) return undefined;
    const mine = ++epoch.current;
    setLoading(true);
    setError(null);
    listChats(token, ws, phoneNumberId, { scope, status, q, unread }).then(
      (res) => {
        if (epoch.current !== mine) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        setLoading(false);
      },
      (e) => {
        if (epoch.current !== mine) return;
        setItems([]);
        setHasMore(false);
        setError(messageFor(e));
        setLoading(false);
      },
    );
    return () => {
      epoch.current++;
    };
  }, [token, ws, phoneNumberId, scope, status, q, unread, tick]);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  const loadMore = React.useCallback(() => {
    const { items: shown, hasMore: more, loading: busy } = latest.current;
    const before = shown[shown.length - 1]?.lastMessageAt;
    if (!token || !more || busy || !before) return;
    const mine = epoch.current;
    setLoading(true);
    setError(null);
    listChats(token, ws, phoneNumberId, { scope, status, q, unread, before }).then(
      (res) => {
        if (epoch.current !== mine) return;
        setItems((cur) => [...cur, ...res.items.filter((c) => !cur.some((x) => x.id === c.id))]);
        setHasMore(res.hasMore);
        setLoading(false);
      },
      (e) => {
        if (epoch.current !== mine) return;
        setError(messageFor(e));
        setLoading(false);
      },
    );
  }, [token, ws, phoneNumberId, scope, status, q, unread]);

  const apply = React.useCallback(
    (event: InboxEvent) => {
      if (event.type !== 'chat') return;
      const { chat, visible } = event;
      const now = latest.current;
      if (chat.phoneNumberId !== now.phoneNumberId) return;
      if (!visible) {
        setItems((cur) => cur.filter((c) => c.id !== chat.id));
      } else if (now.items.some((c) => c.id === chat.id)) {
        setItems((cur) => cur.map((c) => (c.id === chat.id ? chat : c)).sort(byRecent));
      } else if (chat.status === now.status) {
        // Whether it belongs in the current scope is the server's call, so ask it.
        reload();
      }
    },
    [reload],
  );

  return { items, loading, error, hasMore, loadMore, reload, apply };
}
