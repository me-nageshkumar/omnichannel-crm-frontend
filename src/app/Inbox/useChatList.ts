import * as React from 'react';
import { ChatView, InboxEvent, ListScope, listChats } from '@app/api/inbox';
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
  /**
   * Folds a live event into the list; only `chat` events of this number matter here. The list decides whether
   * the chat belongs (status, scope, search), so the caller just forwards events.
   */
  apply(event: InboxEvent): void;
}

const assigned = (chat: ChatView) => chat.assignedUser !== null || chat.assignedTeam !== null;
const assignment = (chat: ChatView) => `${chat.assignedUser?.id ?? ''}/${chat.assignedTeam?.id ?? ''}`;

/** Whether {@code chat}, as it is now, belongs in the list of {@code status} and {@code scope} for user {@code meId}. */
function belongs(chat: ChatView, status: ChatView['status'], scope: ListScope, meId: string): boolean {
  if (chat.status !== status) return false;
  if (scope === 'UNASSIGNED') return !assigned(chat);
  if (scope === 'MINE' && meId) return chat.assignedUser?.id === meId;
  return true;
}

/** Whether a chat could be among the results for the search text {@code q} (prefix of name or phone) and the unread switch. */
function matchesSearch(chat: ChatView, q: string, unread: boolean): boolean {
  if (unread && chat.unreadCount === 0) return false;
  const text = q.trim().toLowerCase();
  if (!text) return true;
  const { name, phone } = chat.contact;
  const digits = text.replace(/\D/g, '');
  return (
    (name?.toLowerCase().startsWith(text) ?? false) ||
    (phone !== null && (phone.startsWith(text) || (digits !== '' && phone.startsWith(digits))))
  );
}

const time = (chat: ChatView) => (chat.lastMessageAt ? Date.parse(chat.lastMessageAt) : 0);
const byRecent = (a: ChatView, b: ChatView) => time(b) - time(a);

/** The chats of one number for {@code filters}, newest first, kept current by {@link ChatList.apply}. */
export function useChatList(phoneNumberId: string, filters: ChatListFilters): ChatList {
  const { token, user, workspace } = useSession();
  const meId = user?.id ?? '';
  const ws = workspace?.id ?? '';
  const { scope, status, unread } = filters;
  const [q, setQ] = React.useState(filters.q);
  const [items, setItems] = React.useState<ChatView[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  const epoch = React.useRef(0);
  // The list fetch in flight, whether one more is wanted when it lands, and the chats removed since it started.
  const fetching = React.useRef(false);
  const dirty = React.useRef(false);
  const removed = React.useRef(new Set<string>());
  const latest = React.useRef({ items, hasMore, loading, phoneNumberId, status, scope, q, unread, meId });
  latest.current = { items, hasMore, loading, phoneNumberId, status, scope, q, unread, meId };

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
    if (!token) {
      fetching.current = false;
      return undefined;
    }
    const mine = ++epoch.current;
    fetching.current = true;
    dirty.current = false;
    removed.current.clear();
    setLoading(true);
    setError(null);
    // Something that changed while this was on its way is fetched once more, not once per change.
    const landed = () => {
      fetching.current = false;
      if (dirty.current) {
        dirty.current = false;
        fetching.current = true;
        setTick((t) => t + 1);
      }
    };
    listChats(token, ws, { phoneNumberIds: [phoneNumberId], scope, status, q, unread }).then(
      (res) => {
        if (epoch.current !== mine) return;
        // A reply cannot bring back a chat that left the list after it was asked for.
        setItems(res.items.filter((c) => !removed.current.has(c.id)));
        setHasMore(res.hasMore);
        setLoading(false);
        landed();
      },
      (e) => {
        if (epoch.current !== mine) return;
        landed();
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
    listChats(token, ws, { phoneNumberIds: [phoneNumberId], scope, status, q, unread, before }).then(
      (res) => {
        if (epoch.current !== mine) return;
        setItems((cur) => [
          ...cur,
          ...res.items.filter((c) => !removed.current.has(c.id) && !cur.some((x) => x.id === c.id)),
        ]);
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

  /** Asks for a fresh list, once: while one is on its way it is fetched again when it lands. */
  const reloadSoon = React.useCallback(() => {
    if (fetching.current) {
      dirty.current = true;
    } else {
      fetching.current = true;
      setTick((t) => t + 1);
    }
  }, []);

  const apply = React.useCallback(
    (event: InboxEvent) => {
      if (event.type !== 'chat') return;
      const { chat, visible } = event;
      const now = latest.current;
      if (chat.phoneNumberId !== now.phoneNumberId) return;
      if (!visible || !belongs(chat, now.status, now.scope, now.meId)) {
        removed.current.add(chat.id);
        setItems((cur) => (cur.some((c) => c.id === chat.id) ? cur.filter((c) => c.id !== chat.id) : cur));
        return;
      }
      removed.current.delete(chat.id);
      const known = now.items.find((c) => c.id === chat.id);
      if (known) {
        setItems((cur) => cur.map((c) => (c.id === chat.id ? chat : c)).sort(byRecent));
        // Whose list it is in the Team view is the server's call.
        if (now.scope === 'TEAM' && assignment(known) !== assignment(chat)) reloadSoon();
      } else if (matchesSearch(chat, now.q, now.unread)) {
        // Whether it belongs in the current scope and search is the server's call, so ask it.
        reloadSoon();
      }
    },
    [reloadSoon],
  );

  return { items, loading, error, hasMore, loadMore, reload, apply };
}
