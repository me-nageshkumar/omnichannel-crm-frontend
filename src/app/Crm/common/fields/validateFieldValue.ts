import type { FieldDef } from '@app/Crm/common/fields/types';

export const MAX_TEXT = 1000;
export const MAX_LONG_TEXT = 10000;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9]{6,15}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Empty, as the server sees it: nothing, a blank string or an empty list. */
export function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

function validDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function option(def: FieldDef, key: string, stored: unknown): string | null {
  const o = def.options.find((x) => x.key === key);
  if (!o) return 'Is not one of the options';
  if (!o.active && key !== stored && !(Array.isArray(stored) && stored.includes(key))) return 'Is no longer an option';
  return null;
}

/**
 * The server's rules for a custom field value (FieldValidator), so a form can show the error before saving; null when
 * the value is fine. {@code stored} is the record's current value: an option switched off since is still accepted.
 */
export function validateFieldValue(def: FieldDef, value: unknown, stored?: unknown): string | null {
  if (isBlank(value)) return def.required ? 'This field is required.' : null;
  switch (def.type) {
    case 'TEXT':
    case 'LONG_TEXT': {
      const max = def.type === 'TEXT' ? MAX_TEXT : MAX_LONG_TEXT;
      const s = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : null;
      if (s === null) return 'Has the wrong type';
      return s.length > max ? `Must be at most ${max} characters` : null;
    }
    case 'NUMBER':
    case 'CURRENCY': {
      const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
      if (!Number.isFinite(n)) return 'Must be a number';
      return def.type === 'CURRENCY' && n < 0 ? 'Must not be negative' : null;
    }
    case 'BOOLEAN':
      return typeof value === 'boolean' || value === 'true' || value === 'false' ? null : 'Must be true or false';
    case 'DATE':
      return typeof value === 'string' && validDate(value.trim()) ? null : 'Must be a date like 2026-10-24';
    case 'DATETIME':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value.trim())) && /\d{4}-\d{2}-\d{2}T/.test(value)
        ? null
        : 'Must be a date and time';
    case 'SELECT':
      return typeof value === 'string' ? option(def, value.trim(), stored) : 'Has the wrong type';
    case 'MULTI_SELECT': {
      if (!Array.isArray(value)) return 'Must be a list of options';
      const seen = new Set<string>();
      for (const item of value) {
        const key = String(item).trim();
        if (seen.has(key)) return 'Must not repeat an option';
        seen.add(key);
        const problem = option(def, key, stored);
        if (problem) return `${key}: ${problem.toLowerCase()}`;
      }
      return null;
    }
    case 'URL': {
      if (typeof value !== 'string') return 'Has the wrong type';
      try {
        const u = new URL(value.trim());
        if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname) return null;
      } catch {
        // reported below
      }
      return 'Must be a web address starting with http:// or https://';
    }
    case 'EMAIL':
      return typeof value === 'string' && EMAIL.test(value.trim()) ? null : 'Must be an email address';
    case 'PHONE':
      return typeof value === 'string' && PHONE.test(value.replace(/[\s-]/g, ''))
        ? null
        : 'Must be 6 to 15 digits, optionally starting with +';
    case 'USER':
      return typeof value === 'string' ? null : 'Has the wrong type';
    default:
      return null;
  }
}
