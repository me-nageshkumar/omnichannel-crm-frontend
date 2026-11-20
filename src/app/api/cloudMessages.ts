import { apiFetch, apiFetchFile } from '@app/api/client';

/*
 * WhatsApp Cloud API message objects, field for field as Meta documents them (snake_case), with
 * `messaging_product: 'whatsapp-web'` when the channel is the WhatsApp Web bridge. The backend validates these
 * against Meta's limits and answers in the Cloud response shape.
 */

export interface MediaRef {
  id?: string;
  link?: string;
}

export type HeaderType = 'text' | 'image' | 'video' | 'document';

export interface Header {
  type: HeaderType;
  text?: string;
  image?: MediaRef;
  video?: MediaRef;
  document?: MediaRef;
}

export interface Reply {
  id: string;
  title: string;
}

export interface ActionButton {
  type: 'reply';
  reply: Reply;
}

export interface Row {
  id: string;
  title: string;
  description?: string;
}

export interface Section {
  title: string;
  rows: Row[];
}

export interface CtaParameters {
  display_text: string;
  url: string;
}

export interface Action {
  buttons?: ActionButton[];
  button?: string;
  sections?: Section[];
  name?: 'cta_url' | 'send_location';
  parameters?: CtaParameters;
}

export type InteractiveType = 'button' | 'list' | 'cta_url' | 'location_request_message';

export interface Interactive {
  type: InteractiveType;
  header?: Header;
  body: { text: string };
  footer?: { text: string };
  action: Action;
}

/** Meta's media object: an uploaded id, an optional caption (not for audio) and, for documents, a filename. */
export interface MediaObject {
  id: string;
  caption?: string;
  filename?: string;
}

export interface LocationObject {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export type CloudMessageType = 'text' | 'interactive' | 'image' | 'video' | 'audio' | 'document' | 'location';

export interface CloudMessage {
  messaging_product: 'whatsapp-web' | 'whatsapp';
  recipient_type?: 'individual';
  to?: string;
  type: CloudMessageType;
  text?: { preview_url?: boolean; body: string };
  interactive?: Interactive;
  image?: MediaObject;
  video?: MediaObject;
  audio?: MediaObject;
  document?: MediaObject;
  location?: LocationObject;
}

export interface CloudSendResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

const ws = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}`;
const account = (workspaceId: string, phoneNumberId: string) =>
  `${ws(workspaceId)}/channel-accounts/${encodeURIComponent(phoneNumberId)}`;

/** Sends to an open chat; the backend fills `to` from the chat. */
export const sendCloudMessage = (token: string, workspaceId: string, chatId: string, message: CloudMessage) =>
  apiFetch<CloudSendResponse>(`${ws(workspaceId)}/inbox/chats/${encodeURIComponent(chatId)}/cloud-messages`, {
    method: 'POST',
    token,
    body: message,
  });

/** Uploads a header file the Cloud way (multipart `file`, `messaging_product`, `type`); answers its id. */
export async function uploadCloudMedia(
  token: string,
  workspaceId: string,
  phoneNumberId: string,
  type: 'image' | 'video' | 'document',
  file: File,
  /** The number's own product: `whatsapp` for a Cloud API number. */
  product: 'whatsapp-web' | 'whatsapp' = 'whatsapp-web',
): Promise<{ id: string }> {
  const body = new FormData();
  body.append('file', file);
  body.append('messaging_product', product);
  body.append('type', type);
  const res = await apiFetchFile(`${account(workspaceId, phoneNumberId)}/media`, { token, body });
  return (await res.json()) as { id: string };
}

/** The page the message would be sent as, rendered by the server with inert actions, as HTML text. */
export async function previewCloudMessage(
  token: string,
  workspaceId: string,
  phoneNumberId: string,
  message: CloudMessage,
): Promise<string> {
  const res = await apiFetchFile(`${account(workspaceId, phoneNumberId)}/messages/preview`, {
    token,
    body: message,
    json: true,
  });
  return res.text();
}
