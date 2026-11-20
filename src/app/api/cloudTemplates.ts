import { apiFetch } from '@app/api/client';

/** Where a blank's value comes from by default. */
export type CloudTemplateFillKind = 'CONTACT_FIELD' | 'CONTACT_ATTRIBUTE' | 'AGENT';

export interface CloudTemplateFill {
  kind: CloudTemplateFillKind;
  /** `name` or `phone` for a contact field; the attribute's key for a contact attribute. */
  attributeKey?: string | null;
  fallback?: string | null;
}

/** A blank: `key` is `header:1`, `body:1` / `body:first_name`, or `button:<index>`. */
export interface CloudTemplateVariable {
  key: string;
  component: 'HEADER' | 'BODY' | 'BUTTON';
  index: number;
  example: string | null;
}

export type CloudTemplateHeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

/** A Meta template as imported; `components` is Meta's JSON. */
export interface CloudTemplate {
  id: string;
  connectionId: string;
  wabaId: string;
  name: string;
  language: string;
  category: string | null;
  status: string;
  rejectedReason: string | null;
  parameterFormat: 'POSITIONAL' | 'NAMED';
  components: CloudTemplateComponent[];
  header: { format: CloudTemplateHeaderFormat };
  variables: CloudTemplateVariable[];
  fills: Record<string, CloudTemplateFill>;
  supported: boolean;
  unsupportedReason: string | null;
  sendable: boolean;
  syncedAt: string | null;
  lastUsedAt: string | null;
}

/** Meta's component JSON, as much of it as the preview draws. */
export interface CloudTemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: { type: string; text?: string; url?: string; phone_number?: string }[];
}

export interface CloudTemplateSync {
  added: number;
  updated: number;
  removed: number;
}

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/meta/templates`;

export function listCloudTemplates(
  token: string,
  ws: string,
  query: { phoneNumberId?: string; sendable?: boolean } = {},
): Promise<CloudTemplate[]> {
  const params = new URLSearchParams();
  if (query.phoneNumberId) params.set('phoneNumberId', query.phoneNumberId);
  if (query.sendable) params.set('sendable', 'true');
  const q = params.toString();
  return apiFetch<CloudTemplate[]>(q ? `${base(ws)}?${q}` : base(ws), { token });
}

export const syncCloudTemplates = (token: string, ws: string, connectionId?: string) =>
  apiFetch<CloudTemplateSync>(`${base(ws)}/sync`, {
    method: 'POST',
    token,
    body: connectionId ? { connectionId } : {},
  });

export const saveCloudTemplateFills = (
  token: string,
  ws: string,
  id: string,
  fills: Record<string, CloudTemplateFill>,
) => apiFetch<CloudTemplate>(`${base(ws)}/${encodeURIComponent(id)}/fills`, { method: 'PUT', token, body: { fills } });
