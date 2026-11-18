import { apiFetch, apiFetchBlob, apiFetchFile, apiFetchText } from '@app/api/client';

/** Spec 2026-11-18 §6: a brand's knowledge bases (OpenAI vector stores managed by the app) and their sources. */
export type KnowledgeSourceState = 'QUEUED' | 'UPLOADING' | 'INDEXING' | 'READY' | 'FAILED' | 'REMOVING';
export type KnowledgeSourceKind = 'FILE' | 'WEB_PAGE' | 'NOTE';

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  connectionId: string;
  connectionName: string | null;
  provider: string;
  providerStoreId: string;
  status: 'READY' | 'FAILED';
  error: string | null;
  /** REMOVING sources are counted nowhere; "adding" is UPLOADING + INDEXING. */
  counts: { queued: number; adding: number; ready: number; failed: number };
  sourceCount: number;
  usedBy: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface KnowledgeSource {
  id: string;
  kind: KnowledgeSourceKind;
  title: string;
  url: string | null;
  fileName: string | null;
  contentType: string | null;
  size: number | null;
  state: KnowledgeSourceState;
  error: string | null;
  addedAt: string;
  addedBy: string | null;
  fetchedAt: string | null;
  version: number;
}

export interface KnowledgeBaseCreate {
  name: string;
  description: string | null;
  connectionId: string;
}

export interface KnowledgeBaseSave {
  name: string;
  description: string | null;
  version: number;
}

export interface KnowledgeSourceChange {
  title?: string;
  text?: string;
  action?: 'FETCH_AGAIN' | 'RETRY';
}

/** Queued, uploading or being indexed: the console shows all three as "Adding". */
export const isAdding = (s: KnowledgeSourceState) => s === 'QUEUED' || s === 'UPLOADING' || s === 'INDEXING';

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/ai/knowledge-bases`;
const id = (v: string) => encodeURIComponent(v);
const sources = (ws: string, kbId: string) => `${base(ws)}/${id(kbId)}/sources`;

export const listKnowledgeBases = (token: string, ws: string) => apiFetch<KnowledgeBase[]>(base(ws), { token });

export const getKnowledgeBase = (token: string, ws: string, kbId: string) =>
  apiFetch<KnowledgeBase>(`${base(ws)}/${id(kbId)}`, { token });

export const createKnowledgeBase = (token: string, ws: string, body: KnowledgeBaseCreate) =>
  apiFetch<KnowledgeBase>(base(ws), { method: 'POST', body, token });

export const saveKnowledgeBase = (token: string, ws: string, kbId: string, body: KnowledgeBaseSave) =>
  apiFetch<KnowledgeBase>(`${base(ws)}/${id(kbId)}`, { method: 'PUT', body, token });

export const deleteKnowledgeBase = (token: string, ws: string, kbId: string) =>
  apiFetch<void>(`${base(ws)}/${id(kbId)}`, { method: 'DELETE', token });

export const listKnowledgeSources = (token: string, ws: string, kbId: string) =>
  apiFetch<KnowledgeSource[]>(sources(ws, kbId), { token });

export async function addKnowledgeFile(token: string, ws: string, kbId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetchFile(`${sources(ws, kbId)}/file`, { token, body: form });
  return (await res.json()) as KnowledgeSource;
}

export const addKnowledgeWebPage = (token: string, ws: string, kbId: string, url: string) =>
  apiFetch<KnowledgeSource>(`${sources(ws, kbId)}/web-page`, { method: 'POST', body: { url }, token });

export const addKnowledgeNote = (token: string, ws: string, kbId: string, title: string, text: string) =>
  apiFetch<KnowledgeSource>(`${sources(ws, kbId)}/note`, { method: 'POST', body: { title, text }, token });

export const updateKnowledgeSource = (
  token: string,
  ws: string,
  kbId: string,
  sourceId: string,
  body: KnowledgeSourceChange,
) => apiFetch<KnowledgeSource>(`${sources(ws, kbId)}/${id(sourceId)}`, { method: 'PUT', body, token });

export const removeKnowledgeSource = (token: string, ws: string, kbId: string, sourceId: string) =>
  apiFetch<KnowledgeSource>(`${sources(ws, kbId)}/${id(sourceId)}`, { method: 'DELETE', token });

/** Our stored copy of a source (a file's bytes, or a web page's or note's Markdown). */
export const downloadKnowledgeSource = (token: string, ws: string, kbId: string, sourceId: string) =>
  apiFetchBlob(`${sources(ws, kbId)}/${id(sourceId)}/content`, token);

export const knowledgeSourceText = (token: string, ws: string, kbId: string, sourceId: string) =>
  apiFetchText(`${sources(ws, kbId)}/${id(sourceId)}/content`, token);
