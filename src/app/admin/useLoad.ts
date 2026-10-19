import * as React from 'react';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

export interface Loaded<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload(): void;
  /** Replaces the loaded value locally (e.g. after an update the server echoed back). */
  setData(update: (current: T | undefined) => T | undefined): void;
}

/** Loads {@code fetcher(token)} and reloads whenever {@code key} changes. */
export function useLoad<T>(fetcher: (token: string) => Promise<T>, key: unknown[] = []): Loaded<T> {
  const { token } = useSession();
  const [data, setDataState] = React.useState<T | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyId = JSON.stringify(key);
  const shownKey = React.useRef(keyId);

  // Data loaded for another key (e.g. the previous brand) must not be shown or acted on.
  if (shownKey.current !== keyId) {
    shownKey.current = keyId;
    setDataState(undefined);
    setLoading(true);
  }

  React.useEffect(() => {
    if (!token) return undefined;
    let live = true;
    setLoading(true);
    setError(null);
    fetcherRef.current(token).then(
      (value) => {
        if (!live) return;
        setDataState(value);
        setLoading(false);
      },
      (e) => {
        if (!live) return;
        setDataState(undefined);
        setError(messageFor(e));
        setLoading(false);
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tick, ...key]);

  return {
    data,
    error,
    loading,
    reload: () => setTick((t) => t + 1),
    setData: (update) => setDataState(update),
  };
}

/** {@code list} with {@code item} replacing the entry of the same id, or appended. */
export function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}
