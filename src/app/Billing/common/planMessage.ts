import { ApiError } from '@app/api/client';

/** One and many of each thing a plan can cap, for "Your plan allows 5 users." */
const NOUNS: Record<string, [string, string]> = {
  USERS: ['user', 'users'],
  BRANDS: ['brand', 'brands'],
  PHONE_NUMBERS: ['WhatsApp number', 'WhatsApp numbers'],
  AUTOMATION_RULES: ['automation rule', 'automation rules'],
  CHATBOTS: ['chatbot', 'chatbots'],
  AI_PROFILES: ['AI profile', 'AI profiles'],
  CHATBOT_NODES: ['node in a chatbot', 'nodes in a chatbot'],
  CHATBOT_AI_NODES: ['AI node in a chatbot', 'AI nodes in a chatbot'],
  CRM_PIPELINES: ['pipeline in a brand', 'pipelines in a brand'],
  CRM_CUSTOM_FIELDS: ['field per record type', 'fields per record type'],
};

/**
 * The sentence for a refusal that comes from the customer's plan: its subscription has ended, the plan does not
 * cover what was tried, or one of its limits is reached. Null for any other error.
 */
export function planMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.code) return null;
  switch (error.code.toUpperCase()) {
    case 'SUBSCRIPTION_EXPIRED':
      return 'Your plan has ended, so nothing can be changed until it is renewed.';
    case 'SUBSCRIPTION_INACTIVE':
      return 'Your plan does not allow this.';
    case 'LIMIT_REACHED': {
      const limit = error.extra?.limit;
      const nouns = error.extra?.key ? NOUNS[error.extra.key] : undefined;
      if (limit && nouns) return `Your plan allows ${limit} ${Number(limit) === 1 ? nouns[0] : nouns[1]}.`;
      return limit ? `Your plan's limit of ${limit} has been reached.` : "Your plan's limit has been reached.";
    }
    default:
      return null;
  }
}
