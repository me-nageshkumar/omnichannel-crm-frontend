import * as React from 'react';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';

const FIELD_LABELS: Record<string, string> = { username: 'Username', name: 'Name', code: 'Code' };

export interface Action {
  /** Runs {@code fn}; on failure records the message (or field errors) and resolves undefined. */
  run<T>(fn: () => Promise<T>): Promise<T | undefined>;
  error: string | null;
  fieldErrors: Record<string, string>;
  busy: boolean;
  reset(): void;
}

function fieldMessages(e: ApiError): Record<string, string> {
  if (e.code === 'DUPLICATE' && e.field) {
    return { [e.field]: `${FIELD_LABELS[e.field] ?? e.field} is already in use.` };
  }
  if (e.code === 'VALIDATION' && e.fields) return e.fields;
  return {};
}

/**
 * Busy flag and error mapping for one management action (a form or a confirm). {@code shownFields}
 * names the fields the form renders: server errors on any other field go to the banner, so a form never
 * fails silently. Omit it when the form shows no fields.
 */
export function useAction(shownFields: string[] = []): Action {
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
        const fields = e instanceof ApiError ? fieldMessages(e) : {};
        const keys = Object.keys(fields);
        if (keys.length === 0) {
          setError(messageFor(e));
        } else {
          setFieldErrors(fields);
          const hidden = keys.filter((k) => !shownFields.includes(k));
          if (hidden.length > 0) setError(hidden.map((k) => `${k}: ${fields[k]}`).join('; '));
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
