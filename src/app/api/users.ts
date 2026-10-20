import type { Disabled } from '@app/api/enablement';
import { apiFetch } from '@app/api/client';

/** "WORKSPACE_MANAGER" → "Workspace manager". */
export const roleLabel = (name: string): string => {
  const words = name.toLowerCase().split('_');
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export interface RoleRef {
  id: string;
  name: string;
}

export interface CustomerRef {
  id: string;
  name: string;
}

export interface WorkspaceAccess {
  id: string;
  name: string;
  /** Null when access comes from the user's company-wide role. */
  role: RoleRef | null;
  authorities: string[];
}

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  mobileNumber: string | null;
  twoFactorEnabled: boolean;
  superAdmin: boolean;
  customer: CustomerRef | null;
  role: RoleRef | null;
  authorities: string[];
  workspaces: WorkspaceAccess[];
  mustChangePassword: boolean;
}

/** The role to show for {@code user}: their own role, else their role in {@code workspace}. */
export function userRoleLabel(user: CurrentUser, workspace: WorkspaceAccess | null): string | null {
  const role = user.role ?? workspace?.role ?? null;
  return role ? roleLabel(role.name) : null;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeDataUri: string;
  issuer: string;
  username: string;
}

export function getCurrentUser(token: string): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/api/users/me', { token });
}

export function initiateTwoFactor(token: string): Promise<TwoFactorSetup> {
  return apiFetch<TwoFactorSetup>('/api/users/me/two-factor/initiate', { method: 'POST', token });
}

export function confirmTwoFactor(token: string, secret: string, otp: string): Promise<void> {
  return apiFetch<void>('/api/users/me/two-factor/confirm', { method: 'POST', token, body: { secret, otp } });
}

export function disableTwoFactor(token: string, otp: string): Promise<void> {
  return apiFetch<void>('/api/users/me/two-factor/disable', { method: 'POST', token, body: { otp } });
}

/** A user as management pages see them; never carries secrets. */
export interface UserSummary {
  id: string;
  name: string;
  username: string;
  email: string | null;
  mobileNumber: string | null;
  active: boolean;
  disabled: Disabled | null;
  role: RoleRef | null;
  workspaceRoles: Array<{ workspaceId: string; workspaceName: string; role: RoleRef }>;
  mustChangePassword: boolean;
}

/** The reply to resetting a password: the password only. */
export interface TemporaryPassword {
  temporaryPassword: string;
}

/** The reply to creating a user. */
export interface WithTemporaryPassword {
  user: UserSummary;
  temporaryPassword: string;
}
