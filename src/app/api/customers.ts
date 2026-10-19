import { apiFetch } from '@app/api/client';
import type { UserSummary, WithTemporaryPassword } from '@app/api/users';

export const CUSTOMER_PAGE_SIZE = 50;

export interface Customer {
  id: string;
  name: string;
  active: boolean;
  creationTime: string;
}

export interface CustomerPage {
  items: Customer[];
  total: number;
  page: number;
}

export interface CustomerDetail {
  customer: Customer;
  workspaces: Array<{ id: string; name: string }>;
  admins: UserSummary[];
}

export interface OwnerInput {
  name: string;
  username: string;
  email: string;
  mobileNumber: string;
  temporaryPassword: string;
}

export interface CustomerQuery {
  q: string;
  /** Undefined lists both. */
  active?: boolean;
  page: number;
}

export function listCustomers(token: string, query: CustomerQuery): Promise<CustomerPage> {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.active !== undefined) params.set('active', String(query.active));
  params.set('page', String(query.page));
  return apiFetch<CustomerPage>(`/api/customers?${params.toString()}`, { token });
}

export const getCustomer = (token: string, id: string) =>
  apiFetch<CustomerDetail>(`/api/customers/${encodeURIComponent(id)}`, { token });

export const createCustomer = (
  token: string,
  body: { name: string; workspaceName: string | null; admin: OwnerInput },
) =>
  apiFetch<{ customer: Customer; user: UserSummary; temporaryPassword: string }>('/api/customers', {
    method: 'POST',
    token,
    body,
  });

export const renameCustomer = (token: string, id: string, name: string) =>
  apiFetch<Customer>(`/api/customers/${id}`, { method: 'PUT', token, body: { name } });

export const setCustomerActive = (token: string, id: string, active: boolean) =>
  apiFetch<Customer>(`/api/customers/${id}/${active ? 'reactivate' : 'deactivate'}`, { method: 'POST', token });

export const addOwner = (token: string, id: string, body: OwnerInput) =>
  apiFetch<WithTemporaryPassword>(`/api/customers/${id}/admins`, { method: 'POST', token, body });

export const resetOwnerPassword = (token: string, id: string, userId: string, temporaryPassword: string) =>
  apiFetch<WithTemporaryPassword>(`/api/customers/${id}/admins/${userId}/reset-password`, {
    method: 'POST',
    token,
    body: { temporaryPassword },
  });

export const setOwnerActive = (token: string, id: string, userId: string, active: boolean) =>
  apiFetch<UserSummary>(`/api/customers/${id}/admins/${userId}/${active ? 'reactivate' : 'deactivate'}`, {
    method: 'POST',
    token,
  });
