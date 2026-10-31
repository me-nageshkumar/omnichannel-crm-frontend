import * as React from 'react';
import {
  HistoryImportStatus,
  HistoryImportView,
  Page,
  cancelHistoryImport,
  isActive,
  listHistoryImports,
} from '@app/api/historyImports';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';

/** How often the list is fetched again while an import in it is queued or running. */
export const REFRESH_SECONDS = 5;

export interface HistoryImportFilters {
  phoneNumberId?: string;
  status?: HistoryImportStatus;
}

export interface HistoryImports {
  page: Page<HistoryImportView> | undefined;
  /** The last fetch's failure; the page from before it stays. */
  error: string | null;
  fetching: boolean;
  refresh(): void;
  /** Cancels an import, then fetches the list again; rejects with the cancel's failure. */
  cancel(id: string): Promise<void>;
}

const anyActive = (p: Page<HistoryImportView> | undefined) => !!p && p.items.some((v) => isActive(v.status));

/**
 * The brand's history imports, fetched again every {@link REFRESH_SECONDS} seconds while any of them is
 * active. Only the answer to the latest request is shown; answers after unmount or for other filters are dropped.
 */
export function useHistoryImports(filters: HistoryImportFilters): HistoryImports {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const { phoneNumberId, status } = filters;
  const [page, setPage] = React.useState<Page<HistoryImportView> | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [fetching, setFetching] = React.useState(false);
  const latest = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = React.useRef<Page<HistoryImportView> | undefined>(undefined);
  const loadRef = React.useRef<() => void>(() => undefined);
  const mounted = React.useRef(false);

  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  const schedule = (p: Page<HistoryImportView> | undefined) => {
    stop();
    if (anyActive(p)) timer.current = setTimeout(() => loadRef.current(), REFRESH_SECONDS * 1000);
  };

  loadRef.current = () => {
    // A cancel answered after unmount must not start a fetch for a page that is gone.
    if (!token || !mounted.current) return;
    stop();
    const request = ++latest.current;
    setFetching(true);
    listHistoryImports(token, ws, { phoneNumberId, status }).then(
      (p) => {
        if (request !== latest.current) return;
        shown.current = p;
        setPage(p);
        setError(null);
        setFetching(false);
        schedule(p);
      },
      (e) => {
        if (request !== latest.current) return;
        setError(messageFor(e));
        setFetching(false);
        schedule(shown.current);
      },
    );
  };

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    shown.current = undefined;
    setPage(undefined);
    setError(null);
    loadRef.current();
    return () => {
      stop();
      // Any answer still on its way is for a page that is gone (or for other filters).
      latest.current += 1;
    };
  }, [token, ws, phoneNumberId, status]);

  return {
    page,
    error,
    fetching,
    refresh: () => loadRef.current(),
    cancel: async (id: string) => {
      await cancelHistoryImport(token as string, ws, id);
      loadRef.current();
    },
  };
}
