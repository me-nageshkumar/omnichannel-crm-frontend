import { apiFetch } from '@app/api/client';

/** Link addresses (spec 2026-11-18): a brand's own domain on its message and form links, set by the super admin. */
export type PagesAddressStatus = 'UNCHECKED' | 'WORKING' | 'FAILING';

export interface PagesAddressView {
  baseUrl: string;
  status: PagesAddressStatus;
  checkedAt: string | null;
  lastError: string | null;
  /** The brand's links use this address now. */
  inUse: boolean;
}

/** A host the brand stopped using; links already sent under it must keep opening until `until`. */
export interface FormerHost {
  host: string;
  until: string;
}

export interface BrandPagesAddress {
  workspaceId: string;
  workspaceName: string;
  address: PagesAddressView | null;
  formerHosts: FormerHost[];
  version: number | null;
}

export interface CustomerPagesAddresses {
  platformBaseUrl: string;
  brands: BrandPagesAddress[];
}

export interface PlatformPagesAddress {
  baseUrl: string;
  /** SAVED: set on the platform page; STARTUP: from the startup settings. */
  source: 'SAVED' | 'STARTUP';
  startupBaseUrl: string;
  version: number | null;
  /** The save's failed check, else null. */
  warning: string | null;
}

const brandPath = (customerId: string, workspaceId: string) =>
  `/api/customers/${encodeURIComponent(customerId)}/workspaces/${encodeURIComponent(workspaceId)}/pages-address`;

export const getCustomerPagesAddresses = (token: string, customerId: string) =>
  apiFetch<CustomerPagesAddresses>(`/api/customers/${encodeURIComponent(customerId)}/pages-addresses`, { token });

/** `baseUrl` null removes the brand's address. */
export const setBrandPagesAddress = (
  token: string,
  customerId: string,
  workspaceId: string,
  baseUrl: string | null,
  version: number | null,
) =>
  apiFetch<BrandPagesAddress>(brandPath(customerId, workspaceId), {
    method: 'PUT',
    token,
    body: { baseUrl, version },
  });

export const checkBrandPagesAddress = (token: string, customerId: string, workspaceId: string) =>
  apiFetch<BrandPagesAddress>(`${brandPath(customerId, workspaceId)}/check`, { method: 'POST', token });

export const getPlatformPagesAddress = (token: string) =>
  apiFetch<PlatformPagesAddress>('/api/platform/pages-address', { token });

/** `baseUrl` null goes back to the startup setting. */
export const savePlatformPagesAddress = (token: string, baseUrl: string | null, version: number | null) =>
  apiFetch<PlatformPagesAddress>('/api/platform/pages-address', {
    method: 'PUT',
    token,
    body: { baseUrl, version },
  });
