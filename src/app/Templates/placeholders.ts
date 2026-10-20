import * as React from 'react';
import type { PlaceholderKind, TemplateContent, TemplateType } from '@app/api/templates';

/** The same grammar as the backend's PlaceholderParser; keep the two in step. */

export interface PlaceholderRef {
  /** The inner text without braces or spaces, e.g. `contact.attributes.city`. */
  name: string;
  kind: PlaceholderKind;
  attributeKey: string | null;
}

const IDENT = '[a-z][a-z0-9_]{0,39}';
const PATH = new RegExp(`^${IDENT}(\\.${IDENT})*$`);
const ATTRIBUTE = new RegExp(`^contact\\.attributes\\.(${IDENT})$`);
const SECTION_CHARS = '#^/>!{&=';
const SPACES = /^\s+|\s+$/g;

/** Every distinct placeholder in order of first appearance, or the first syntax error. */
export function parsePlaceholders(text: string): { refs: PlaceholderRef[]; error: string | null } {
  const refs: PlaceholderRef[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    const open = text.indexOf('{{', from);
    if (open < 0) return { refs, error: null };
    const inner = open + 2;
    const first = text.slice(inner).replace(/^\s+/, '')[0];
    if (first !== undefined && SECTION_CHARS.includes(first)) {
      return { refs: [], error: `"{{${first}" is not allowed — only {{name}} placeholders are supported` };
    }
    const close = text.indexOf('}}', inner);
    if (close < 0) return { refs: [], error: 'unclosed "{{"' };
    const raw = text.slice(inner, close);
    const name = raw.replace(SPACES, '');
    if (!PATH.test(name)) return { refs: [], error: `invalid placeholder "{{${raw}}}"` };
    if (!name.startsWith('contact') && name.includes('.'))
      return { refs: [], error: `invalid placeholder "{{${raw}}}"` };
    const ref = refOf(name);
    if (!ref) return { refs: [], error: `"{{${raw}}}" is not a contact field` };
    if (!seen.has(ref.name)) {
      seen.add(ref.name);
      refs.push(ref);
    }
    from = close + 2;
  }
}

function refOf(name: string): PlaceholderRef | null {
  if (name === 'contact.name' || name === 'contact.phone') {
    return { name, kind: 'CONTACT_FIELD', attributeKey: null };
  }
  const attribute = ATTRIBUTE.exec(name);
  if (attribute) return { name, kind: 'CONTACT_ATTRIBUTE', attributeKey: attribute[1] };
  if (name === 'contact' || name.startsWith('contact.')) return null;
  return { name, kind: 'AGENT', attributeKey: null };
}

/** Replaces every `{{ name }}` with its value; a name without a value shows as `[name]`. */
export function fillPreview(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g, (_m, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : `[${name}]`,
  );
}

const FORMAT = new RegExp(
  [
    '```([\\s\\S]+?)```',
    '\\*(?!\\s)([^*\\n]*?[^\\s*])\\*',
    '_(?!\\s)([^_\\n]*?[^\\s_])_',
    '~(?!\\s)([^~\\n]*?[^\\s~])~',
  ].join('|'),
  'g',
);
const TAGS = ['code', 'strong', 'em', 's'] as const;

/**
 * WhatsApp's `*bold*`, `_italic_`, `~strike~` and ```mono``` as React elements. Text inside a span is
 * kept literal (no nesting), and nothing is ever parsed as HTML. Newlines stay in the text.
 */
export function formatWhatsApp(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  const pattern = new RegExp(FORMAT.source, 'g');
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    const group = [1, 2, 3, 4].find((i) => m[i] !== undefined) as number;
    out.push(React.createElement(TAGS[group - 1], { key: at }, m[group]));
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The content fields that accept placeholders, per type (the rest are plain). */
export const PLACEHOLDER_FIELDS: Record<TemplateType, (keyof TemplateContent)[]> = {
  TEXT: ['body'],
  IMAGE: ['caption'],
  VIDEO: ['caption'],
  DOCUMENT: ['caption'],
  AUDIO: [],
  LOCATION: ['name', 'address'],
  CONTACT_CARD: ['fullName', 'organization'],
  POLL: ['question', 'options'],
};
