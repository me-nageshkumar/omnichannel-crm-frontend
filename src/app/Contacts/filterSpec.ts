import type { ContactFilterSpec } from '@app/api/contacts';

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** The spec without its empty parts, so "nothing chosen" is never sent as a filter. */
export function cleanSpec(spec: ContactFilterSpec): ContactFilterSpec {
  return Object.fromEntries(Object.entries(spec).filter(([, v]) => !isEmpty(v))) as ContactFilterSpec;
}

/** Start of the day in the browser's time zone, as an ISO instant. */
export const dayStart = (date: string): string | undefined =>
  date ? new Date(`${date}T00:00:00`).toISOString() : undefined;

/** End of the day in the browser's time zone, as an ISO instant. */
export const dayEnd = (date: string): string | undefined =>
  date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;

/** The yyyy-mm-dd of an ISO instant in the browser's time zone, for a date input. */
export const dayOf = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const countText = (n: number) => `${n.toLocaleString('en-US')} contact${n === 1 ? '' : 's'}`;
