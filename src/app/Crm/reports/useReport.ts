import * as React from 'react';
import type { ReportFilter } from '@app/api/crm';
import { useLoad } from '@app/admin/useLoad';

export interface ReportQuery<T> {
  data: T | undefined;
  /** True while there is nothing to show yet for the current filter. */
  loading: boolean;
  error: string | null;
  reload(): void;
}

/**
 * Loads one report for the filter; a new filter starts over (a response to an older filter is dropped), a tick or
 * Retry reloads with the figures kept on screen until the new ones arrive.
 */
export function useReport<B extends ReportFilter, T>(
  call: (token: string, ws: string, body: B) => Promise<T>,
  ws: string,
  body: B,
  tick: number,
): ReportQuery<T> {
  const q = useLoad((t) => call(t, ws, body), [ws, JSON.stringify(body)], { keepOnError: true });
  // A refresh reloads in place (the figures stay until the new ones land); only a new filter starts over.
  const seen = React.useRef(tick);
  React.useEffect(() => {
    if (seen.current === tick) return;
    seen.current = tick;
    q.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return {
    data: q.data,
    loading: q.loading && q.data === undefined,
    error: q.error,
    reload: q.reload,
  };
}
