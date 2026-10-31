import { NUMBER_PATTERN, normaliseNumber } from '@app/api/phoneNumbers';

/** Splits typed phone numbers on lines and commas; normalises, de-duplicates and sorts out the malformed ones. */
export function parsePhones(text: string): { phones: string[]; invalid: string[] } {
  const entries = text
    .split(/[\n,]/)
    .map((s) => normaliseNumber(s.trim()))
    .filter((s) => s !== '');
  const unique = entries.filter((p, i) => entries.indexOf(p) === i);
  return {
    phones: unique.filter((p) => NUMBER_PATTERN.test(p)),
    invalid: unique.filter((p) => !NUMBER_PATTERN.test(p)),
  };
}

const parts = (date: string) => date.split('-').map(Number) as [number, number, number];

/** Local midnight of a YYYY-MM-DD day, as an ISO instant. */
export function dayStart(date: string): string {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** The last millisecond of a YYYY-MM-DD local day, as an ISO instant. */
export function dayEnd(date: string): string {
  const [y, m, d] = parts(date);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** True for a real YYYY-MM-DD calendar day (rejects "2026-03", "2026-13-45" and "2026-02-31"). */
export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parts(value);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** An error when both days are set and "From" is after "To". */
export function validateRange(from: string, to: string): string | null {
  return from && to && isValidDay(from) && isValidDay(to) && from > to ? '"From" must not be after "To".' : null;
}
