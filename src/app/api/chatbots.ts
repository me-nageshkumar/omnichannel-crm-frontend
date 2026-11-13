import { apiFetch, apiFetchFile } from '@app/api/client';
import type { CloudMessage } from '@app/api/cloudMessages';
import type { AutomationOptions } from '@app/api/automations';

export type { CloudMessage };

type Ref = { id: string; name: string | null };

export type NodeType =
  | 'send_message'
  | 'send_template'
  | 'ask_question'
  | 'ask_form'
  | 'condition'
  | 'update_contact'
  | 'do_not_contact'
  | 'assign_chat'
  | 'add_to_crm'
  | 'http_request'
  | 'wait'
  | 'jump';

export type ChatbotStatus = 'DRAFT' | 'PUBLISHED';

export interface SavedNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: { name: string; settings: Record<string, unknown> };
}

export interface SavedEdge {
  id: string;
  source: string;
  sourceHandle: string | null;
  target: string;
}

export interface SavedFlow {
  nodes: SavedNode[];
  edges: SavedEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface ChatbotSettings {
  reminderAfterMinutes: number | null;
  reminderMessage: string | null;
  endAfterMinutes: number;
  endMessage: string | null;
  invalidReplyRetries: number;
  retryMessage: string;
  giveUpMessage: string | null;
  stopOnAgentReply: boolean;
}

export interface Chatbot {
  id: string;
  name: string;
  description: string | null;
  status: ChatbotStatus;
  flow: SavedFlow;
  settings: ChatbotSettings;
  versionNumber: number;
  version: number;
  createdBy: Ref | null;
  creationTime: string;
  lastUpdateTime: string;
  publishedAt: string | null;
  publishedBy: Ref | null;
}

export interface ChatbotSummary {
  id: string;
  name: string;
  status: ChatbotStatus;
  runs7d: number;
  activeNow: number;
  lastRunAt: string | null;
  lastUpdateTime: string;
}

export type Severity = 'ERROR' | 'WARNING';

export interface Problem {
  nodeId: string | null;
  nodeName: string | null;
  field: string;
  message: string;
  severity: Severity;
}

export interface SaveRequest {
  name?: string;
  description?: string | null;
  flow: SavedFlow;
  settings?: ChatbotSettings;
  version: number;
}

export interface SaveResult {
  chatbot: Chatbot;
  problems: Problem[];
}

export interface VersionView {
  versionNumber: number;
  savedAt: string;
  savedBy: Ref | null;
}

export type RunStatus = 'RUNNING' | 'WAITING' | 'COMPLETED' | 'ENDED' | 'STOPPED' | 'HANDED_OVER' | 'JUMPED' | 'FAILED';
export type TaskKind = 'WHATSAPP_REPLY' | 'FORM' | 'TIMER';

export interface Waiting {
  kind: TaskKind;
  key: string | null;
  since: string | null;
  expiresAt: string | null;
  prompt: string | null;
}

export interface RunStep {
  index: number;
  nodeId: string;
  nodeName: string | null;
  type: string;
  startedAt: string | null;
  finishedAt: string | null;
  outcome: 'DONE' | 'WAITING' | 'FAILED';
  output: string | null;
  summary: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  waitedFor: Waiting | null;
}

export interface StartedBy {
  ruleId: string | null;
  ruleName: string | null;
  eventId: string | null;
  userId: string | null;
}

export interface Run {
  id: string;
  chatbotId: string;
  chatbotName: string;
  versionNumber: number;
  chat: { id: string; remoteId: string | null } | null;
  contact: { id: string; name: string | null; phone: string | null } | null;
  number: { id: string; label: string | null } | null;
  status: RunStatus;
  currentNodeId: string | null;
  currentNodeName: string | null;
  waiting: Waiting | null;
  test: boolean;
  startedBy: StartedBy | null;
  steps: RunStep[];
  variables: Record<string, unknown>;
  endReason: string | null;
  stoppedBy: Ref | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface RunPage {
  items: Run[];
  total: number;
}

export interface AttributeOption {
  id: string;
  name: string;
  key: string;
}

export interface ChatbotRef {
  id: string;
  name: string;
  status: ChatbotStatus;
}

export type ChatbotOptions = Omit<AutomationOptions, 'chatbots'> & {
  attributes: AttributeOption[];
  labels: { id: string; name: string }[];
  chatbots: ChatbotRef[];
};

export interface TestStartRequest {
  contactId: string;
  phoneNumberId?: string;
  stopRunning?: boolean;
}

export interface RunsQuery {
  status?: RunStatus;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export type ChatbotMediaType = 'image' | 'video' | 'audio' | 'document';

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/chatbots`;
const one = (ws: string, id: string) => `${base(ws)}/${encodeURIComponent(id)}`;

const withQuery = (path: string, q: Record<string, string | number | undefined>) => {
  const parts: string[] = [];
  Object.keys(q).forEach((k) => {
    const v = q[k];
    if (v !== undefined && v !== null && v !== '')
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  });
  return parts.length ? `${path}?${parts.join('&')}` : path;
};

export const getChatbotOptions = (token: string, ws: string) =>
  apiFetch<ChatbotOptions>(`${base(ws)}/options`, { token });
export const listChatbots = (token: string, ws: string) => apiFetch<ChatbotSummary[]>(base(ws), { token });
export const createChatbot = (token: string, ws: string, name: string) =>
  apiFetch<Chatbot>(base(ws), { token, method: 'POST', body: { name } });
export const getChatbot = (token: string, ws: string, id: string) => apiFetch<Chatbot>(one(ws, id), { token });
export const saveChatbot = (token: string, ws: string, id: string, body: SaveRequest) =>
  apiFetch<SaveResult>(one(ws, id), { token, method: 'PUT', body });
export const publishChatbot = (token: string, ws: string, id: string) =>
  apiFetch<Chatbot>(`${one(ws, id)}/publish`, { token, method: 'POST' });
export const unpublishChatbot = (token: string, ws: string, id: string) =>
  apiFetch<Chatbot>(`${one(ws, id)}/unpublish`, { token, method: 'POST' });
export const deleteChatbot = (token: string, ws: string, id: string) =>
  apiFetch<void>(one(ws, id), { token, method: 'DELETE' });
export const listVersions = (token: string, ws: string, id: string) =>
  apiFetch<VersionView[]>(`${one(ws, id)}/versions`, { token });
export const getVersionFlow = (token: string, ws: string, id: string, n: number) =>
  apiFetch<SavedFlow>(`${one(ws, id)}/versions/${n}`, { token });
export const restoreVersion = (token: string, ws: string, id: string, n: number) =>
  apiFetch<SaveResult>(`${one(ws, id)}/versions/${n}/restore`, { token, method: 'POST' });
export const startChatbotTest = (token: string, ws: string, id: string, body: TestStartRequest) =>
  apiFetch<Run>(`${one(ws, id)}/test`, { token, method: 'POST', body });
export const listRuns = (token: string, ws: string, id: string, q: RunsQuery = {}) =>
  apiFetch<RunPage>(
    withQuery(`${one(ws, id)}/runs`, { status: q.status, from: q.from, to: q.to, page: q.page, size: q.size }),
    {
      token,
    },
  );
export const getRun = (token: string, ws: string, id: string, runId: string) =>
  apiFetch<Run>(`${one(ws, id)}/runs/${encodeURIComponent(runId)}`, { token });
export const stopRun = (token: string, ws: string, id: string, runId: string) =>
  apiFetch<void>(`${one(ws, id)}/runs/${encodeURIComponent(runId)}/stop`, { token, method: 'POST' });

/** Uploads a file for a Send message node (multipart `file` + `type`); answers its media id. */
export async function uploadChatbotMedia(
  token: string,
  ws: string,
  id: string,
  type: ChatbotMediaType,
  file: File,
): Promise<{ id: string }> {
  const body = new FormData();
  body.append('file', file);
  body.append('type', type);
  const res = await apiFetchFile(`${one(ws, id)}/media`, { token, body });
  return (await res.json()) as { id: string };
}

/** The inert preview of a Send message node's message, as HTML text. */
export async function previewChatbotMessage(
  token: string,
  ws: string,
  id: string,
  message: CloudMessage,
): Promise<string> {
  const res = await apiFetchFile(`${one(ws, id)}/preview`, { token, body: message, json: true });
  return res.text();
}
