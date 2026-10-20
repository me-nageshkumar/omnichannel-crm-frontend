import { apiFetch } from '@app/api/client';
import type { Disabled } from '@app/api/enablement';

export interface Workspace {
  id: string;
  name: string;
  disabled: Disabled | null;
}

export const listWorkspaces = (token: string) => apiFetch<Workspace[]>('/api/workspaces', { token });

export const createWorkspace = (token: string, name: string) =>
  apiFetch<Workspace>('/api/workspaces', { method: 'POST', token, body: { name } });

export const renameWorkspace = (token: string, id: string, name: string) =>
  apiFetch<Workspace>(`/api/workspaces/${id}`, { method: 'PUT', token, body: { name } });

/** Customer Admin, own brands (COMPANY level). */
export const setWorkspaceEnabled = (token: string, id: string, enabled: boolean) =>
  apiFetch<Workspace>(`/api/workspaces/${id}/${enabled ? 'enable' : 'disable'}`, { method: 'POST', token });
