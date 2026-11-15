import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAiConnection,
  createAiProfile,
  deleteAiConnection,
  deleteAiProfile,
  getAiConnection,
  getAiProfile,
  listAiConnections,
  listAiModels,
  listAiProfiles,
  listAiProviders,
  listAiVectorStores,
  listMcpTools,
  saveAiConnection,
  saveAiProfile,
  verifyAiConnection,
} from '@app/api/ai';
import { ApiError } from '@app/api/client';
import { AI_BASE, CONNECTION, PROFILE, PROVIDERS, aiRoutes } from '../../test/ai';
import { mockFetch, requestTo } from '../../test/fetchMock';

describe('ai api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('everyFunctionHitsItsPath', async () => {
    const fetch = mockFetch({
      ...aiRoutes(),
      [`POST ${AI_BASE}/connections`]: { status: 201, body: CONNECTION },
      [`PUT ${AI_BASE}/connections/k1`]: { status: 200, body: CONNECTION },
      [`DELETE ${AI_BASE}/connections/k1`]: { status: 204 },
      [`POST ${AI_BASE}/connections/k1/verify`]: { status: 200, body: CONNECTION },
      [`POST ${AI_BASE}/profiles`]: { status: 201, body: PROFILE },
      [`PUT ${AI_BASE}/profiles/p1`]: { status: 200, body: PROFILE },
      [`DELETE ${AI_BASE}/profiles/p1`]: { status: 204 },
      [`POST ${AI_BASE}/profiles/p1/mcp/s1/tools`]: { status: 200, body: [{ name: 'book', description: 'Books' }] },
    });

    expect(await listAiProviders('tok', 'w1')).toEqual(PROVIDERS);
    expect(await listAiConnections('tok', 'w1')).toEqual([CONNECTION]);
    expect((await getAiConnection('tok', 'w1', 'k1')).keyHint).toBe('sk-…a91F');
    await createAiConnection('tok', 'w1', { name: 'Main', provider: 'openai', apiKey: 'sk-new' });
    await saveAiConnection('tok', 'w1', 'k1', { name: 'Main', provider: 'openai', version: 0 });
    await deleteAiConnection('tok', 'w1', 'k1');
    await verifyAiConnection('tok', 'w1', 'k1');
    expect(await listAiModels('tok', 'w1', 'k1')).toEqual([{ id: 'gpt-5' }, { id: 'gpt-5-mini' }]);
    expect((await listAiVectorStores('tok', 'w1', 'k1'))[0].fileCount).toBe(312);
    expect(await listAiProfiles('tok', 'w1')).toEqual([PROFILE]);
    expect((await getAiProfile('tok', 'w1', 'p1')).name).toBe('Sales assistant');
    await createAiProfile('tok', 'w1', { ...saveOf(), version: undefined });
    await saveAiProfile('tok', 'w1', 'p1', saveOf());
    await deleteAiProfile('tok', 'w1', 'p1');
    expect(await listMcpTools('tok', 'w1', 'p1', 's1')).toEqual([{ name: 'book', description: 'Books' }]);

    expect(requestTo(fetch, `POST ${AI_BASE}/connections`)?.body).toEqual({
      name: 'Main',
      provider: 'openai',
      apiKey: 'sk-new',
    });
    expect(requestTo(fetch, `GET ${AI_BASE}/providers`)?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('saveWithoutAKeyOmitsIt', async () => {
    const fetch = mockFetch({ [`PUT ${AI_BASE}/connections/k1`]: { status: 200, body: CONNECTION } });
    await saveAiConnection('tok', 'w1', 'k1', { name: 'Renamed', provider: 'openai', apiKey: undefined, version: 0 });
    expect(requestTo(fetch, `PUT ${AI_BASE}/connections/k1`)?.body).not.toHaveProperty('apiKey');
  });

  it('profileInUseIsAnApiErrorWithItsCode', async () => {
    mockFetch({
      [`DELETE ${AI_BASE}/profiles/p1`]: {
        status: 409,
        body: { code: 'ai_profile_in_use', message: 'Used by chatbots: Lead qualifier' },
      },
    });
    const err = await deleteAiProfile('tok', 'w1', 'p1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('ai_profile_in_use');
  });
});

function saveOf() {
  const { id: _id, provider: _p, updatedAt: _u, mcpServers, ...rest } = PROFILE;
  return {
    ...rest,
    mcpServers: mcpServers.map(({ secretHint: _h, secretSetAt: _s, ...m }) => m),
  };
}
