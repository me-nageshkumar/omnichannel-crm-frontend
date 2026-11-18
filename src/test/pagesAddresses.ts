import type { BrandPagesAddress, CustomerPagesAddresses, PlatformPagesAddress } from '@app/api/pagesAddresses';

export const PLATFORM_BASE = 'https://go.example.in';

/** Brand A with a working address. */
export function brandRow(over: Partial<BrandPagesAddress> = {}): BrandPagesAddress {
  return {
    workspaceId: 'w1',
    workspaceName: 'Brand A',
    address: {
      baseUrl: 'https://links.branda.in',
      status: 'WORKING',
      checkedAt: '2026-11-18T04:15:00Z',
      lastError: null,
      inUse: true,
    },
    formerHosts: [],
    version: 3,
    ...over,
  };
}

/** Brand B without an address, with one earlier host still known. */
export const BRAND_B: BrandPagesAddress = {
  workspaceId: 'w2',
  workspaceName: 'Brand B',
  address: null,
  formerHosts: [{ host: 'old.brandb.in', until: '2027-02-01T00:00:00Z' }],
  version: 5,
};

export const PAGES_ADDRESSES: CustomerPagesAddresses = {
  platformBaseUrl: PLATFORM_BASE,
  brands: [brandRow(), BRAND_B],
  keepDays: 90,
};

export const PLATFORM_ADDRESS: PlatformPagesAddress = {
  baseUrl: PLATFORM_BASE,
  source: 'STARTUP',
  startupBaseUrl: PLATFORM_BASE,
  version: null,
  warning: null,
};
