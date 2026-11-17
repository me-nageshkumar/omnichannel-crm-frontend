import * as React from 'react';
import type { Quote, QuoteRequest } from '@app/api/billing';
import { useSession } from '@app/session/SessionContext';

export interface QuoteState {
  /** The price of the request on screen; null while there is none, it is being asked for, or it failed. */
  quote: Quote | null;
  pending: boolean;
  /** What the server said when it could not price the request. */
  problem: unknown;
  /** True only when `quote` answers exactly the request passed in now: the one thing that may be raised. */
  matches: boolean;
}

interface Answer {
  key: string;
  quote: Quote | null;
  problem: unknown;
}

/**
 * Asks the server what a request costs, a moment after the request last changed. An answer for an older request is
 * dropped, so the figures shown are never those of something the form no longer says.
 *
 * @param request the request as the form has it, or null while the form is incomplete
 */
export function useQuote<R = QuoteRequest>(
  request: R | null,
  fetchQuote: (token: string, request: R) => Promise<Quote>,
  delayMs = 300,
): QuoteState {
  const { token } = useSession();
  const key = request === null ? '' : JSON.stringify(request);
  const [answer, setAnswer] = React.useState<Answer>({ key: '', quote: null, problem: null });
  const fetcher = React.useRef(fetchQuote);
  fetcher.current = fetchQuote;
  const wanted = React.useRef(key);
  wanted.current = key;

  React.useEffect(() => {
    if (!key || !token) return undefined;
    const timer = setTimeout(() => {
      fetcher.current(token, JSON.parse(key) as R).then(
        (quote) => {
          if (wanted.current === key) setAnswer({ key, quote, problem: null });
        },
        (problem) => {
          if (wanted.current === key) setAnswer({ key, quote: null, problem });
        },
      );
    }, delayMs);
    return () => clearTimeout(timer);
  }, [key, token, delayMs]);

  const current = key !== '' && answer.key === key;
  return {
    quote: current ? answer.quote : null,
    pending: key !== '' && !current,
    problem: current ? answer.problem : null,
    matches: current && answer.quote !== null,
  };
}
