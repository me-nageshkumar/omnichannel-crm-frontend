import { apiFetch } from '@app/api/client';
import type { RoleLevel } from '@app/api/roles';

export type AuthorityStatus = 'ACTIVE' | 'NOT_CHECKED' | 'WRONG_LEVEL';

export interface Authority {
  code: string;
  group: string;
  level: RoleLevel;
  description: string;
  builtIn: boolean;
  status: AuthorityStatus;
  /** Where code checks it, e.g. "CustomerController.list". */
  checkedIn: string[];
  /** Names of the roles that hold it. */
  roles: string[];
  updatedAt: string | null;
  updatedBy: string | null;
}

/** A code checked in code that has not been created yet. */
export interface NeedsCreating {
  code: string;
  suggestedLevel: RoleLevel | null;
  suggestedGroup: string;
  checkedIn: string[];
}

export interface AuthorityChange {
  code: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  groupBefore: string | null;
  groupAfter: string | null;
  levelBefore: RoleLevel | null;
  levelAfter: RoleLevel | null;
  descriptionBefore: string | null;
  descriptionAfter: string | null;
  changedBy: string;
  at: string;
}

export interface AuthorityInput {
  group: string;
  level: RoleLevel;
  description: string;
}

export const CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*:[a-z0-9]+(-[a-z0-9]+)*$/;
export const GROUP_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_CODE = 64;
const MAX_GROUP = 40;
const MAX_DESCRIPTION = 200;

/** The part of a code before the colon, its default group. */
export function groupOf(code: string): string {
  const i = code.indexOf(':');
  return i < 0 ? code : code.slice(0, i);
}

/** Field → message for every invalid field; the code is checked only when given (create). */
export function validateAuthority(input: { code?: string } & AuthorityInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.code !== undefined && (!CODE_PATTERN.test(input.code) || input.code.length > MAX_CODE)) {
    errors.code = 'Use thing:action in lowercase letters, digits and single hyphens, up to 64 characters.';
  }
  if (!GROUP_PATTERN.test(input.group) || input.group.length > MAX_GROUP) {
    errors.group = 'Use lowercase letters, digits and single hyphens, up to 40 characters.';
  }
  const description = input.description.trim();
  if (description.length === 0 || description.length > MAX_DESCRIPTION) {
    errors.description = 'Enter a description of up to 200 characters.';
  }
  return errors;
}

const path = (code: string) => `/api/authorities/${encodeURIComponent(code)}`;

export const listAuthorities = (token: string) => apiFetch<Authority[]>('/api/authorities', { token });

export const listNeedsCreating = (token: string) =>
  apiFetch<NeedsCreating[]>('/api/authorities/needs-creating', { token });

export const createAuthority = (token: string, body: { code: string } & AuthorityInput) =>
  apiFetch<Authority>('/api/authorities', { method: 'POST', token, body });

export const updateAuthority = (token: string, code: string, body: AuthorityInput) =>
  apiFetch<Authority>(path(code), { method: 'PUT', token, body });

export const deleteAuthority = (token: string, code: string) => apiFetch<void>(path(code), { method: 'DELETE', token });

export const authorityHistory = (token: string, code: string) =>
  apiFetch<AuthorityChange[]>(`${path(code)}/history`, { token });
