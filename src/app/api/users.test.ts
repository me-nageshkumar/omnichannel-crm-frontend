import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, setAvailability } from '@app/api/users';
import { mockFetch, requestTo } from '../../test/fetchMock';

afterEach(() => vi.unstubAllGlobals());

describe('users api', () => {
  it('setAvailability puts the status and returns the refreshed user', async () => {
    const fetch = mockFetch({
      'PUT /api/users/me/availability': {
        status: 200,
        body: { id: 'u1', availability: { status: 'AWAY', at: '2026-10-23T10:00:00Z' } },
      },
    });
    const user = await setAvailability('tok', 'AWAY');
    expect(user.availability.status).toBe('AWAY');
    const req = requestTo(fetch, 'PUT /api/users/me/availability');
    expect(req?.body).toEqual({ status: 'AWAY' });
    expect(req?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('getCurrentUser reads the availability field', async () => {
    mockFetch({
      'GET /api/users/me': { status: 200, body: { id: 'u1', availability: { status: 'AVAILABLE', at: null } } },
    });
    const user = await getCurrentUser('tok');
    expect(user.availability).toEqual({ status: 'AVAILABLE', at: null });
  });
});
