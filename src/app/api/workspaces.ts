import { apiFetch } from '@app/api/client';

export interface Workspace {
  id: string;
  name: string;
}

export const listWorkspaces = (token: string) => apiFetch<Workspace[]>('/api/workspaces', { token });

export const createWorkspace = (token: string, name: string) =>
  apiFetch<Workspace>('/api/workspaces', { method: 'POST', token, body: { name } });

export const renameWorkspace = (token: string, id: string, name: string) =>
  apiFetch<Workspace>(`/api/workspaces/${id}`, { method: 'PUT', token, body: { name } });
