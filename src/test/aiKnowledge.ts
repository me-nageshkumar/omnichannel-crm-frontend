import type { KnowledgeBase, KnowledgeSource } from '@app/api/aiKnowledge';
import type { MockRoute } from './fetchMock';
import { AI_BASE } from './ai';

export const KB_BASE = `${AI_BASE}/knowledge-bases`;

export const KB: KnowledgeBase = {
  id: 'kb1',
  name: 'Bimal courses',
  description: 'Courses, fees and policies',
  connectionId: 'k1',
  connectionName: 'Main key',
  provider: 'openai',
  providerStoreId: 'vs_kb1',
  status: 'READY',
  error: null,
  counts: { queued: 0, adding: 1, ready: 10, failed: 1 },
  sourceCount: 12,
  usedBy: ['Bimal counsellor'],
  createdAt: '2026-11-18T10:00:00Z',
  updatedAt: '2026-11-18T11:00:00Z',
  version: 3,
};

const source = (over: Partial<KnowledgeSource>): KnowledgeSource => ({
  id: 's0',
  kind: 'NOTE',
  title: 'Note',
  url: null,
  fileName: null,
  contentType: 'text/markdown',
  size: 1024,
  state: 'READY',
  error: null,
  addedAt: '2026-11-18T10:05:00Z',
  addedBy: 'demo-manager',
  fetchedAt: null,
  version: 1,
  ...over,
});

export const SOURCES: KnowledgeSource[] = [
  source({
    id: 's1',
    kind: 'FILE',
    title: 'CFTP Digital Brochure.pdf',
    fileName: 'CFTP Digital Brochure.pdf',
    contentType: 'application/pdf',
    size: 14_709_613,
  }),
  source({
    id: 's2',
    kind: 'WEB_PAGE',
    title: 'Crypto & Forex Trading Program',
    url: 'https://bimalinstitute.com/crypto-forex-trading/',
    size: 18_432,
    fetchedAt: '2026-11-18T10:06:00Z',
  }),
  source({ id: 's3', kind: 'NOTE', title: 'Counsellor pitch' }),
  source({
    id: 's4',
    kind: 'WEB_PAGE',
    title: 'https://bimalinstitute.com/blog/',
    url: 'https://bimalinstitute.com/blog/',
    size: 0,
    state: 'FAILED',
    error: 'The page answered 403',
  }),
  source({ id: 's5', kind: 'NOTE', title: 'Answers the team confirms', state: 'INDEXING' }),
];

/** The read routes of the Knowledge tab and a knowledge base's page; tests add the write routes they use. */
export function knowledgeRoutes(overrides: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    [`GET ${KB_BASE}`]: { status: 200, body: [KB] },
    [`GET ${KB_BASE}/kb1`]: { status: 200, body: KB },
    [`GET ${KB_BASE}/kb1/sources`]: { status: 200, body: SOURCES },
    ...overrides,
  };
}
