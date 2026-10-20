import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupOf, updateAuthority, validateAuthority } from '@app/api/authorities';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { mockFetch, requestTo } from '../../test/fetchMock';

const VALID = { code: 'a:b', group: 'a', level: 'PLATFORM' as const, description: 'Does a' };

describe('authorities api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('editSendsEncodedCode', async () => {
    const fetch = mockFetch({ 'PUT /api/authorities/customer%3Aview': { status: 200, body: {} } });
    await updateAuthority('t', 'customer:view', { group: 'customer', level: 'PLATFORM', description: 'See' });
    expect(requestTo(fetch, 'PUT /api/authorities/customer%3Aview')?.body).toEqual({
      group: 'customer',
      level: 'PLATFORM',
      description: 'See',
    });
  });

  it('validates code, group and description', () => {
    expect(validateAuthority(VALID)).toEqual({});
    expect(validateAuthority({ ...VALID, code: 'Customer:View' })).toHaveProperty('code');
    expect(validateAuthority({ ...VALID, code: `${'a'.repeat(32)}:${'b'.repeat(32)}` })).toHaveProperty('code');
    expect(validateAuthority({ ...VALID, group: 'cust omer' })).toHaveProperty('group');
    expect(validateAuthority({ ...VALID, group: 'g'.repeat(41) })).toHaveProperty('group');
    expect(validateAuthority({ ...VALID, description: '  ' })).toHaveProperty('description');
    expect(validateAuthority({ ...VALID, description: 'x'.repeat(201) })).toHaveProperty('description');
  });

  it('skips the code check when no code is given (edit)', () => {
    expect(validateAuthority({ group: 'a', level: 'BRAND', description: 'd' })).toEqual({});
  });

  it('groupOf is the prefix', () => {
    expect(groupOf('company-user:manage')).toBe('company-user');
  });

  it('names the roles holding an authority', () => {
    const e = new ApiError(409, 'AUTHORITY_IN_USE', undefined, undefined, undefined, ['AGENT', 'TEAM_LEAD']);
    expect(messageFor(e)).toContain('AGENT, TEAM_LEAD');
  });
});
