import type { AiCapabilities, AiConnection, AiProfile, AiProvider } from '@app/api/ai';
import type { MockRoute } from './fetchMock';

export const AI_BASE = '/api/workspaces/w1/ai';

export const OPENAI_CAPS: AiCapabilities = {
  state: 'CHAINED',
  hostedMcp: true,
  vectorStores: true,
  functionTools: true,
  structuredOutput: true,
  reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
  temperature: true,
  webSearch: true,
};

/** A provider with nothing hosted: no MCP by the provider, no vector stores, no temperature, no web search. */
export const SCRIPTED_CAPS: AiCapabilities = {
  state: 'TRANSCRIPT',
  hostedMcp: false,
  vectorStores: false,
  functionTools: true,
  structuredOutput: true,
  reasoningEfforts: [],
  temperature: false,
  webSearch: false,
};

export const PROVIDERS: AiProvider[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    capabilities: OPENAI_CAPS,
    connectionFields: [
      {
        key: 'organization',
        label: 'Organization ID',
        help: 'Optional. Sent as OpenAI-Organization. Not a secret; the key goes in API key.',
        kind: 'TEXT',
        required: false,
      },
      {
        key: 'project',
        label: 'Project ID',
        help: 'Optional. Sent as OpenAI-Project. Not a secret; the key goes in API key.',
        kind: 'TEXT',
        required: false,
      },
    ],
  },
  { id: 'scripted', label: 'Scripted', capabilities: SCRIPTED_CAPS, connectionFields: [] },
];

export const CONNECTION: AiConnection = {
  id: 'k1',
  name: 'Main key',
  provider: 'openai',
  keyHint: 'sk-…a91F',
  keySetAt: '2026-11-12T10:00:00Z',
  status: 'OK',
  checkedAt: '2026-11-12T10:00:01Z',
  lastError: null,
  settings: {},
  version: 0,
};

export const SCRIPTED_CONNECTION: AiConnection = {
  ...CONNECTION,
  id: 'k2',
  name: 'Scripted key',
  provider: 'scripted',
  keyHint: 'sc-…0001',
};

export const PROFILE: AiProfile = {
  id: 'p1',
  name: 'Sales assistant',
  connectionId: 'k1',
  provider: 'openai',
  model: 'gpt-5',
  instructions: 'You sell shirts.',
  reasoningEffort: null,
  maxOutputTokens: null,
  temperature: null,
  webSearch: false,
  vectorStoreIds: ['vs1'],
  mcpServers: [
    {
      id: 's1',
      label: 'calendar',
      url: 'https://mcp.example.com/mcp',
      connectBy: 'APP',
      auth: 'BEARER',
      headerName: null,
      secretHint: 'tok…9xyz',
      secretSetAt: '2026-11-12T10:00:00Z',
      allowedTools: ['book'],
    },
  ],
  updatedAt: '2026-11-12T10:00:00Z',
  version: 0,
};

/** The read routes of the AI page; tests add the write routes they exercise. */
export function aiRoutes(overrides: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    [`GET ${AI_BASE}/providers`]: { status: 200, body: PROVIDERS },
    [`GET ${AI_BASE}/connections`]: { status: 200, body: [CONNECTION] },
    [`GET ${AI_BASE}/connections/k1`]: { status: 200, body: CONNECTION },
    [`GET ${AI_BASE}/connections/k1/models`]: { status: 200, body: [{ id: 'gpt-5' }, { id: 'gpt-5-mini' }] },
    [`GET ${AI_BASE}/connections/k1/vector-stores`]: {
      status: 200,
      body: [
        { id: 'vs1', name: 'Product catalogue', fileCount: 312 },
        { id: 'vs2', name: 'Return policy', fileCount: 4 },
      ],
    },
    [`GET ${AI_BASE}/profiles`]: { status: 200, body: [PROFILE] },
    [`GET ${AI_BASE}/profiles/p1`]: { status: 200, body: PROFILE },
    ...overrides,
  };
}
