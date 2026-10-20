import * as React from 'react';
import { InboxEvent, ThreadItem, getThread } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

export interface ThreadState {
  /** Messages and system lines of the chat, oldest first. */
  items: ThreadItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  /** Prepends the page older than the first item shown. */
  loadEarlier(): void;
  /** Fetches the latest page again and merges it in, e.g. to catch up after the live stream was down. */
  reload(): void;
  /** Folds a live event into the thread; events of other chats are ignored. */
  apply(event: InboxEvent): void;
}

export const itemKey = (item: ThreadItem): string =>
  item.kind === 'message' ? `m:${item.message?.id}` : `a:${item.action?.id}`;

const time = (item: ThreadItem) => Date.parse(item.at);

/** Adds new items and replaces known ones (by id) in place, then restores time order. */
function upsert(cur: ThreadItem[], incoming: ThreadItem[]): ThreadItem[] {
  const next = [...cur];
  for (const item of incoming) {
    const at = next.findIndex((x) => itemKey(x) === itemKey(item));
    if (at >= 0) next[at] = item;
    else next.push(item);
  }
  return next.sort((a, b) => time(a) - time(b));
}

/** The thread of one chat (nothing for null), kept current by {@link ThreadState.apply}. */
export function useThread(chatId: string | null): ThreadState {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [items, setItems] = React.useState<ThreadItem[]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(chatId !== null);
  const epoch = React.useRef(0);
  const latest = React.useRef({ items, hasMore, loading });
  latest.current = { items, hasMore, loading };

  // Items of another chat must not be shown while the new one loads.
  const keyId = JSON.stringify([ws, chatId]);
  const [shownKey, setShownKey] = React.useState(keyId);
  if (shownKey !== keyId) {
    setShownKey(keyId);
    setItems([]);
    setHasMore(false);
    setError(null);
    setLoading(chatId !== null);
  }

  React.useEffect(() => {
    if (!token || chatId === null) return undefined;
    const mine = ++epoch.current;
    setLoading(true);
    setError(null);
    getThread(token, ws, chatId).then(
      (res) => {
        if (epoch.current !== mine) return;
        // Keep what live events added while the page was on its way.
        setItems((cur) => upsert(cur, res.items));
        setHasMore(res.hasMore);
        setLoading(false);
      },
      (e) => {
        if (epoch.current !== mine) return;
        setError(messageFor(e));
        setLoading(false);
      },
    );
    return () => {
      epoch.current++;
    };
  }, [token, ws, chatId]);

  const loadEarlier = React.useCallback(() => {
    const { items: shown, hasMore: more, loading: busy } = latest.current;
    const before = shown[0]?.at;
    if (!token || chatId === null || !more || busy || !before) return;
    const mine = epoch.current;
    setLoading(true);
    setError(null);
    getThread(token, ws, chatId, before).then(
      (res) => {
        if (epoch.current !== mine) return;
        setItems((cur) => upsert(cur, res.items));
        setHasMore(res.hasMore);
        setLoading(false);
      },
      (e) => {
        if (epoch.current !== mine) return;
        setError(messageFor(e));
        setLoading(false);
      },
    );
  }, [token, ws, chatId]);

  const reload = React.useCallback(() => {
    if (!token || chatId === null) return;
    const mine = epoch.current;
    getThread(token, ws, chatId).then(
      (res) => {
        if (epoch.current !== mine) return;
        setItems((cur) => upsert(cur, res.items));
      },
      (e) => {
        if (epoch.current !== mine) return;
        setError(messageFor(e));
      },
    );
  }, [token, ws, chatId]);

  const apply = React.useCallback(
    (event: InboxEvent) => {
      if (event.type === 'chat' || event.chatId !== chatId) return;
      const item: ThreadItem =
        event.type === 'message'
          ? { kind: 'message', message: event.message, action: null, at: event.message.timestamp }
          : { kind: 'action', message: null, action: event.action, at: event.action.at };
      setItems((cur) => upsert(cur, [item]));
    },
    [chatId],
  );

  return { items, loading, error, hasMore, loadEarlier, reload, apply };
}
