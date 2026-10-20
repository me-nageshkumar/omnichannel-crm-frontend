import * as React from 'react';
import type { PlaceholderKind, TemplateContent, TemplateType } from '@app/api/templates';

/** The same grammar as the backend's PlaceholderParser; keep the two in step. */

export interface PlaceholderRef {
  /** The inner text without braces or spaces, e.g. `contact.attributes.city`. */
  name: string;
  kind: PlaceholderKind;
  attributeKey: string | null;
}

const NAME = /^[a-z][a-z0-9_]{0,39}$/;
const PATH_CHARS = /^[A-Za-z0-9_.]+$/;
const CONTACT_ATTRIBUTES = 'contact.attributes.';
const SECTION_CHARS = '#^/>!{&=';
/** Like the backend, only ASCII spaces are trimmed inside braces; tab, U+00A0 and U+FEFF are not. */
const SPACES = /^ +| +$/g;
const RESERVED = 'this';

const invalid = (raw: string) => `invalid placeholder "{{${raw}}}"`;
const reserved = (name: string) => `"{{${name}}}" is reserved`;

/** Every distinct placeholder in order of first appearance, or the first syntax error. */
export function parsePlaceholders(text: string): { refs: PlaceholderRef[]; error: string | null } {
  const refs: PlaceholderRef[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    const open = text.indexOf('{{', from);
    if (open < 0) return { refs, error: null };
    const inner = open + 2;
    // Like the backend, only spaces (not other whitespace) may precede a sigil.
    let i = inner;
    while (text[i] === ' ') i++;
    if (i < text.length && SECTION_CHARS.includes(text[i])) {
      return { refs: [], error: `"{{${text[i]}" is not allowed — only {{name}} placeholders are supported` };
    }
    const close = text.indexOf('}}', inner);
    if (close < 0) return { refs: [], error: 'unclosed "{{"' };
    const raw = text.slice(inner, close);
    const result = classify(raw.replace(SPACES, ''), raw);
    if (typeof result === 'string') return { refs: [], error: result };
    if (!seen.has(result.name)) {
      seen.add(result.name);
      refs.push(result);
    }
    from = close + 2;
  }
}

/** The same decision tree as the backend's `PlaceholderParser.classify`, with the same messages. */
function classify(name: string, raw: string): PlaceholderRef | string {
  if (!PATH_CHARS.test(name)) return invalid(raw);
  if (name === 'contact' || name.startsWith('contact.')) {
    if (name === 'contact.name' || name === 'contact.phone') {
      return { name, kind: 'CONTACT_FIELD', attributeKey: null };
    }
    if (name.startsWith(CONTACT_ATTRIBUTES) && name.length > CONTACT_ATTRIBUTES.length) {
      const key = name.slice(CONTACT_ATTRIBUTES.length);
      if (!NAME.test(key)) return invalid(raw);
      if (key === RESERVED) return reserved(name);
      return { name, kind: 'CONTACT_ATTRIBUTE', attributeKey: key };
    }
    return `"{{${name}}}" is not a contact field`;
  }
  if (!NAME.test(name)) return invalid(raw);
  if (name === RESERVED) return reserved(name);
  return { name, kind: 'AGENT', attributeKey: null };
}

/** Replaces every `{{ name }}` with its value; a name without a value shows as `[name]`. */
export function fillPreview(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{ *([a-z][a-z0-9_.]*) *\}\}/g, (_m, name: string) =>
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
