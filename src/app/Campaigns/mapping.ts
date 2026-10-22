import type { AudienceKind, CampaignPlaceholder, PlaceholderSource } from '@app/api/campaigns';
import type { Contact, ContactAttribute } from '@app/api/contacts';
import type { PlaceholderView, TemplateView } from '@app/api/templates';

/** Where one placeholder gets its value, and what to send when that value is blank. */
export interface Mapping {
  source: PlaceholderSource | null;
  fallback: string;
}

export interface MappingContext {
  kind: AudienceKind;
  headers: string[];
  phoneColumn: string | null;
  nameColumn: string | null;
  attributes: ContactAttribute[];
}

/** Placeholders shared by several templates are listed once, in order of first appearance. */
export function distinctPlaceholders(templates: TemplateView[]): PlaceholderView[] {
  const seen = new Set<string>();
  const out: PlaceholderView[] = [];
  templates.forEach((t) =>
    t.placeholders.forEach((p) => {
      if (seen.has(p.name)) return;
      seen.add(p.name);
      out.push(p);
    }),
  );
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

/** The header equal to any of {@code names}, trimmed and ignoring case, or null. */
function findHeader(headers: string[], ...names: (string | null)[]): string | null {
  const wanted = names.filter((n): n is string => !!n).map(norm);
  return headers.find((h) => wanted.includes(norm(h))) ?? null;
}

const column = (c: string | null): PlaceholderSource | null => (c === null ? null : { kind: 'CSV_COLUMN', column: c });

function defaultSource(p: PlaceholderView, ctx: MappingContext): PlaceholderSource | null {
  if (ctx.kind === 'FILTER') {
    if (p.name === 'contact.name') return { kind: 'CONTACT_FIELD', field: 'name' };
    if (p.name === 'contact.phone') return { kind: 'CONTACT_FIELD', field: 'phone' };
    const id = p.attributeId;
    if (p.kind === 'CONTACT_ATTRIBUTE' && id && ctx.attributes.some((a) => a.id === id)) {
      return { kind: 'CONTACT_ATTRIBUTE', attributeId: id };
    }
    return null;
  }
  if (p.name === 'contact.phone') return column(ctx.phoneColumn);
  if (p.name === 'contact.name') return column(ctx.nameColumn ?? findHeader(ctx.headers, 'name'));
  if (p.kind === 'CONTACT_ATTRIBUTE') return column(findHeader(ctx.headers, p.attributeKey, p.attributeName));
  if (p.kind === 'AGENT') return column(findHeader(ctx.headers, p.name));
  return null;
}

export function defaultMapping(p: PlaceholderView, ctx: MappingContext): Mapping {
  return { source: defaultSource(p, ctx), fallback: p.fallback ?? '' };
}

function isValid(s: PlaceholderSource | null, ctx: MappingContext): boolean {
  if (s === null) return true;
  switch (s.kind) {
    case 'FIXED':
      return true;
    case 'CSV_COLUMN':
      return ctx.kind === 'CSV' && ctx.headers.includes(s.column);
    case 'CONTACT_FIELD':
      return ctx.kind === 'FILTER';
    case 'CONTACT_ATTRIBUTE':
      return ctx.kind === 'FILTER' && ctx.attributes.some((a) => a.id === s.attributeId);
  }
}

/** Keeps the choices that are still valid for {@code ctx}, defaults the rest, and drops removed placeholders. */
export function mergeMappings(
  prev: Record<string, Mapping>,
  placeholders: PlaceholderView[],
  ctx: MappingContext,
): Record<string, Mapping> {
  return Object.fromEntries(
    placeholders.map((p) => {
      const old = prev[p.name];
      return [p.name, old && old.source !== null && isValid(old.source, ctx) ? old : defaultMapping(p, ctx)];
    }),
  );
}

export function sourceOptions(ctx: MappingContext): { value: string; label: string }[] {
  const fixed = { value: 'fixed', label: 'Fixed text' };
  if (ctx.kind === 'CSV') return [...ctx.headers.map((h) => ({ value: `col:${h}`, label: h })), fixed];
  return [
    { value: 'field:name', label: 'Contact name' },
    { value: 'field:phone', label: 'Contact phone' },
    ...ctx.attributes.map((a) => ({ value: `attr:${a.id}`, label: a.name })),
    fixed,
  ];
}

export function encodeSource(s: PlaceholderSource | null): string {
  if (s === null) return '';
  switch (s.kind) {
    case 'CONTACT_FIELD':
      return `field:${s.field}`;
    case 'CONTACT_ATTRIBUTE':
      return `attr:${s.attributeId}`;
    case 'CSV_COLUMN':
      return `col:${s.column}`;
    case 'FIXED':
      return 'fixed';
  }
}

export function decodeSource(v: string, current: Mapping): PlaceholderSource | null {
  if (v === 'fixed') return { kind: 'FIXED', text: current.source?.kind === 'FIXED' ? current.source.text : '' };
  if (v === 'field:name') return { kind: 'CONTACT_FIELD', field: 'name' };
  if (v === 'field:phone') return { kind: 'CONTACT_FIELD', field: 'phone' };
  if (v.startsWith('attr:')) return { kind: 'CONTACT_ATTRIBUTE', attributeId: v.slice(5) };
  if (v.startsWith('col:')) return { kind: 'CSV_COLUMN', column: v.slice(4) };
  return null;
}

/**
 * Placeholders with no usable source, and those whose CSV column an earlier placeholder already uses.
 * contact.phone and contact.name read the audience's phone and name columns, so they never count as reuse.
 */
export function mappingProblems(
  placeholders: PlaceholderView[],
  mappings: Record<string, Mapping>,
): { unmapped: string[]; reused: string[] } {
  const unmapped: string[] = [];
  const reused: string[] = [];
  const used = new Set<string>();
  placeholders.forEach((p) => {
    const s = mappings[p.name]?.source ?? null;
    if (s === null || (s.kind === 'FIXED' && s.text.trim() === '')) {
      unmapped.push(p.name);
      return;
    }
    if (s.kind !== 'CSV_COLUMN' || p.name === 'contact.phone' || p.name === 'contact.name') return;
    if (used.has(s.column)) reused.push(p.name);
    else used.add(s.column);
  });
  return { unmapped, reused };
}

/** What each placeholder would render to for one sample contact or CSV row. */
export function previewValues(
  placeholders: PlaceholderView[],
  mappings: Record<string, Mapping>,
  sample: { contact?: Contact; row?: Record<string, string> },
): Record<string, string> {
  return Object.fromEntries(
    placeholders.map((p) => {
      const m = mappings[p.name];
      const s = m?.source ?? null;
      let value: string | null | undefined;
      if (s?.kind === 'FIXED') value = s.text;
      else if (s?.kind === 'CONTACT_FIELD') {
        const c = sample.contact;
        value = s.field === 'name' ? c?.name : c?.phone ? `+${c.phone}` : null;
      } else if (s?.kind === 'CONTACT_ATTRIBUTE') value = sample.contact?.attributes[s.attributeId];
      else if (s?.kind === 'CSV_COLUMN') value = sample.row?.[s.column];
      return [p.name, value && value.trim() !== '' ? value : (m?.fallback ?? '')];
    }),
  );
}

export function toPlaceholders(
  placeholders: PlaceholderView[],
  mappings: Record<string, Mapping>,
): CampaignPlaceholder[] {
  return placeholders.flatMap((p) => {
    const m = mappings[p.name];
    if (!m?.source) return [];
    return [{ name: p.name, source: m.source, fallback: m.source.kind === 'FIXED' ? '' : m.fallback }];
  });
}
