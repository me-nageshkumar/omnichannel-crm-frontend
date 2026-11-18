import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkBrandPagesAddress,
  getCustomerPagesAddresses,
  getPlatformPagesAddress,
  savePlatformPagesAddress,
  setBrandPagesAddress,
} from '@app/api/pagesAddresses';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { PAGES_ADDRESSES, PLATFORM_ADDRESS, brandRow } from '../../test/pagesAddresses';

const BRAND = '/api/customers/c1/workspaces/w1/pages-address';

describe('link address api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls each path with the bearer and sends baseUrl and version', async () => {
    const fetch = mockFetch({
      'GET /api/customers/c1/pages-addresses': { status: 200, body: PAGES_ADDRESSES },
      [`PUT ${BRAND}`]: { status: 200, body: brandRow() },
      [`POST ${BRAND}/check`]: { status: 200, body: brandRow() },
      'GET /api/platform/pages-address': { status: 200, body: PLATFORM_ADDRESS },
      'PUT /api/platform/pages-address': { status: 200, body: PLATFORM_ADDRESS },
    });

    expect((await getCustomerPagesAddresses('tok', 'c1')).brands).toHaveLength(2);
    await setBrandPagesAddress('tok', 'c1', 'w1', 'https://links.branda.in', 3);
    await checkBrandPagesAddress('tok', 'c1', 'w1');
    expect((await getPlatformPagesAddress('tok')).source).toBe('STARTUP');
    await savePlatformPagesAddress('tok', 'https://go.example.in', null);

    expect(requestTo(fetch, `PUT ${BRAND}`)?.body).toEqual({ baseUrl: 'https://links.branda.in', version: 3 });
    expect(requestTo(fetch, 'PUT /api/platform/pages-address')?.body).toEqual({
      baseUrl: 'https://go.example.in',
      version: null,
    });
    expect(requestTo(fetch, `POST ${BRAND}/check`)?.headers.get('Authorization')).toBe('Bearer tok');
    expect(requestTo(fetch, 'GET /api/customers/c1/pages-addresses')?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('sends a removal as baseUrl null, not left out', async () => {
    const fetch = mockFetch({
      [`PUT ${BRAND}`]: { status: 200, body: brandRow({ address: null }) },
      'PUT /api/platform/pages-address': { status: 200, body: PLATFORM_ADDRESS },
    });
    await setBrandPagesAddress('tok', 'c1', 'w1', null, 4);
    await savePlatformPagesAddress('tok', null, 2);
    expect(requestTo(fetch, `PUT ${BRAND}`)?.body).toEqual({ baseUrl: null, version: 4 });
    expect(requestTo(fetch, 'PUT /api/platform/pages-address')?.body).toEqual({ baseUrl: null, version: 2 });
  });
});
