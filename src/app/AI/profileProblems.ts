import type { AiCapabilities, AiProfileSave } from '@app/api/ai';

/** The server's own capability messages (AiProfileService), shown before saving so a switch of connection is caught. */
export const MCP_PROVIDER_PROBLEM = 'This provider cannot connect to MCP servers itself; choose Our app';

/**
 * What the selected provider cannot do, keyed like the server's validation errors. `caps` null (the provider list did
 * not load) reports nothing and leaves the check to the server.
 */
export function profileProblems(save: AiProfileSave, caps: AiCapabilities | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!caps) return out;
  save.mcpServers.forEach((s, i) => {
    if (s.connectBy === 'PROVIDER' && !caps.hostedMcp) out[`mcpServers.${i}.connectBy`] = MCP_PROVIDER_PROBLEM;
  });
  if (save.vectorStoreIds.length > 0 && !caps.vectorStores) out.vectorStoreIds = 'This provider has no vector stores';
  if (save.temperature != null && !caps.temperature) out.temperature = 'This provider does not take a temperature';
  if (save.reasoningEffort != null && save.reasoningEffort !== '') {
    const efforts = caps.reasoningEfforts ?? [];
    if (efforts.length === 0) out.reasoningEffort = 'This provider does not take a reasoning effort';
    else if (!efforts.includes(save.reasoningEffort)) out.reasoningEffort = `must be one of ${efforts.join(', ')}`;
  }
  if (save.webSearch && !caps.webSearch) out.webSearch = 'This provider has no web search';
  return out;
}
