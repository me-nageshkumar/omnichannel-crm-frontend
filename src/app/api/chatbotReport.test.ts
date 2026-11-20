import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChatbotReport, listReportRuns } from '@app/api/chatbots';
import { mockFetch, requestTo } from '../../test/fetchMock';

const urlOf = (fetch: ReturnType<typeof mockFetch>, n = 0) => {
  const input = fetch.mock.calls[n][0];
  return typeof input === 'string' ? input : input.toString();
};

const EMPTY_REPORT = {
  totals: {
    started: 0,
    running: 0,
    completed: 0,
    wentSilent: 0,
    stopped: 0,
    failed: 0,
    handedOver: 0,
    jumped: 0,
    chat: { toAgent: 0, toQueue: 0, closed: 0, left: 0, notRecorded: 0 },
  },
  steps: [],
  progress: [],
};

describe('chatbot report api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getChatbotReport sends the range and leaves out an absent number', async () => {
    const fetch = mockFetch({ 'GET /api/workspaces/w1/chatbots/c1/report': { status: 200, body: EMPTY_REPORT } });
    const report = await getChatbotReport('tok', 'w1', 'c1', {
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-20T23:59:59.999Z',
    });
    expect(report.totals.started).toBe(0);
    const url = urlOf(fetch);
    expect(url).toContain('/api/workspaces/w1/chatbots/c1/report?');
    expect(url).toContain('from=2026-11-01T00%3A00%3A00.000Z');
    expect(url).toContain('to=2026-11-20T23%3A59%3A59.999Z');
    expect(url).not.toContain('phoneNumberId');
    expect(requestTo(fetch, 'GET /api/workspaces/w1/chatbots/c1/report')?.headers.get('Authorization')).toBe(
      'Bearer tok',
    );
  });

  it('listReportRuns serialises every filter it is given', async () => {
    const fetch = mockFetch({
      'GET /api/workspaces/w1/chatbots/c1/report/runs': {
        status: 200,
        body: { items: [], total: 0, page: 1, size: 25 },
      },
    });
    const page = await listReportRuns('tok', 'w1', 'c1', {
      phoneNumberId: 'n1',
      nodeId: 'ai1',
      reached: true,
      active: true,
      given: 2,
      chat: 'TO_QUEUE',
      page: 1,
      size: 25,
    });
    expect(page.total).toBe(0);
    const url = urlOf(fetch);
    expect(url).toContain('/api/workspaces/w1/chatbots/c1/report/runs?');
    [
      'phoneNumberId=n1',
      'nodeId=ai1',
      'reached=true',
      'active=true',
      'given=2',
      'chat=TO_QUEUE',
      'page=1',
      'size=25',
    ].forEach((p) => expect(url).toContain(p));
    expect(url).not.toContain('status=');
    expect(requestTo(fetch, 'GET /api/workspaces/w1/chatbots/c1/report/runs')?.headers.get('Authorization')).toBe(
      'Bearer tok',
    );
  });

  it('listReportRuns keeps given=0', async () => {
    const fetch = mockFetch({
      'GET /api/workspaces/w1/chatbots/c1/report/runs': {
        status: 200,
        body: { items: [], total: 0, page: 0, size: 25 },
      },
    });
    await listReportRuns('tok', 'w1', 'c1', { nodeId: 'ai1', given: 0 });
    expect(urlOf(fetch)).toContain('given=0');
  });
});
