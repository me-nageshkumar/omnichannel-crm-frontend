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
 * Loads one report for the filter; a new filter or tick starts over (a response to an older filter is dropped), a
 * reload with figures on screen keeps them until the new ones arrive.
 */
export function useReport<B extends ReportFilter, T>(
  call: (token: string, ws: string, body: B) => Promise<T>,
  ws: string,
  body: B,
  tick: number,
): ReportQuery<T> {
  const q = useLoad((t) => call(t, ws, body), [ws, JSON.stringify(body), tick], { keepOnError: true });
  return {
    data: q.data,
    loading: q.loading && q.data === undefined,
    error: q.error,
    reload: q.reload,
  };
}
