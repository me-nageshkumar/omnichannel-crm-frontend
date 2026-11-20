import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkMetaConnection,
  createMetaConnection,
  deleteMetaConnection,
  getMetaConnection,
  listMetaConnections,
  retryWebhookSetup,
  updateMetaConnection,
} from '@app/api/metaConnections';
import { mockFetch, requestTo } from '../../test/fetchMock';

const BASE = '/api/workspaces/w1/meta/connections';
const CONNECTION = { id: 'c1', name: 'Bimal app', appId: '111', status: 'OK', numbers: [] };

describe('meta connections api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('everyFunctionHitsItsPath', async () => {
    const fetch = mockFetch({
      [`GET ${BASE}`]: { status: 200, body: [CONNECTION] },
      [`GET ${BASE}/c1`]: { status: 200, body: CONNECTION },
      [`POST ${BASE}`]: { status: 201, body: CONNECTION },
      [`PUT ${BASE}/c1`]: { status: 200, body: CONNECTION },
      [`POST ${BASE}/c1/check`]: { status: 200, body: { connection: CONNECTION, accounts: [] } },
      [`POST ${BASE}/c1/webhook`]: { status: 200, body: CONNECTION },
      [`DELETE ${BASE}/c1`]: { status: 204 },
    });

    expect(await listMetaConnections('tok', 'w1')).toEqual([CONNECTION]);
    expect(await getMetaConnection('tok', 'w1', 'c1')).toEqual(CONNECTION);
    await createMetaConnection('tok', 'w1', { name: 'Bimal app', appId: '111', appSecret: 's', accessToken: 't' });
    expect(requestTo(fetch, `POST ${BASE}`)?.body).toEqual({
      name: 'Bimal app',
      appId: '111',
      appSecret: 's',
      accessToken: 't',
    });
    await checkMetaConnection('tok', 'w1', 'c1', ' 555 ');
    expect(requestTo(fetch, `POST ${BASE}/c1/check`)?.body).toEqual({ wabaId: '555' });
    await retryWebhookSetup('tok', 'w1', 'c1');
    await deleteMetaConnection('tok', 'w1', 'c1');
    expect(requestTo(fetch, `DELETE ${BASE}/c1`)).toBeDefined();
  });

  it('updateOmitsAbsentSecrets', async () => {
    const fetch = mockFetch({ [`PUT ${BASE}/c1`]: { status: 200, body: CONNECTION } });

    await updateMetaConnection('tok', 'w1', 'c1', { name: 'Renamed', appSecret: '', accessToken: '  ' });

    const body = requestTo(fetch, `PUT ${BASE}/c1`)?.body;
    expect(body).toEqual({ name: 'Renamed' });
    expect('accessToken' in body).toBe(false);
  });
});
