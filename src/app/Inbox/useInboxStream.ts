import * as React from 'react';
import { InboxEvent, parseSse, streamUrl, toInboxEvent } from '@app/api/inbox';
import { useSession } from '@app/session/SessionContext';

const MAX_BACKOFF_MS = 30_000;

/** How long to wait before connection attempt {@code attempt} + 1: 1 s, 2 s, 4 s … up to 30 s. */
export const backoffMs = (attempt: number): number => Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);

/** Resolves after {@code ms}, or at once when {@code signal} aborts. */
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });

/**
 * Keeps the live event stream of one number open: every event goes to {@code onEvent}; when the
 * stream drops it is reopened with backoff and {@code onReconnect} runs after each reopening, so the
 * caller can catch up on what it missed. Closes on unmount and when the number changes.
 */
export function useInboxStream(
  phoneNumberId: string,
  onEvent: (event: InboxEvent) => void,
  onReconnect: () => void,
): { connected: boolean } {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [connected, setConnected] = React.useState(false);
  const handlers = React.useRef({ onEvent, onReconnect });
  handlers.current = { onEvent, onReconnect };

  React.useEffect(() => {
    if (!token) return undefined;
    const control = new AbortController();
    const { signal } = control;

    const read = async (body: ReadableStream<Uint8Array>) => {
      const reader = body.getReader();
      const stop = () => void reader.cancel().catch(() => undefined);
      signal.addEventListener('abort', stop);
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          const parsed = parseSse(buffer + decoder.decode(value, { stream: true }));
          buffer = parsed.rest;
          for (const { event, data } of parsed.events) {
            const typed = toInboxEvent(event, data);
            if (typed && !signal.aborted) handlers.current.onEvent(typed);
          }
        }
      } finally {
        signal.removeEventListener('abort', stop);
      }
    };

    const run = async () => {
      let attempt = 0;
      let tries = 0;
      while (!signal.aborted) {
        const retry = tries++ > 0;
        try {
          const res = await fetch(streamUrl(ws, phoneNumberId), {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            signal,
          });
          if (!res.ok || !res.body) throw new Error(`stream answered ${res.status}`);
          if (signal.aborted) return;
          attempt = 0;
          setConnected(true);
          if (retry) handlers.current.onReconnect();
          await read(res.body);
        } catch {
          // Dropped or refused: fall through to the pause and try again.
        }
        if (signal.aborted) return;
        setConnected(false);
        await pause(backoffMs(attempt++), signal);
      }
    };
    void run();

    return () => {
      control.abort();
      setConnected(false);
    };
  }, [token, ws, phoneNumberId]);

  return { connected };
}
