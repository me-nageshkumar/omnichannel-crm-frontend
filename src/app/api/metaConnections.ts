import { apiFetch } from '@app/api/client';

/** Whether Meta accepted the connection's token at the last check. */
export type MetaConnectionStatus = 'UNVERIFIED' | 'OK' | 'INVALID';

/** AUTO: the app's callback is ours; OVERRIDE: each WABA is pointed at us; MANUAL: paste it in the app dashboard. */
export type WebhookSetup = 'AUTO' | 'OVERRIDE' | 'MANUAL';

/** A brand's own Meta app; secrets are never sent back, only hints. */
export interface MetaConnection {
  id: string;
  name: string;
  appId: string;
  appSecretHint: string | null;
  appSecretSetAt: string | null;
  tokenHint: string | null;
  tokenSetAt: string | null;
  status: MetaConnectionStatus;
  checkedAt: string | null;
  lastError: string | null;
  webhook: {
    url: string;
    verifyToken: string;
    setup: WebhookSetup;
    error: string | null;
    lastWebhookAt: string | null;
  };
  numbers: { phoneNumberId: string; number: string; label: string | null }[];
  ignoredChanges: number;
  lastIgnoredNumber: string | null;
}

export interface MetaConnectionCreate {
  name: string;
  appId: string;
  appSecret: string;
  accessToken: string;
}

/** A save: a secret is sent only to replace it. */
export interface MetaConnectionUpdate {
  name: string;
  appSecret?: string;
  accessToken?: string;
}

/** One of the WABA's numbers as Meta lists it; `phoneNumberId` is ours when it is already added. */
export interface WabaNumber {
  metaPhoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  nameStatus: string | null;
  qualityRating: string | null;
  platformType: string | null;
  phoneNumberId: string | null;
}

export interface WabaNumbers {
  wabaId: string;
  wabaName: string | null;
  numbers: WabaNumber[];
}

export interface ConnectionCheck {
  connection: MetaConnection;
  accounts: WabaNumbers[];
}

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/meta/connections`;
const id = (v: string) => encodeURIComponent(v);

/** Drops empty secrets, so a blank field keeps the stored one. */
function withoutBlankSecrets<T extends { appSecret?: string; accessToken?: string }>(body: T): T {
  const out = { ...body };
  if (!out.appSecret?.trim()) delete out.appSecret;
  if (!out.accessToken?.trim()) delete out.accessToken;
  return out;
}

export const listMetaConnections = (token: string, ws: string) => apiFetch<MetaConnection[]>(base(ws), { token });

export const getMetaConnection = (token: string, ws: string, connectionId: string) =>
  apiFetch<MetaConnection>(`${base(ws)}/${id(connectionId)}`, { token });

export const createMetaConnection = (token: string, ws: string, body: MetaConnectionCreate) =>
  apiFetch<MetaConnection>(base(ws), { method: 'POST', token, body });

export const updateMetaConnection = (token: string, ws: string, connectionId: string, body: MetaConnectionUpdate) =>
  apiFetch<MetaConnection>(`${base(ws)}/${id(connectionId)}`, {
    method: 'PUT',
    token,
    body: withoutBlankSecrets(body),
  });

/** Checks the token again and lists the WABAs and numbers it may use; `wabaId` looks up one Meta did not list. */
export const checkMetaConnection = (token: string, ws: string, connectionId: string, wabaId?: string) =>
  apiFetch<ConnectionCheck>(`${base(ws)}/${id(connectionId)}/check`, {
    method: 'POST',
    token,
    body: wabaId?.trim() ? { wabaId: wabaId.trim() } : {},
  });

export const retryWebhookSetup = (token: string, ws: string, connectionId: string) =>
  apiFetch<MetaConnection>(`${base(ws)}/${id(connectionId)}/webhook`, { method: 'POST', token });

export const deleteMetaConnection = (token: string, ws: string, connectionId: string) =>
  apiFetch<void>(`${base(ws)}/${id(connectionId)}`, { method: 'DELETE', token });
