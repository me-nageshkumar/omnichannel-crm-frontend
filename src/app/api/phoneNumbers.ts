import { apiFetch } from '@app/api/client';
import type { Disabled } from '@app/api/enablement';

export type PhoneNumberStatus =
  | 'DISABLED'
  | 'NOT_CONNECTED_YET'
  | 'WAITING_FOR_LOGIN'
  | 'CONNECTED'
  | 'WRONG_NUMBER'
  | 'DISCONNECTED';

export const STATUSES: PhoneNumberStatus[] = [
  'CONNECTED',
  'WAITING_FOR_LOGIN',
  'DISCONNECTED',
  'WRONG_NUMBER',
  'NOT_CONNECTED_YET',
  'DISABLED',
];

/** A brand's WhatsApp number as the console shows it; never carries the device key. */
export interface PhoneNumber {
  id: string;
  number: string;
  label: string | null;
  customerId: string;
  customerName: string | null;
  workspaceId: string;
  workspaceName: string | null;
  status: PhoneNumberStatus;
  disabled: Disabled | null;
  disabledBecause: 'NUMBER' | 'BRAND' | 'CUSTOMER' | null;
  lastConnectedAt: string | null;
  lastSeenAt: string | null;
  wrongNumber: string | null;
  wrongNumberAt: string | null;
  hasDevice: boolean;
  creationTime: string;
}

export interface PhoneNumberPage {
  items: PhoneNumber[];
  total: number;
  page: number;
}

export interface ConnectCode {
  code: string;
  expiresAt: string;
}

export const NUMBER_PATTERN = /^[1-9][0-9]{7,14}$/;
export const PLATFORM_PAGE_SIZE = 50;

/** Digits only: "+91 99280-88743" → "919928088743". */
export const normaliseNumber = (input: string): string => input.replace(/[\s+()-]/g, '');

/** "+919928088743". */
export const shown = (number: string): string => `+${number}`;

const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/phone-numbers`;
const toggle = (enabled: boolean) => (enabled ? 'enable' : 'disable');

export const listBrandNumbers = (token: string, workspaceId: string) =>
  apiFetch<PhoneNumber[]>(base(workspaceId), { token });

export const addNumber = (token: string, workspaceId: string, number: string, label: string) =>
  apiFetch<PhoneNumber>(base(workspaceId), {
    method: 'POST',
    token,
    body: { number, label: label.trim() || null },
  });

export const relabelNumber = (token: string, workspaceId: string, id: string, label: string) =>
  apiFetch<PhoneNumber>(`${base(workspaceId)}/${id}`, { method: 'PUT', token, body: { label: label.trim() || null } });

export const deleteNumber = (token: string, workspaceId: string, id: string) =>
  apiFetch<void>(`${base(workspaceId)}/${id}`, { method: 'DELETE', token });

export const setNumberEnabled = (token: string, workspaceId: string, id: string, enabled: boolean) =>
  apiFetch<PhoneNumber>(`${base(workspaceId)}/${id}/${toggle(enabled)}`, { method: 'POST', token });

export const getConnectCode = (token: string, workspaceId: string, id: string) =>
  apiFetch<ConnectCode>(`${base(workspaceId)}/${id}/connect-code`, { method: 'POST', token });

export const revokeDevice = (token: string, workspaceId: string, id: string) =>
  apiFetch<PhoneNumber>(`${base(workspaceId)}/${id}/revoke-device`, { method: 'POST', token });

export function listAllNumbers(
  token: string,
  query: { q?: string; status?: PhoneNumberStatus; page?: number },
): Promise<PhoneNumberPage> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.status) params.set('status', query.status);
  params.set('page', String(query.page ?? 0));
  return apiFetch<PhoneNumberPage>(`/api/phone-numbers?${params.toString()}`, { token });
}

export const setAnyNumberEnabled = (token: string, id: string, enabled: boolean) =>
  apiFetch<PhoneNumber>(`/api/phone-numbers/${id}/${toggle(enabled)}`, { method: 'POST', token });

export const deleteAnyNumber = (token: string, id: string) =>
  apiFetch<void>(`/api/phone-numbers/${id}`, { method: 'DELETE', token });
