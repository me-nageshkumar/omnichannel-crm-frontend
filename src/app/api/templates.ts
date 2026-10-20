import { apiFetch, apiFetchFile } from '@app/api/client';

export type TemplateType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'LOCATION' | 'CONTACT_CARD' | 'POLL';
export const TEMPLATE_TYPES: TemplateType[] = [
  'TEXT',
  'IMAGE',
  'VIDEO',
  'DOCUMENT',
  'AUDIO',
  'LOCATION',
  'CONTACT_CARD',
  'POLL',
];
export type TemplateStatus = 'ACTIVE' | 'ARCHIVED';
export type PlaceholderKind = 'CONTACT_FIELD' | 'CONTACT_ATTRIBUTE' | 'AGENT';

/** Every field of every type; the fields a type does not use are null. */
export interface TemplateContent {
  body: string | null;
  linkPreview: boolean | null;
  caption: string | null;
  voiceNote: boolean | null;
  latitude: number | null;
  longitude: number | null;
  name: string | null;
  address: string | null;
  fullName: string | null;
  phone: string | null;
  organization: string | null;
  email: string | null;
  question: string | null;
  options: string[] | null;
  allowMultiple: boolean | null;
}

export interface MediaView {
  mediaId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface PlaceholderView {
  /** The placeholder text without braces, e.g. `contact.attributes.city` or `order_id`. */
  name: string;
  kind: PlaceholderKind;
  attributeKey: string | null;
  attributeId: string | null;
  /** The bound attribute's current name. */
  attributeName: string | null;
  /** True when the bound attribute no longer exists. */
  missing: boolean;
  label: string | null;
  example: string | null;
  required: boolean;
  fallback: string | null;
}

export interface Who {
  username: string;
  name: string;
}

export interface TemplateView {
  id: string;
  workspaceId: string;
  channel: string;
  name: string;
  category: string | null;
  type: TemplateType;
  content: TemplateContent;
  media: MediaView | null;
  placeholders: PlaceholderView[];
  status: TemplateStatus;
  lastUsedAt: string | null;
  createdBy: Who;
  creationTime: string;
  updatedBy: Who;
  lastUpdateTime: string;
  version: number;
  warnings: string[];
}

export interface PlaceholderSetting {
  name: string;
  fallback: string | null;
  label: string | null;
  example: string | null;
  required: boolean;
}

/** `type` is ignored on PUT; `version` is required on PUT. */
export interface TemplateRequest {
  name: string;
  category: string | null;
  type: TemplateType;
  content: TemplateContent;
  mediaId: string | null;
  placeholders: PlaceholderSetting[];
  version?: number;
}

export interface RenderRequest {
  contactId?: string;
  values: Record<string, string>;
}

export interface RenderedTemplate {
  type: TemplateType;
  content: TemplateContent;
  media: MediaView | null;
  vcard: string | null;
  missing: string[];
  warnings: string[];
}

export interface TemplateFilters {
  q?: string;
  type?: TemplateType | '';
  category?: string;
  status?: TemplateStatus;
}

const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}`;
const send = <T>(token: string, method: string, path: string, body?: unknown) =>
  apiFetch<T>(path, { method, token, body });

export const listTemplates = (token: string, ws: string, filters: TemplateFilters = {}) => {
  const query = new URLSearchParams();
  (['q', 'type', 'category', 'status'] as const).forEach((k) => {
    const v = filters[k];
    if (v) query.set(k, v);
  });
  const qs = query.toString();
  return apiFetch<TemplateView[]>(`${base(ws)}/templates${qs ? `?${qs}` : ''}`, { token });
};
export const getCategories = (token: string, ws: string) =>
  apiFetch<string[]>(`${base(ws)}/templates/categories`, { token });
export const getTemplate = (token: string, ws: string, id: string) =>
  apiFetch<TemplateView>(`${base(ws)}/templates/${id}`, { token });
export const createTemplate = (token: string, ws: string, req: TemplateRequest) =>
  send<TemplateView>(token, 'POST', `${base(ws)}/templates`, req);
export const updateTemplate = (token: string, ws: string, id: string, req: TemplateRequest) =>
  send<TemplateView>(token, 'PUT', `${base(ws)}/templates/${id}`, req);
export const archiveTemplate = (token: string, ws: string, id: string) =>
  send<TemplateView>(token, 'POST', `${base(ws)}/templates/${id}/archive`);
export const unarchiveTemplate = (token: string, ws: string, id: string) =>
  send<TemplateView>(token, 'POST', `${base(ws)}/templates/${id}/unarchive`);
export const deleteTemplate = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/templates/${id}`);
export const duplicateTemplate = (
  token: string,
  ws: string,
  id: string,
  body: { targetWorkspaceId: string; name: string },
) => send<TemplateView>(token, 'POST', `${base(ws)}/templates/${id}/duplicate`, body);
export const renderTemplate = (token: string, ws: string, id: string, req: RenderRequest) =>
  send<RenderedTemplate>(token, 'POST', `${base(ws)}/templates/${id}/render`, req);

export async function uploadTemplateMedia(token: string, ws: string, file: File): Promise<MediaView> {
  const body = new FormData();
  body.append('file', file);
  const res = await apiFetchFile(`${base(ws)}/template-media`, { token, body });
  return (await res.json()) as MediaView;
}

/** Where the file is served; fetch it with {@code apiFetchBlob}, since it needs the auth header. */
export const templateMediaUrl = (ws: string, mediaId: string) =>
  `${base(ws)}/template-media/${encodeURIComponent(mediaId)}`;
