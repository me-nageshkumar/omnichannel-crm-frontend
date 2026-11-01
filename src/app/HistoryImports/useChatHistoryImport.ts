import * as React from 'react';
import {
  HistoryImportView,
  cancelHistoryImport,
  getHistoryImport,
  isActive,
  pauseHistoryImport,
  resumeHistoryImport,
} from '@app/api/historyImports';
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
  /** Each does its action on the import followed; each rejects with the action's failure. */
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  dismiss(): void;
}

/**
 * Follows one chat's history import: fetches it every {@link REFRESH_SECONDS} seconds until it has ended, and once
 * more after a stop, because the page on its way when it stopped still lands. Only the answer to the latest request
 * counts; nothing is fetched or set after unmount.
 */
export function useChatHistoryImport(): ChatHistoryImport {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [current, setCurrent] = React.useState<HistoryImportView | null>(null);
  // Bumped after a failed poll so the effect schedules the next one.
  const [retry, setRetry] = React.useState(0);
  const [settling, setSettling] = React.useState(false);
  const latest = React.useRef(0);

  React.useEffect(() => {
    if (!current || !token || (!isActive(current.status) && !settling)) return undefined;
    const request = ++latest.current;
    const timer = setTimeout(() => {
      getHistoryImport(token, ws, current.id).then(
        (view) => {
          if (request !== latest.current) return;
          setCurrent(view);
          setSettling(false);
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
  }, [current, retry, settling, token, ws]);

  const completed = current !== null && completedCleanly(current);
  React.useEffect(() => {
    if (!completed) return undefined;
    const timer = setTimeout(() => setCurrent(null), DONE_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [completed, current?.id]);

  /** Does an action on the import followed; an answer to a fetch already on its way no longer counts. */
  const act = async (action: typeof pauseHistoryImport) => {
    if (!current) return;
    const view = await action(token as string, ws, current.id);
    latest.current += 1;
    setCurrent(view);
  };

  return {
    current,
    start: setCurrent,
    pause: () => act(pauseHistoryImport),
    resume: () => act(resumeHistoryImport),
    stop: async () => {
      await act(cancelHistoryImport);
      setSettling(true);
    },
    dismiss: () => {
      latest.current += 1;
      setSettling(false);
      setCurrent(null);
    },
  };
}
