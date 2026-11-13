import type { CloudMessage, CloudMessageType, Interactive } from '@app/api/cloudMessages';
import type { Draft } from '@app/Inbox/interactiveModel';
import {
  initialDraft,
  problems as interactiveProblems,
  toCloudMessage as interactiveToCloud,
} from '@app/Inbox/interactiveModel';

export type MessageKind = Exclude<CloudMessageType, never>;

export interface MediaDraft {
  id: string;
  caption: string;
  filename: string;
  uploadedName: string;
}

export interface LocationDraft {
  latitude: string;
  longitude: string;
  name: string;
  address: string;
}

/** A Send message node's message as the form edits it; every kind keeps its own draft so switching back loses nothing. */
export interface MessageDraft {
  kind: MessageKind;
  text: string;
  media: MediaDraft;
  location: LocationDraft;
  interactive: Draft;
}

export const MESSAGE_KINDS: { value: MessageKind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Document' },
  { value: 'location', label: 'Location' },
  { value: 'interactive', label: 'Interactive' },
];

export function emptyMessageDraft(): MessageDraft {
  return {
    kind: 'text',
    text: '',
    media: { id: '', caption: '', filename: '', uploadedName: '' },
    location: { latitude: '', longitude: '', name: '', address: '' },
    interactive: initialDraft(),
  };
}

const num = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
};

/** The Cloud message object (no `to`): what the node's `settings.message` stores. */
export function toCloudMessage(d: MessageDraft): CloudMessage {
  const base = { messaging_product: 'whatsapp-web' as const, recipient_type: 'individual' as const };
  switch (d.kind) {
    case 'text':
      return { ...base, type: 'text', text: { preview_url: false, body: d.text } };
    case 'interactive': {
      const m = interactiveToCloud(d.interactive);
      return { ...base, type: 'interactive', interactive: m.interactive };
    }
    case 'location': {
      const lat = num(d.location.latitude);
      const lng = num(d.location.longitude);
      const location: CloudMessage['location'] = { latitude: lat ?? 0, longitude: lng ?? 0 };
      if (d.location.name.trim()) location.name = d.location.name.trim();
      if (d.location.address.trim()) location.address = d.location.address.trim();
      return { ...base, type: 'location', location };
    }
    default: {
      const media: { id: string; caption?: string; filename?: string } = { id: d.media.id };
      if (d.kind !== 'audio' && d.media.caption.trim()) media.caption = d.media.caption;
      if (d.kind === 'document' && d.media.filename.trim()) media.filename = d.media.filename.trim();
      return { ...base, type: d.kind, [d.kind]: media } as CloudMessage;
    }
  }
}

/** A saved message back into the form's draft (unknown shapes become an empty text). */
export function fromCloudMessage(message: Record<string, unknown> | undefined | null): MessageDraft {
  const d = emptyMessageDraft();
  const m = (message ?? {}) as Partial<CloudMessage> & Record<string, unknown>;
  const type = m.type as MessageKind | undefined;
  if (!type) return d;
  d.kind = type;
  if (type === 'text') d.text = m.text?.body ?? '';
  else if (type === 'location' && m.location) {
    d.location = {
      latitude: String(m.location.latitude ?? ''),
      longitude: String(m.location.longitude ?? ''),
      name: m.location.name ?? '',
      address: m.location.address ?? '',
    };
  } else if (type === 'interactive' && m.interactive) {
    d.interactive = fromInteractive(m.interactive);
  } else if (type === 'image' || type === 'video' || type === 'audio' || type === 'document') {
    const media = m[type] as { id?: string; caption?: string; filename?: string } | undefined;
    d.media = {
      id: media?.id ?? '',
      caption: media?.caption ?? '',
      filename: media?.filename ?? '',
      uploadedName: media?.id ? 'uploaded file' : '',
    };
  }
  return d;
}

function fromInteractive(i: Interactive): Draft {
  const d = initialDraft();
  d.kind = i.type;
  d.body = i.body?.text ?? '';
  d.footer = i.footer?.text ?? '';
  if (i.header) {
    const h = i.header as {
      type: 'text' | 'image' | 'video' | 'document';
      text?: string;
      image?: { id: string };
      video?: { id: string };
      document?: { id: string };
    };
    const ref = h.type === 'text' ? null : ((h[h.type] as { id: string } | undefined) ?? null);
    d.header = { type: h.type, text: h.text ?? '', mediaId: ref?.id ?? null, fileName: ref ? 'uploaded file' : null };
  }
  if (i.type === 'button') {
    d.buttons = (i.action.buttons ?? []).map((b) => ({ id: b.reply.id, title: b.reply.title, idEdited: true }));
    if (d.buttons.length === 0) d.buttons = initialDraft().buttons;
  }
  if (i.type === 'list') {
    d.listButton = i.action.button ?? '';
    d.sections = (i.action.sections ?? []).map((s) => ({
      title: s.title,
      rows: s.rows.map((r) => ({ id: r.id, title: r.title, description: r.description ?? '', idEdited: true })),
    }));
    if (d.sections.length === 0) d.sections = initialDraft().sections;
  }
  if (i.type === 'cta_url')
    d.cta = { text: i.action.parameters?.display_text ?? '', url: i.action.parameters?.url ?? '' };
  return d;
}

/** Client-side problems keyed like the server's JSON paths (`text.body`, `image.id`, `interactive.…`). */
export function messageProblems(d: MessageDraft): Record<string, string> {
  const out: Record<string, string> = {};
  switch (d.kind) {
    case 'text':
      if (!d.text.trim()) out['text.body'] = 'is required';
      else if (d.text.length > 4096) out['text.body'] = 'must be at most 4096 characters';
      break;
    case 'interactive':
      Object.assign(out, interactiveProblems(d.interactive));
      break;
    case 'location':
      if (num(d.location.latitude) === null) out['location.latitude'] = 'is required';
      if (num(d.location.longitude) === null) out['location.longitude'] = 'is required';
      break;
    default:
      if (!d.media.id) out[`${d.kind}.id`] = 'upload a file';
      if (d.media.caption.length > 1024) out[`${d.kind}.caption`] = 'must be at most 1024 characters';
  }
  return out;
}
