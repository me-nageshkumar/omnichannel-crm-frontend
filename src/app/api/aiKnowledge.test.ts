import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addKnowledgeFile,
  addKnowledgeNote,
  addKnowledgeWebPage,
  createKnowledgeBase,
  deleteKnowledgeBase,
  downloadKnowledgeSource,
  getKnowledgeBase,
  isAdding,
  knowledgeSourceText,
  listKnowledgeBases,
  listKnowledgeSources,
  removeKnowledgeSource,
  saveKnowledgeBase,
  updateKnowledgeSource,
} from '@app/api/aiKnowledge';
import {
  cancelNumberMove,
  lastNumberMove,
  moveNumber,
  previewNumberMove,
  retryNumberMove,
} from '@app/api/phoneNumbers';
import { KB, KB_BASE, SOURCES, knowledgeRoutes } from '../../test/aiKnowledge';
import { mockFetch, requestTo } from '../../test/fetchMock';

const MOVE = {
  id: 'm1',
  phoneNumberId: 'n1',
  fromWorkspaceId: 'w1',
  fromWorkspaceName: 'Demo Fashion',
  toWorkspaceId: 'w9',
  toWorkspaceName: 'Bimal Institute',
  step: 'DONE',
  done: true,
  error: null,
  counts: { chats: 75, messages: 567, runsEnded: 2 },
  startedAt: '2026-11-18T10:00:00Z',
  finishedAt: '2026-11-18T10:00:02Z',
};

describe('knowledge api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('everyFunctionHitsItsPath', async () => {
    const fetch = mockFetch(
      knowledgeRoutes({
        [`POST ${KB_BASE}`]: { status: 201, body: KB },
        [`PUT ${KB_BASE}/kb1`]: { status: 200, body: KB },
        [`DELETE ${KB_BASE}/kb1`]: { status: 204 },
        [`POST ${KB_BASE}/kb1/sources/web-page`]: { status: 201, body: SOURCES[1] },
        [`POST ${KB_BASE}/kb1/sources/note`]: { status: 201, body: SOURCES[2] },
        [`PUT ${KB_BASE}/kb1/sources/s2`]: { status: 200, body: SOURCES[1] },
        [`DELETE ${KB_BASE}/kb1/sources/s3`]: { status: 202, body: { ...SOURCES[2], state: 'REMOVING' } },
      }),
    );

    expect(await listKnowledgeBases('tok', 'w1')).toEqual([KB]);
    expect(await getKnowledgeBase('tok', 'w1', 'kb1')).toEqual(KB);
    expect(await listKnowledgeSources('tok', 'w1', 'kb1')).toEqual(SOURCES);
    await createKnowledgeBase('tok', 'w1', { name: 'Bimal courses', description: '', connectionId: 'k1' });
    expect(requestTo(fetch, `POST ${KB_BASE}`)?.body).toEqual({
      name: 'Bimal courses',
      description: '',
      connectionId: 'k1',
    });
    await saveKnowledgeBase('tok', 'w1', 'kb1', { name: 'Courses', description: null, version: 3 });
    expect(requestTo(fetch, `PUT ${KB_BASE}/kb1`)?.body).toEqual({ name: 'Courses', description: null, version: 3 });
    await deleteKnowledgeBase('tok', 'w1', 'kb1');
    await addKnowledgeWebPage('tok', 'w1', 'kb1', 'https://bimalinstitute.com/');
    expect(requestTo(fetch, `POST ${KB_BASE}/kb1/sources/web-page`)?.body).toEqual({
      url: 'https://bimalinstitute.com/',
    });
    await addKnowledgeNote('tok', 'w1', 'kb1', 'Counsellor pitch', 'Greetings');
    expect(requestTo(fetch, `POST ${KB_BASE}/kb1/sources/note`)?.body).toEqual({
      title: 'Counsellor pitch',
      text: 'Greetings',
    });
    await updateKnowledgeSource('tok', 'w1', 'kb1', 's2', { action: 'FETCH_AGAIN' });
    expect(requestTo(fetch, `PUT ${KB_BASE}/kb1/sources/s2`)?.body).toEqual({ action: 'FETCH_AGAIN' });
    expect((await removeKnowledgeSource('tok', 'w1', 'kb1', 's3')).state).toBe('REMOVING');
    expect(requestTo(fetch, `GET ${KB_BASE}`)?.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('addKnowledgeFileSendsTheFileAsFormData', async () => {
    const fetch = mockFetch({ [`POST ${KB_BASE}/kb1/sources/file`]: { status: 201, body: SOURCES[0] } });
    const file = new File(['%PDF-1.4'], 'CFTP.pdf', { type: 'application/pdf' });

    expect(await addKnowledgeFile('tok', 'w1', 'kb1', file)).toEqual(SOURCES[0]);

    const body = fetch.mock.calls[0][1]?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('CFTP.pdf');
  });

  it('sourceContentAsTextAndAsABlob', async () => {
    mockFetch({
      [`GET ${KB_BASE}/kb1/sources/s3/content`]: {
        status: 200,
        text: '# Counsellor pitch\n\nGreetings',
        headers: { 'Content-Type': 'text/markdown' },
      },
    });

    expect(await knowledgeSourceText('tok', 'w1', 'kb1', 's3')).toBe('# Counsellor pitch\n\nGreetings');
    expect((await downloadKnowledgeSource('tok', 'w1', 'kb1', 's3')).size).toBe(
      '# Counsellor pitch\n\nGreetings'.length,
    );
  });

  it('isAddingOnlyForTheThreeAddingStates', () => {
    expect(['QUEUED', 'UPLOADING', 'INDEXING'].every((s) => isAdding(s as never))).toBe(true);
    expect(['READY', 'FAILED', 'REMOVING'].some((s) => isAdding(s as never))).toBe(false);
  });
});

describe('number move api', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('moveFunctionsHitTheirPaths', async () => {
    const preview = {
      fromWorkspaceName: 'Demo Fashion',
      toWorkspaceName: 'Bimal Institute',
      chats: 75,
      activeRuns: 2,
      teamName: 'Sales',
      archiveLabel: 'Main line (until 18 Nov)',
      movingBack: false,
      returningChats: 0,
      rulesNamingNumber: [],
      activeCampaigns: [],
    };
    const fetch = mockFetch({
      'GET /api/phone-numbers/n1/move/preview': { status: 200, body: preview },
      'POST /api/phone-numbers/n1/move': { status: 200, body: MOVE },
      'GET /api/phone-numbers/n1/move': { status: 200, body: MOVE },
      'POST /api/phone-numbers/n1/move/retry': { status: 200, body: MOVE },
      'POST /api/phone-numbers/n1/move/cancel': { status: 200, body: { ...MOVE, error: 'Cancelled' } },
    });

    expect(await previewNumberMove('tok', 'n1', 'w 9')).toEqual(preview);
    const url = String(fetch.mock.calls[0][0]);
    expect(url).toContain('workspaceId=w+9');
    expect(await moveNumber('tok', 'n1', 'w9')).toEqual(MOVE);
    expect(requestTo(fetch, 'POST /api/phone-numbers/n1/move')?.body).toEqual({ workspaceId: 'w9' });
    expect(await lastNumberMove('tok', 'n1')).toEqual(MOVE);
    expect(await retryNumberMove('tok', 'n1')).toEqual(MOVE);
    expect((await cancelNumberMove('tok', 'n1')).error).toBe('Cancelled');
  });
});
