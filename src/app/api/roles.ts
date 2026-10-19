import { apiFetch } from '@app/api/client';

export type RoleLevel = 'PLATFORM' | 'COMPANY' | 'BRAND';

export const ROLE_LEVELS: RoleLevel[] = ['PLATFORM', 'COMPANY', 'BRAND'];

export const LEVEL_LABELS: Record<RoleLevel, string> = { PLATFORM: 'Platform', COMPANY: 'Company', BRAND: 'Brand' };

/** The authority levels a role of {@code level} may hold. */
export function levelsHeldBy(level: RoleLevel): RoleLevel[] {
  if (level === 'PLATFORM') return ['PLATFORM'];
  if (level === 'COMPANY') return ['COMPANY', 'BRAND'];
  return ['BRAND'];
}

export interface Authority {
  code: string;
  level: RoleLevel;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  level: RoleLevel;
  authorities: string[];
  builtIn: boolean;
  userCount: number;
}

export interface RoleChangePreview {
  assigner: string;
  assigned: string;
  nowAssignable: boolean;
}

export interface RoleChange {
  roleId: string;
  roleName: string;
  changedBy: string;
  at: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  added: string[];
  removed: string[];
  descriptionBefore: string | null;
  descriptionAfter: string | null;
}

export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export const listAuthorities = (token: string) => apiFetch<Authority[]>('/api/authorities', { token });

export const listRoles = (token: string) => apiFetch<Role[]>('/api/roles', { token });

export const createRole = (
  token: string,
  body: { name: string; description: string; level: RoleLevel; authorities: string[] },
) => apiFetch<Role>('/api/roles', { method: 'POST', token, body });

export const updateRole = (
  token: string,
  id: string,
  body: { name: string; description: string; authorities: string[] },
) => apiFetch<Role>(`/api/roles/${id}`, { method: 'PUT', token, body });

export const deleteRole = (token: string, id: string) =>
  apiFetch<void>(`/api/roles/${id}`, { method: 'DELETE', token });

export const previewRole = (token: string, id: string, authorities: string[]) =>
  apiFetch<{ changes: RoleChangePreview[] }>(`/api/roles/${id}/preview`, {
    method: 'POST',
    token,
    body: { authorities },
  });

export const roleChanges = (token: string, id: string) => apiFetch<RoleChange[]>(`/api/roles/${id}/changes`, { token });
