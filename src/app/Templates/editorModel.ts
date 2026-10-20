import type {
  MediaView,
  PlaceholderSetting,
  PlaceholderView,
  TemplateContent,
  TemplateRequest,
  TemplateType,
  TemplateView,
} from '@app/api/templates';
import { PLACEHOLDER_FIELDS, PlaceholderRef, fillPreview, parsePlaceholders } from '@app/Templates/placeholders';

/** What the editor keeps for one placeholder; typed text, so every value is a string. */
export interface Setting {
  fallback: string;
  label: string;
  example: string;
  required: boolean;
}

/** Keyed by placeholder name. Never pruned while the editor is open, so removing and re-adding keeps the text. */
export type Settings = Record<string, Setting>;

export const MAX_PLACEHOLDERS = 20;
export const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 12;
export const LIMITS = { body: 4096, caption: 1024 } as const;

export const MEDIA_TYPES: TemplateType[] = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'];
export const isMediaType = (type: TemplateType) => MEDIA_TYPES.includes(type);

/** The content fields each type uses; the rest stay null in the request. */
export const CONTENT_FIELDS: Record<TemplateType, (keyof TemplateContent)[]> = {
  TEXT: ['body', 'linkPreview'],
  IMAGE: ['caption'],
  VIDEO: ['caption'],
  DOCUMENT: ['caption'],
  AUDIO: ['voiceNote'],
  LOCATION: ['latitude', 'longitude', 'name', 'address'],
  CONTACT_CARD: ['fullName', 'phone', 'organization', 'email'],
  POLL: ['question', 'options', 'allowMultiple'],
};

export function emptyContent(): TemplateContent {
  return {
    body: null,
    linkPreview: null,
    caption: null,
    voiceNote: null,
    latitude: null,
    longitude: null,
    name: null,
    address: null,
    fullName: null,
    phone: null,
    organization: null,
    email: null,
    question: null,
    options: null,
    allowMultiple: null,
  };
}

/** A new template's content: the type's fields at their defaults. */
export function initialContent(type: TemplateType): TemplateContent {
  const c = emptyContent();
  switch (type) {
    case 'TEXT':
      return { ...c, body: '', linkPreview: true };
    case 'AUDIO':
      return { ...c, voiceNote: false };
    case 'LOCATION':
      return { ...c, name: '', address: '' };
    case 'CONTACT_CARD':
      return { ...c, fullName: '', phone: '', organization: '', email: '' };
    case 'POLL':
      return { ...c, question: '', options: ['', ''], allowMultiple: false };
    default:
      return { ...c, caption: '' };
  }
}

/** A loaded template's content on top of the defaults, so a field the server left null is still usable. */
export function loadedContent(type: TemplateType, loaded: TemplateContent): TemplateContent {
  const base = initialContent(type) as unknown as Record<string, unknown>;
  Object.entries(loaded).forEach(([k, v]) => {
    if (v !== null && v !== undefined) base[k] = v;
  });
  return base as unknown as TemplateContent;
}

const blankSetting = (ref: PlaceholderRef): Setting => ({
  fallback: '',
  label: '',
  example: '',
  // An agent field must be filled in before sending unless the author says otherwise.
  required: ref.kind === 'AGENT',
});

export function settingFor(settings: Settings, ref: PlaceholderRef): Setting {
  return settings[ref.name] ?? blankSetting(ref);
}

export function loadedSettings(placeholders: PlaceholderView[]): Settings {
  const out: Settings = {};
  placeholders.forEach((p) => {
    out[p.name] = {
      fallback: p.fallback ?? '',
      label: p.label ?? '',
      example: p.example ?? '',
      required: p.kind === 'AGENT' ? p.required : false,
    };
  });
  return out;
}

export interface Derived {
  /** Every distinct placeholder in the content, in field order. */
  refs: PlaceholderRef[];
  /** Grammar errors, keyed by control key (`content.body`, `content.options.1`). */
  errors: Record<string, string>;
}

/** The text of each placeholder-capable control, keyed `content.<field>` (`content.options.<i>` for poll options). */
export function placeholderTexts(type: TemplateType, content: TemplateContent): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  PLACEHOLDER_FIELDS[type].forEach((field) => {
    if (field === 'options') {
      (content.options ?? []).forEach((o, i) => out.push([`content.options.${i}`, o]));
    } else {
      out.push([`content.${field}`, (content[field] as string | null) ?? '']);
    }
  });
  return out;
}

export function derive(type: TemplateType, content: TemplateContent): Derived {
  const refs: PlaceholderRef[] = [];
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  placeholderTexts(type, content).forEach(([key, text]) => {
    const parsed = parsePlaceholders(text);
    if (parsed.error) errors[key] = parsed.error;
    parsed.refs.forEach((r) => {
      if (!seen.has(r.name)) {
        seen.add(r.name);
        refs.push(r);
      }
    });
  });
  return { refs, errors };
}

const PHONE = /^[1-9][0-9]{7,14}$/;
const text = (v: string | null | undefined) => v ?? '';

function tooLong(errors: Record<string, string>, key: string, value: string | null | undefined, max: number) {
  if (text(value).length > max) errors[key] = `Use at most ${max} characters`;
}

/** The client's checks; the server stays the authority. Keys are control keys. */
export function validate(
  type: TemplateType,
  name: string,
  category: string,
  content: TemplateContent,
  media: MediaView | null,
  refs: PlaceholderRef[],
  settings: Settings,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!name.trim()) e.name = 'Enter a name';
  else tooLong(e, 'name', name.trim(), 100);
  tooLong(e, 'category', category.trim(), 40);

  switch (type) {
    case 'TEXT':
      if (!text(content.body).trim()) e['content.body'] = 'Enter the message';
      else tooLong(e, 'content.body', content.body, LIMITS.body);
      break;
    case 'LOCATION':
      checkCoordinate(e, 'content.latitude', content.latitude, 90, 'latitude');
      checkCoordinate(e, 'content.longitude', content.longitude, 180, 'longitude');
      tooLong(e, 'content.name', content.name, 256);
      tooLong(e, 'content.address', content.address, 256);
      break;
    case 'CONTACT_CARD':
      if (!text(content.fullName).trim()) e['content.fullName'] = 'Enter the full name';
      else tooLong(e, 'content.fullName', content.fullName, 256);
      if (!PHONE.test(text(content.phone).trim())) {
        e['content.phone'] = 'Enter 8 to 15 digits with the country code, e.g. 919876543210';
      }
      tooLong(e, 'content.organization', content.organization, 256);
      tooLong(e, 'content.email', content.email, 256);
      break;
    case 'POLL': {
      if (!text(content.question).trim()) e['content.question'] = 'Enter the question';
      else tooLong(e, 'content.question', content.question, 255);
      const options = (content.options ?? []).map((o) => o.trim());
      options.forEach((o, i) => tooLong(e, `content.options.${i}`, o, 100));
      const filled = options.filter(Boolean);
      if (filled.length < MIN_OPTIONS) e['content.options'] = `Add at least ${MIN_OPTIONS} options`;
      else if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) {
        e['content.options'] = 'Options must be different from each other';
      }
      break;
    }
    default:
      tooLong(e, 'content.caption', content.caption, LIMITS.caption);
  }
  if (isMediaType(type) && !media) e.mediaId = 'Upload a file';

  if (refs.length > MAX_PLACEHOLDERS) e.placeholders = `at most ${MAX_PLACEHOLDERS} placeholders`;
  refs.forEach((ref) => {
    const s = settingFor(settings, ref);
    const key = (setting: string) => `placeholders.${ref.name}.${setting}`;
    if (ref.kind !== 'AGENT') {
      if (!s.fallback.trim()) e[key('fallback')] = 'Enter a fallback';
      else tooLong(e, key('fallback'), s.fallback, 200);
      return;
    }
    if (!s.label.trim()) e[key('label')] = 'Enter a label';
    else tooLong(e, key('label'), s.label, 60);
    tooLong(e, key('example'), s.example, 200);
    if (!s.required) tooLong(e, key('fallback'), s.fallback, 200);
  });
  return e;
}

function checkCoordinate(e: Record<string, string>, key: string, v: number | null, max: number, noun: string) {
  if (v === null || Number.isNaN(v) || v < -max || v > max) e[key] = `Enter a ${noun} between -${max} and ${max}`;
}

/** The request body: only the type's content fields, and only the settings of placeholders still in the content. */
export function buildRequest(
  type: TemplateType,
  name: string,
  category: string,
  content: TemplateContent,
  media: MediaView | null,
  refs: PlaceholderRef[],
  settings: Settings,
  version?: number,
): TemplateRequest {
  const out = emptyContent() as unknown as Record<string, unknown>;
  const optional = new Set<keyof TemplateContent>(['caption', 'name', 'address', 'organization', 'email']);
  CONTENT_FIELDS[type].forEach((field) => {
    const v = content[field];
    out[field] = optional.has(field) && v === '' ? null : v;
  });
  const placeholders: PlaceholderSetting[] = refs.map((ref) => {
    const s = settingFor(settings, ref);
    if (ref.kind !== 'AGENT')
      return { name: ref.name, fallback: s.fallback, label: null, example: null, required: false };
    return {
      name: ref.name,
      fallback: s.required ? null : s.fallback || null,
      label: s.label,
      example: s.example || null,
      required: s.required,
    };
  });
  return {
    name: name.trim(),
    category: category.trim() || null,
    type,
    content: out as unknown as TemplateContent,
    mediaId: isMediaType(type) ? (media?.mediaId ?? null) : null,
    placeholders,
    ...(version === undefined ? {} : { version }),
  };
}

/** Server field-error keys that belong to a control the page shows; the rest go to the banner. */
export function isShownKey(key: string, type: TemplateType, refs: PlaceholderRef[]): boolean {
  if (key === 'name' || key === 'category' || key === 'placeholders') return true;
  if (key === 'mediaId') return isMediaType(type);
  if (key.startsWith('content.')) {
    const field = key.slice('content.'.length).split('.')[0] as keyof TemplateContent;
    return CONTENT_FIELDS[type].includes(field);
  }
  return refs.some((r) => key.startsWith(`placeholders.${r.name}.`));
}

/**
 * What each placeholder shows in the local preview: an agent field its example, else `[label]`, else `[name]`;
 * a contact field its fallback, else `[name]`.
 */
export function previewValues(refs: PlaceholderRef[], settings: Settings): Record<string, string> {
  const out: Record<string, string> = {};
  refs.forEach((ref) => {
    const s = settingFor(settings, ref);
    out[ref.name] = ref.kind === 'AGENT' ? s.example || `[${s.label || ref.name}]` : s.fallback || `[${ref.name}]`;
  });
  return out;
}

/** The content with {@link fillPreview} applied to every field that accepts placeholders. */
export function fillContent(type: TemplateType, c: TemplateContent, values: Record<string, string>): TemplateContent {
  const out = { ...c } as unknown as Record<string, unknown>;
  PLACEHOLDER_FIELDS[type].forEach((field) => {
    const v = c[field];
    if (typeof v === 'string') out[field] = fillPreview(v, values);
    else if (Array.isArray(v)) out[field] = v.map((o) => fillPreview(o, values));
  });
  return out as unknown as TemplateContent;
}

/** True when the draft would save as something other than the last saved (or loaded) template. */
export function isDirty(
  saved: TemplateView | undefined,
  type: TemplateType,
  name: string,
  category: string,
  content: TemplateContent,
  media: MediaView | null,
  refs: PlaceholderRef[],
  settings: Settings,
): boolean {
  if (!saved) return true;
  const savedContent = loadedContent(type, saved.content);
  const baseline = buildRequest(
    type,
    saved.name,
    saved.category ?? '',
    savedContent,
    saved.media,
    derive(type, savedContent).refs,
    loadedSettings(saved.placeholders),
  );
  return (
    JSON.stringify(buildRequest(type, name, category, content, media, refs, settings)) !== JSON.stringify(baseline)
  );
}
