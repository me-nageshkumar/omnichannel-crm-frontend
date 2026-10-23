import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeDeal, deletePipeline, getBoard, getStatus, getCrmSwitch, moveDeal, putCrmSwitch } from '@app/api/crm';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';

describe('crm api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('statusGetsBrandPath', async () => {
    const f = mockFetch({ 'GET /api/workspaces/w1/crm/status': { status: 200, body: { enabled: true } } });
    await getStatus('tok', 'w1');
    expect(requestTo(f, 'GET /api/workspaces/w1/crm/status')?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('boardCarriesQuery', async () => {
    const f = mockFetch({ 'GET /api/workspaces/w1/crm/deals/board': { status: 200, body: { lanes: [] } } });
    await getBoard('t', 'w1', { pipelineId: 'p1', perStageLimit: 25 });
    expect(String(f.mock.calls[0][0])).toBe('/api/workspaces/w1/crm/deals/board?pipelineId=p1&perStageLimit=25');
  });

  it('moveDealPostsNeighbours', async () => {
    const f = mockFetch({ 'POST /api/workspaces/w1/crm/deals/d1/move': { status: 200, body: {} } });
    await moveDeal('t', 'w1', 'd1', { stageId: 's2', beforeDealId: 'a', afterDealId: 'b' });
    expect(requestTo(f, 'POST /api/workspaces/w1/crm/deals/d1/move')?.body).toEqual({
      stageId: 's2',
      beforeDealId: 'a',
      afterDealId: 'b',
    });
  });

  it('closeDealPostsOutcome', async () => {
    const f = mockFetch({ 'POST /api/workspaces/w1/crm/deals/d1/close': { status: 200, body: {} } });
    await closeDeal('t', 'w1', 'd1', { outcome: 'LOST', lostReason: 'price' });
    expect(requestTo(f, 'POST /api/workspaces/w1/crm/deals/d1/close')?.body).toEqual({
      outcome: 'LOST',
      lostReason: 'price',
    });
  });

  it('deletePipelineAddsTarget', async () => {
    const f = mockFetch({ 'DELETE /api/workspaces/w1/crm/pipelines/p1': { status: 204 } });
    await deletePipeline('t', 'w1', 'p1', 'p2');
    await deletePipeline('t', 'w1', 'p1');
    expect(callsTo(f, 'DELETE /api/workspaces/w1/crm/pipelines/p1')).toBe(2);
    expect(String(f.mock.calls[0][0])).toBe('/api/workspaces/w1/crm/pipelines/p1?moveDealsToPipelineId=p2');
    expect(String(f.mock.calls[1][0])).toBe('/api/workspaces/w1/crm/pipelines/p1');
  });

  it('crmSwitchUsesCustomerPath', async () => {
    const path = '/api/customers/c1/workspaces/w1/crm';
    const f = mockFetch({
      [`GET ${path}`]: { status: 200, body: { enabled: false } },
      [`PUT ${path}`]: { status: 200, body: { enabled: true } },
    });
    await getCrmSwitch('t', 'c1', 'w1');
    await putCrmSwitch('t', 'c1', 'w1', { enabled: true, maxPipelines: 3, maxCustomFields: null });
    expect(requestTo(f, `PUT ${path}`)?.body).toEqual({ enabled: true, maxPipelines: 3, maxCustomFields: null });
  });
});
