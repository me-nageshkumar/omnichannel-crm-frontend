import type { CloudMessage, Header, Interactive, InteractiveType, Section } from '@app/api/cloudMessages';

/*
 * The interactive composer's form state and how it becomes a Cloud API message. Pure: the component renders a
 * Draft and calls these; `problems` keys match the server's JSON-path error keys so both land on the same fields.
 */

export type Kind = InteractiveType;

export interface HeaderDraft {
  type: 'none' | 'text' | 'image' | 'video' | 'document';
  text: string;
  mediaId: string | null;
  fileName: string | null;
}

export interface ButtonDraft {
  id: string;
  title: string;
  /** Once the agent typed an id, the title no longer rewrites it. */
  idEdited: boolean;
}

export interface RowDraft {
  id: string;
  title: string;
  description: string;
  idEdited: boolean;
}

export interface SectionDraft {
  title: string;
  rows: RowDraft[];
}

export interface Draft {
  kind: Kind;
  header: HeaderDraft;
  body: string;
  footer: string;
  buttons: ButtonDraft[];
  listButton: string;
  sections: SectionDraft[];
  cta: { text: string; url: string };
}

export const KINDS: { value: Kind; label: string }[] = [
  { value: 'button', label: 'Reply buttons' },
  { value: 'list', label: 'List' },
  { value: 'cta_url', label: 'Call-to-action link' },
  { value: 'location_request_message', label: 'Location request' },
];

/** Meta's limits (spec §3). */
export const LIMITS = {
  body: 1024,
  listBody: 4096,
  footer: 60,
  headerText: 60,
  buttons: 3,
  buttonTitle: 20,
  buttonId: 256,
  listButton: 20,
  sections: 10,
  rows: 10,
  sectionTitle: 24,
  rowId: 200,
  rowTitle: 24,
  rowDescription: 72,
  ctaText: 20,
  url: 2000,
} as const;

const emptyButton = (): ButtonDraft => ({ id: '', title: '', idEdited: false });
const emptyRow = (): RowDraft => ({ id: '', title: '', description: '', idEdited: false });

export function initialDraft(): Draft {
  return {
    kind: 'button',
    header: { type: 'none', text: '', mediaId: null, fileName: null },
    body: '',
    footer: '',
    buttons: [emptyButton()],
    listButton: '',
    sections: [{ title: '', rows: [emptyRow()] }],
    cta: { text: '', url: '' },
  };
}

/** Lower-case, spaces and punctuation to dashes, at most 50 characters; empty when nothing is left. */
export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

/** The button with a new title; its id follows the title unless the agent edited the id. */
export function withTitle<T extends { id: string; title: string; idEdited: boolean }>(item: T, title: string): T {
  return { ...item, title, id: item.idEdited ? item.id : slug(title) };
}

const blank = (s: string | null | undefined) => s === null || s === undefined || s.trim() === '';

function header(d: Draft): Header | undefined {
  const h = d.header;
  if (h.type === 'none') return undefined;
  if (h.type === 'text') return blank(h.text) ? undefined : { type: 'text', text: h.text.trim() };
  if (!h.mediaId) return { type: h.type };
  const ref = { id: h.mediaId };
  return h.type === 'image'
    ? { type: 'image', image: ref }
    : h.type === 'video'
      ? { type: 'video', video: ref }
      : { type: 'document', document: ref };
}

function sections(d: Draft): Section[] {
  return d.sections.map((s) => ({
    title: s.title.trim(),
    rows: s.rows.map((r) => {
      const row: { id: string; title: string; description?: string } = { id: r.id.trim(), title: r.title.trim() };
      if (!blank(r.description)) row.description = r.description.trim();
      return row;
    }),
  }));
}

/** The draft as the Cloud API object the backend sends; `to` is filled by the backend from the chat. */
export function toCloudMessage(d: Draft): CloudMessage {
  const interactive: Interactive = { type: d.kind, body: { text: d.body }, action: {} };
  const h = header(d);
  if (h && d.kind !== 'location_request_message') interactive.header = h;
  if (!blank(d.footer) && d.kind !== 'location_request_message') interactive.footer = { text: d.footer.trim() };
  switch (d.kind) {
    case 'button':
      interactive.action = {
        buttons: d.buttons.map((b) => ({ type: 'reply', reply: { id: b.id.trim(), title: b.title.trim() } })),
      };
      break;
    case 'list':
      interactive.action = { button: d.listButton.trim(), sections: sections(d) };
      break;
    case 'cta_url':
      interactive.action = { name: 'cta_url', parameters: { display_text: d.cta.text.trim(), url: d.cta.url.trim() } };
      break;
    default:
      interactive.action = { name: 'send_location' };
  }
  return { messaging_product: 'whatsapp-web', recipient_type: 'individual', type: 'interactive', interactive };
}

/** The server's error keys are JSON paths into the message; the composer uses the same paths. */
export function keyFor(field: string): string {
  return field;
}

const tooLong = (max: number) => `must be at most ${max} characters`;

/** Client-side checks keyed like the server's: required fields, lengths, the url scheme, an uploaded header. */
export function problems(d: Draft): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, message: string) => {
    if (!(key in out)) out[key] = message;
  };
  const check = (key: string, value: string, max: number, required: boolean) => {
    if (blank(value)) {
      if (required) put(key, 'is required');
    } else if (value.trim().length > max) put(key, tooLong(max));
  };
  const isList = d.kind === 'list';
  const isLocation = d.kind === 'location_request_message';
  check('interactive.body.text', d.body, isList ? LIMITS.listBody : LIMITS.body, true);
  if (!isLocation) check('interactive.footer.text', d.footer, LIMITS.footer, false);
  if (!isLocation && d.header.type === 'text') check('interactive.header.text', d.header.text, LIMITS.headerText, true);
  if (!isLocation && d.header.type !== 'none' && d.header.type !== 'text' && !d.header.mediaId) {
    put(`interactive.header.${d.header.type}.id`, 'Upload a file');
  }
  if (d.kind === 'button') {
    if (d.buttons.length < 1 || d.buttons.length > LIMITS.buttons)
      put('interactive.action.buttons', 'needs 1 to 3 buttons');
    const titles: Record<string, true> = {};
    const ids: Record<string, true> = {};
    d.buttons.forEach((b, n) => {
      const p = `interactive.action.buttons.${n}.reply`;
      check(`${p}.title`, b.title, LIMITS.buttonTitle, true);
      check(`${p}.id`, b.id, LIMITS.buttonId, true);
      const t = b.title.trim().toLowerCase();
      if (t && titles[t]) put(`${p}.title`, 'must be unique');
      titles[t] = true;
      if (b.id && ids[b.id]) put(`${p}.id`, 'must be unique');
      ids[b.id] = true;
    });
  } else if (isList) {
    check('interactive.action.button', d.listButton, LIMITS.listButton, true);
    if (d.sections.length < 1 || d.sections.length > LIMITS.sections)
      put('interactive.action.sections', 'needs 1 to 10 sections');
    let rows = 0;
    const titles: Record<string, true> = {};
    const ids: Record<string, true> = {};
    d.sections.forEach((s, i) => {
      const sp = `interactive.action.sections.${i}`;
      check(`${sp}.title`, s.title, LIMITS.sectionTitle, true);
      if (s.rows.length === 0) put(`${sp}.rows`, 'needs at least 1 row');
      s.rows.forEach((r, n) => {
        rows++;
        const rp = `${sp}.rows.${n}`;
        check(`${rp}.title`, r.title, LIMITS.rowTitle, true);
        check(`${rp}.id`, r.id, LIMITS.rowId, true);
        check(`${rp}.description`, r.description, LIMITS.rowDescription, false);
        const t = r.title.trim().toLowerCase();
        if (t && titles[t]) put(`${rp}.title`, 'must be unique');
        titles[t] = true;
        if (r.id && ids[r.id]) put(`${rp}.id`, 'must be unique');
        ids[r.id] = true;
      });
    });
    if (rows > LIMITS.rows) put('interactive.action.sections', 'at most 10 rows in total');
  } else if (d.kind === 'cta_url') {
    check('interactive.action.parameters.display_text', d.cta.text, LIMITS.ctaText, true);
    const url = d.cta.url.trim();
    if (blank(url)) put('interactive.action.parameters.url', 'is required');
    else if (!/^https:\/\/\S+$/.test(url)) put('interactive.action.parameters.url', 'must start with https://');
    else if (url.length > LIMITS.url) put('interactive.action.parameters.url', tooLong(LIMITS.url));
  }
  return out;
}
