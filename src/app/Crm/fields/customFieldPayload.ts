import type { FieldDefinition } from '@app/api/crm';
import { isBlank, validateFieldValue } from '@app/Crm/common/fields/validateFieldValue';

function same(a: unknown, b: unknown): boolean {
  if (isBlank(a) && isBlank(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return String(a ?? '') === String(b ?? '');
}

/**
 * The {@code customFields} to send for a record form and the problems to show, by key. On create every filled active
 * field goes (a blank required one without a default is an error; the server fills defaults); on edit only the active
 * fields that changed, a cleared one as null. Fields switched off are never sent.
 */
export function customFieldPayload(
  defs: FieldDefinition[],
  stored: Record<string, unknown> | null | undefined,
  draft: Record<string, unknown>,
  creating: boolean,
): { payload: Record<string, unknown> | undefined; errors: Record<string, string> } {
  const payload: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const d of defs) {
    if (!d.active) continue;
    const before = stored?.[d.key];
    const after = draft[d.key];
    if (creating) {
      if (isBlank(after)) {
        if (d.required && isBlank(d.defaultValue)) errors[d.key] = 'This field is required.';
        continue;
      }
      payload[d.key] = after;
    } else {
      if (same(before, after)) continue;
      payload[d.key] = isBlank(after) ? null : after;
    }
    const problem = validateFieldValue(d, after, before);
    if (problem) errors[d.key] = problem;
  }
  return { payload: Object.keys(payload).length ? payload : undefined, errors };
}

/** The server's {@code customFields.<key>} errors of a failed save, by key. */
export function customFieldErrors(fieldErrors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) if (k.startsWith('customFields.')) out[k.slice(13)] = v;
  return out;
}

/** The names {@link useAction} should treat as shown: one per custom field. */
export const customFieldNames = (defs: FieldDefinition[]): string[] => defs.map((d) => `customFields.${d.key}`);
