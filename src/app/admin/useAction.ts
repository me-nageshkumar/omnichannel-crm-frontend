import * as React from 'react';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';

const FIELD_LABELS: Record<string, string> = { username: 'Username', name: 'Name' };

export interface Action {
  /** Runs {@code fn}; on failure records the message (or field errors) and resolves undefined. */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
  error: string | null;
  fieldErrors: Record<string, string>;
  busy: boolean;
  reset(): void;
}

/** Busy flag and error mapping for one management action (a form or a confirm). */
export function useAction(): Action {
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const reset = React.useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  const run = React.useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      reset();
      setBusy(true);
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError && e.code === 'DUPLICATE' && e.field) {
          setFieldErrors({ [e.field]: `${FIELD_LABELS[e.field] ?? e.field} is already in use.` });
        } else if (e instanceof ApiError && e.code === 'VALIDATION' && e.fields) {
          setFieldErrors(e.fields);
        } else {
          setError(messageFor(e));
        }
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [reset],
  );

  return { run, error, fieldErrors, busy, reset };
}
