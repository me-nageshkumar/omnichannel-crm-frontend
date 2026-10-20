import { apiFetch } from '@app/api/client';
import type { Disabled } from '@app/api/enablement';
import type { RoleRef, TemporaryPassword, UserSummary } from '@app/api/users';

export interface WorkspaceUser extends UserSummary {
  /** Has every brand through a company-wide role (e.g. the Customer Admin). */
  allBrands: boolean;
  /** Whether the caller may manage this login. */
  manageable: boolean;
  /** Set when the person's access to this brand only is switched off. */
  brandDisabled?: Disabled | null;
}

/** The reply to adding someone; {@code temporaryPassword} is null for an existing person. */
export interface Added {
  user: UserSummary;
  temporaryPassword: string | null;
}

const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}`;

export const listWorkspaceUsers = (token: string, workspaceId: string) =>
  apiFetch<WorkspaceUser[]>(`${base(workspaceId)}/users`, { token });

export const workspaceAssignableRoles = (token: string, workspaceId: string) =>
  apiFetch<RoleRef[]>(`${base(workspaceId)}/assignable-roles`, { token });

export const createWorkspaceUser = (
  token: string,
  workspaceId: string,
  body: {
    name: string;
    username: string;
    email: string;
    mobileNumber: string;
    temporaryPassword: string;
    roleId: string;
  },
) => apiFetch<Added>(`${base(workspaceId)}/users`, { method: 'POST', token, body });

export const addExistingUser = (token: string, workspaceId: string, userId: string, roleId: string) =>
  apiFetch<Added>(`${base(workspaceId)}/users`, { method: 'POST', token, body: { userId, roleId } });

export const updateWorkspaceUser = (
  token: string,
  workspaceId: string,
  userId: string,
  /** {@code roleId} null leaves the role in this brand unchanged. */
  body: { name: string; email: string; mobileNumber: string; roleId: string | null },
) => apiFetch<UserSummary>(`${base(workspaceId)}/users/${userId}`, { method: 'PUT', token, body });

export const removeWorkspaceUser = (token: string, workspaceId: string, userId: string) =>
  apiFetch<void>(`${base(workspaceId)}/users/${userId}`, { method: 'DELETE', token });

export const resetWorkspaceUserPassword = (
  token: string,
  workspaceId: string,
  userId: string,
  temporaryPassword: string,
) =>
  apiFetch<TemporaryPassword>(`${base(workspaceId)}/users/${userId}/reset-password`, {
    method: 'POST',
    token,
    body: { temporaryPassword },
  });

export const setCompanyUserEnabled = (token: string, userId: string, enabled: boolean) =>
  apiFetch<UserSummary>(`/api/users/${userId}/${enabled ? 'enable' : 'disable'}`, { method: 'POST', token });

/** Switches one person's access to this brand off or on (`user:enable`); their other brands are not affected. */
export const setBrandAccessEnabled = (token: string, workspaceId: string, userId: string, enabled: boolean) =>
  apiFetch<WorkspaceUser>(`${base(workspaceId)}/users/${userId}/${enabled ? 'enable' : 'disable'}`, {
    method: 'POST',
    token,
  });
