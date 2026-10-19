import { apiFetch } from '@app/api/client';
import type { RoleRef, UserSummary, WithTemporaryPassword } from '@app/api/users';

const BASE = '/api/platform-users';

export interface PlatformUserInput {
  name: string;
  username: string;
  email: string;
  mobileNumber: string;
  roleId: string;
  temporaryPassword: string;
}

export type PlatformUserUpdate = Omit<PlatformUserInput, 'username' | 'temporaryPassword'>;

export const listPlatformUsers = (token: string) => apiFetch<UserSummary[]>(BASE, { token });

export const platformAssignableRoles = (token: string) => apiFetch<RoleRef[]>(`${BASE}/assignable-roles`, { token });

export const createPlatformUser = (token: string, body: PlatformUserInput) =>
  apiFetch<WithTemporaryPassword>(BASE, { method: 'POST', token, body });

export const updatePlatformUser = (token: string, id: string, body: PlatformUserUpdate) =>
  apiFetch<UserSummary>(`${BASE}/${id}`, { method: 'PUT', token, body });

export const resetPlatformUserPassword = (token: string, id: string, temporaryPassword: string) =>
  apiFetch<WithTemporaryPassword>(`${BASE}/${id}/reset-password`, {
    method: 'POST',
    token,
    body: { temporaryPassword },
  });

export const deactivatePlatformUser = (token: string, id: string) =>
  apiFetch<UserSummary>(`${BASE}/${id}/deactivate`, { method: 'POST', token });

export const reactivatePlatformUser = (token: string, id: string) =>
  apiFetch<UserSummary>(`${BASE}/${id}/reactivate`, { method: 'POST', token });
