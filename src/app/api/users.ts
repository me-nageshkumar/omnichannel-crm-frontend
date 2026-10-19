import { apiFetch } from '@app/api/client';

export type UserRole = 'SUPER_ADMIN' | 'APP_ADMIN' | 'ADMIN' | 'USER';

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super admin',
  APP_ADMIN: 'App admin',
  ADMIN: 'Admin',
  USER: 'User',
};

export const roleLabel = (role: UserRole): string => ROLE_LABELS[role] ?? role;

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  mobileNumber: string | null;
  role: UserRole;
  twoFactorEnabled: boolean;
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
