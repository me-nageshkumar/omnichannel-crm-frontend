import { describe, expect, it } from 'vitest';
import type { AiProfileSave } from '@app/api/ai';
import { profileProblems } from '@app/AI/profileProblems';
import { OPENAI_CAPS, SCRIPTED_CAPS } from '../../test/ai';

const BASE: AiProfileSave = {
  name: 'P',
  connectionId: 'k1',
  model: 'm',
  instructions: null,
  reasoningEffort: null,
  maxOutputTokens: null,
  temperature: null,
  webSearch: false,
  vectorStoreIds: [],
  mcpServers: [],
};

const PROVIDER_ROW = {
  label: 'cal',
  url: 'https://x.example',
  connectBy: 'PROVIDER' as const,
  auth: 'NONE' as const,
  headerName: null,
  allowedTools: [],
};

describe('profileProblems', () => {
  it('noneForOpenAi', () => {
    const save = {
      ...BASE,
      reasoningEffort: 'low',
      temperature: 0.5,
      webSearch: true,
      vectorStoreIds: ['vs1'],
      mcpServers: [PROVIDER_ROW],
    };
    expect(profileProblems(save, OPENAI_CAPS)).toEqual({});
  });

  it('providerMcpNeedsHostedMcp', () => {
    expect(
      profileProblems({ ...BASE, mcpServers: [{ ...PROVIDER_ROW, connectBy: 'APP' }, PROVIDER_ROW] }, SCRIPTED_CAPS),
    ).toEqual({ 'mcpServers.1.connectBy': 'This provider cannot connect to MCP servers itself; choose Our app' });
  });

  it('vectorStoresNeedTheCapability', () => {
    expect(profileProblems({ ...BASE, vectorStoreIds: ['vs1'] }, SCRIPTED_CAPS)).toEqual({
      vectorStoreIds: 'This provider has no vector stores',
    });
  });

  it('temperatureNeedsTheCapability', () => {
    expect(profileProblems({ ...BASE, temperature: 1 }, SCRIPTED_CAPS)).toEqual({
      temperature: 'This provider does not take a temperature',
    });
  });

  it('reasoningEffortMustBeOneTheProviderLists', () => {
    expect(profileProblems({ ...BASE, reasoningEffort: 'turbo' }, OPENAI_CAPS)).toEqual({
      reasoningEffort: 'must be one of minimal, low, medium, high',
    });
  });

  it('reasoningEffortNeedsTheCapability', () => {
    expect(profileProblems({ ...BASE, reasoningEffort: 'high' }, SCRIPTED_CAPS)).toEqual({
      reasoningEffort: 'This provider does not take a reasoning effort',
    });
  });

  it('webSearchNeedsTheCapability', () => {
    expect(profileProblems({ ...BASE, webSearch: true }, SCRIPTED_CAPS)).toEqual({
      webSearch: 'This provider has no web search',
    });
  });

  it('unknownCapabilitiesReportNothing', () => {
    expect(profileProblems({ ...BASE, webSearch: true, mcpServers: [PROVIDER_ROW] }, null)).toEqual({});
  });
});
