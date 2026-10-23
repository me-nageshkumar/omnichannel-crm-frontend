import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';

/** Plain-English wording for the codes the CRM API answers with; anything else falls back to the shared messages. */
const CRM_MESSAGES: Record<string, string> = {
  CRM_NOT_ENABLED: 'The CRM is not switched on for this brand.',
  VERSION_CONFLICT: 'Someone else changed this. Reload to see their changes.',
  LIMIT_REACHED: "Your plan's limit has been reached.",
  PIPELINE_INACTIVE: 'This pipeline is inactive. Activate it or choose another.',
  CHANNEL_MISMATCH: "This contact belongs to a different WhatsApp number than the chat's.",
};

/** The sentence for a CRM API failure; {@code fallback} words an unmapped one (default: the shared message). */
export function crmMessage(error: unknown, fallback?: string): string {
  if (error instanceof ApiError && error.code && CRM_MESSAGES[error.code]) return CRM_MESSAGES[error.code];
  return fallback ?? messageFor(error);
}
