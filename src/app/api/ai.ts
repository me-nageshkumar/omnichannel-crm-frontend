import { apiFetch } from '@app/api/client';

/** What a provider can do; the AI page and the AI node show only the fields a provider supports. */
export interface AiCapabilities {
  state: 'CHAINED' | 'TRANSCRIPT';
  hostedMcp: boolean;
  vectorStores: boolean;
  functionTools: boolean;
  structuredOutput: boolean;
  /** The effort values the provider accepts, weakest first; empty when it takes none. */
  reasoningEfforts: string[];
  temperature: boolean;
  webSearch: boolean;
}

/** A plain (never secret) setting a provider's connections take beside the API key. */
export interface AiConnectionField {
  key: string;
  label: string;
  help: string | null;
  kind: 'TEXT' | 'URL';
  required: boolean;
}

export interface AiProvider {
  id: string;
  label: string;
  capabilities: AiCapabilities;
  connectionFields: AiConnectionField[];
}

export type AiConnectionStatus = 'UNVERIFIED' | 'OK' | 'INVALID';

/** A brand's connection to a provider. The key is write-only: the view carries only its hint. */
export interface AiConnection {
  id: string;
  name: string;
  provider: string;
  keyHint: string | null;
  keySetAt: string | null;
  status: AiConnectionStatus;
  checkedAt: string | null;
  lastError: string | null;
  /** The provider's plain settings; readable, unlike the key. */
  settings: Record<string, string>;
  version: number | null;
}

/** `apiKey` sets or replaces the key; leave it out to keep the stored one. `settings` are always sent: `{}` clears the stored ones. */
export interface AiConnectionSave {
  name: string;
  provider: string;
  apiKey?: string;
  settings: Record<string, string>;
  version?: number | null;
}

export interface AiModel {
  id: string;
}

export interface AiVectorStore {
  id: string;
  name: string | null;
  fileCount: number;
}

export type McpConnectBy = 'PROVIDER' | 'APP';
export type McpAuth = 'NONE' | 'BEARER' | 'HEADER';

export interface McpServer {
  id: string;
  label: string;
  url: string;
  connectBy: McpConnectBy;
  auth: McpAuth;
  headerName: string | null;
  secretHint: string | null;
  secretSetAt: string | null;
  allowedTools: string[];
}

/** `id` absent: a new server. `secret` sets or replaces the stored one; leave it out to keep it. */
export interface McpServerSave {
  id?: string;
  label: string;
  url: string;
  connectBy: McpConnectBy;
  auth: McpAuth;
  headerName: string | null;
  secret?: string;
  allowedTools: string[];
}

export interface AiProfile {
  id: string;
  name: string;
  connectionId: string;
  provider: string | null;
  model: string;
  instructions: string | null;
  reasoningEffort: string | null;
  maxOutputTokens: number | null;
  temperature: number | null;
  webSearch: boolean;
  vectorStoreIds: string[];
  mcpServers: McpServer[];
  updatedAt: string | null;
  version: number | null;
}

export interface AiProfileSave {
  name: string;
  connectionId: string;
  model: string;
  instructions: string | null;
  reasoningEffort: string | null;
  maxOutputTokens: number | null;
  temperature: number | null;
  webSearch: boolean;
  vectorStoreIds: string[];
  mcpServers: McpServerSave[];
  version?: number | null;
}

/** A profile as the chatbot editor sees it, from the chatbot options (no `ai:view` needed). */
export interface AiProfileRef {
  id: string;
  name: string;
  provider: string;
}

export interface McpToolInfo {
  name: string;
  description: string | null;
}

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/ai`;
const id = (v: string) => encodeURIComponent(v);

export const listAiProviders = (token: string, ws: string) =>
  apiFetch<AiProvider[]>(`${base(ws)}/providers`, { token });

export const listAiConnections = (token: string, ws: string) =>
  apiFetch<AiConnection[]>(`${base(ws)}/connections`, { token });

export const getAiConnection = (token: string, ws: string, connectionId: string) =>
  apiFetch<AiConnection>(`${base(ws)}/connections/${id(connectionId)}`, { token });

export const createAiConnection = (token: string, ws: string, save: AiConnectionSave) =>
  apiFetch<AiConnection>(`${base(ws)}/connections`, { method: 'POST', body: withoutEmpty(save), token });

export const saveAiConnection = (token: string, ws: string, connectionId: string, save: AiConnectionSave) =>
  apiFetch<AiConnection>(`${base(ws)}/connections/${id(connectionId)}`, {
    method: 'PUT',
    body: withoutEmpty(save),
    token,
  });

export const deleteAiConnection = (token: string, ws: string, connectionId: string) =>
  apiFetch<void>(`${base(ws)}/connections/${id(connectionId)}`, { method: 'DELETE', token });

export const verifyAiConnection = (token: string, ws: string, connectionId: string) =>
  apiFetch<AiConnection>(`${base(ws)}/connections/${id(connectionId)}/verify`, { method: 'POST', token });

export const listAiModels = (token: string, ws: string, connectionId: string) =>
  apiFetch<AiModel[]>(`${base(ws)}/connections/${id(connectionId)}/models`, { token });

export const listAiVectorStores = (token: string, ws: string, connectionId: string) =>
  apiFetch<AiVectorStore[]>(`${base(ws)}/connections/${id(connectionId)}/vector-stores`, { token });

export const listAiProfiles = (token: string, ws: string) => apiFetch<AiProfile[]>(`${base(ws)}/profiles`, { token });

export const getAiProfile = (token: string, ws: string, profileId: string) =>
  apiFetch<AiProfile>(`${base(ws)}/profiles/${id(profileId)}`, { token });

export const createAiProfile = (token: string, ws: string, save: AiProfileSave) =>
  apiFetch<AiProfile>(`${base(ws)}/profiles`, { method: 'POST', body: profileBody(save), token });

export const saveAiProfile = (token: string, ws: string, profileId: string, save: AiProfileSave) =>
  apiFetch<AiProfile>(`${base(ws)}/profiles/${id(profileId)}`, { method: 'PUT', body: profileBody(save), token });

export const deleteAiProfile = (token: string, ws: string, profileId: string) =>
  apiFetch<void>(`${base(ws)}/profiles/${id(profileId)}`, { method: 'DELETE', token });

export const listMcpTools = (token: string, ws: string, profileId: string, serverId: string) =>
  apiFetch<McpToolInfo[]>(`${base(ws)}/profiles/${id(profileId)}/mcp/${id(serverId)}/tools`, {
    method: 'POST',
    token,
  });

/** A blank or absent key keeps the stored one, so it is never sent as `""`. */
function withoutEmpty(save: AiConnectionSave): Record<string, unknown> {
  const { apiKey, ...rest } = save;
  return apiKey && apiKey.trim() !== '' ? { ...rest, apiKey } : rest;
}

function profileBody(save: AiProfileSave): Record<string, unknown> {
  return {
    ...save,
    mcpServers: save.mcpServers.map(({ secret, ...m }) => (secret && secret.trim() !== '' ? { ...m, secret } : m)),
  };
}
