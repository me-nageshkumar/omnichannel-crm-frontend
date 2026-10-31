import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelHistoryImport,
  isActive,
  listHistoryImports,
  startNumberImport,
  type HistoryImportStatus,
} from '@app/api/historyImports';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';

const B = '/api/workspaces/w1/inbox';

afterEach(() => vi.unstubAllGlobals());

describe('history imports api', () => {
  it('startNumberImportPostsScopeAndRange', async () => {
    const fetch = mockFetch({ [`POST ${B}/phone-numbers/p1/history-imports`]: { status: 200, body: { id: 'h1' } } });
    const body = { scope: { kind: 'CHATS' as const, phones: ['919928088743'] }, from: '2026-01-01', to: null };
    await startNumberImport('tok', 'w1', 'p1', body);
    const req = requestTo(fetch, `POST ${B}/phone-numbers/p1/history-imports`);
    expect(req?.body).toEqual(body);
    expect(req?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('listHistoryImportsBuildsQuery', async () => {
    const fetch = mockFetch({ [`GET ${B}/history-imports`]: { status: 200, body: { items: [], total: 0, page: 2 } } });
    await listHistoryImports('tok', 'w1', { phoneNumberId: 'p1', status: 'RUNNING', page: 2 });
    await listHistoryImports('tok', 'w1');
    expect(String(fetch.mock.calls[0][0])).toBe(`${B}/history-imports?phoneNumberId=p1&status=RUNNING&page=2`);
    expect(String(fetch.mock.calls[1][0])).toBe(`${B}/history-imports`);
  });

  it('cancelPosts', async () => {
    const fetch = mockFetch({ [`POST ${B}/history-imports/h1/cancel`]: { status: 200, body: { id: 'h1' } } });
    await cancelHistoryImport('tok', 'w1', 'h1');
    expect(callsTo(fetch, `POST ${B}/history-imports/h1/cancel`)).toBe(1);
  });

  it('isActiveOnlyForQueuedAndRunning', () => {
    const all: HistoryImportStatus[] = ['QUEUED', 'RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED'];
    expect(all.filter(isActive)).toEqual(['QUEUED', 'RUNNING']);
  });
});
