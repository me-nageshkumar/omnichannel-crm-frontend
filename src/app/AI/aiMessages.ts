import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';

/** The AI endpoints' coded errors whose server sentence is the one to show (it names profiles or chatbots). */
const SERVER_WORDED = new Set([
  'secrets_unavailable',
  'ai_connection_in_use',
  'ai_profile_in_use',
  'ai_provider_refused_key',
  'ai_provider_error',
  'mcp_error',
  'mcp_provider_server',
  'ai_knowledge_in_use',
  'ai_knowledge_limit',
  'ai_knowledge_file_type',
  'ai_knowledge_no_store_support',
]);

export const isSecretsUnavailable = (e: unknown): boolean =>
  e instanceof ApiError && e.code?.toLowerCase() === 'secrets_unavailable';

/** The sentence for a failed AI page action. */
export function aiMessage(e: unknown): string {
  if (e instanceof ApiError && e.code && SERVER_WORDED.has(e.code.toLowerCase()) && e.serverMessage) {
    return e.serverMessage;
  }
  return messageFor(e);
}
