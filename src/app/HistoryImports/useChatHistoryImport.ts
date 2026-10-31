import * as React from 'react';
import { HistoryImportView, getHistoryImport, isActive } from '@app/api/historyImports';
import { useSession } from '@app/session/SessionContext';
import { completedCleanly } from './historyImportDisplay';
import { REFRESH_SECONDS } from './useHistoryImports';

/** How long a cleanly completed import's result stays visible; a failed or skipped chat stays until dismissed. */
const DONE_SECONDS = 10;

export interface ChatHistoryImport {
  /** The import being followed, or its final state until dismissed. */
  current: HistoryImportView | null;
  /** Follows an import that was just started. */
  start(imp: HistoryImportView): void;
  dismiss(): void;
}

/**
 * Follows one chat's history import: fetches it every {@link REFRESH_SECONDS} seconds until it is no longer
 * active. Only the answer to the latest request counts; nothing is fetched or set after unmount.
 */
export function useChatHistoryImport(): ChatHistoryImport {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [current, setCurrent] = React.useState<HistoryImportView | null>(null);
  // Bumped after a failed poll so the effect schedules the next one.
  const [retry, setRetry] = React.useState(0);
  const latest = React.useRef(0);

  React.useEffect(() => {
    if (!current || !token || !isActive(current.status)) return undefined;
    const request = ++latest.current;
    const timer = setTimeout(() => {
      getHistoryImport(token, ws, current.id).then(
        (view) => {
          if (request === latest.current) setCurrent(view);
        },
        () => {
          if (request === latest.current) setRetry((n) => n + 1);
        },
      );
    }, REFRESH_SECONDS * 1000);
    return () => {
      clearTimeout(timer);
      latest.current += 1;
    };
  }, [current, retry, token, ws]);

  const completed = current !== null && completedCleanly(current);
  React.useEffect(() => {
    if (!completed) return undefined;
    const timer = setTimeout(() => setCurrent(null), DONE_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [completed, current?.id]);

  return {
    current,
    start: setCurrent,
    dismiss: () => {
      latest.current += 1;
      setCurrent(null);
    },
  };
}
