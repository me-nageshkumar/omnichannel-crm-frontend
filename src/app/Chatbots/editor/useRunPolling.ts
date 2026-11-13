import * as React from 'react';
import type { Run } from '@app/api/chatbots';
import { getRun } from '@app/api/chatbots';
import { messageFor } from '@app/api/messages';
import type { StepState } from '@app/Chatbots/flowModel';
import { useSession } from '@app/session/SessionContext';

export const POLL_MS = 2000;

const active = (run: Run | null) => run !== null && (run.status === 'RUNNING' || run.status === 'WAITING');

/** Reads the run at once and then every two seconds while it is RUNNING or WAITING (spec §8.2). */
export function useRunPolling(
  chatbotId: string,
  runId: string | null,
): { run: Run | null; error: string | null; refresh(): void } {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [run, setRun] = React.useState<Run | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    setRun(null);
    setError(null);
  }, [runId]);

  React.useEffect(() => {
    if (!runId || !token) return undefined;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      getRun(token, ws, chatbotId, runId).then(
        (r) => {
          if (!live) return;
          setRun(r);
          setError(null);
          if (active(r)) timer = setTimeout(load, POLL_MS);
        },
        (e) => {
          if (!live) return;
          setError(messageFor(e));
          timer = setTimeout(load, POLL_MS);
        },
      );
    };
    load();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [chatbotId, runId, token, ws, tick]);

  return { run, error, refresh };
}

/** What the canvas shows per node: every step's outcome, and `waiting` on the node a waiting run sits at. */
export function runByNode(run: Run | null): Record<string, StepState> {
  const out: Record<string, StepState> = {};
  if (!run) return out;
  run.steps.forEach((s) => {
    out[s.nodeId] = s.outcome === 'FAILED' ? 'failed' : s.outcome === 'WAITING' ? 'waiting' : 'done';
  });
  if (run.status === 'WAITING' && run.currentNodeId) out[run.currentNodeId] = 'waiting';
  return out;
}
