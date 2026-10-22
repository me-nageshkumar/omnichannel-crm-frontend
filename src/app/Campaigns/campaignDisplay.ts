import type { CampaignEstimate, RecipientStatus, SkipReason } from '@app/api/campaigns';

export const RECIPIENT_STATUS_TEXT: Record<RecipientStatus, string> = {
  PENDING: 'Pending',
  SENDING: 'Sending',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  READ: 'Read',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
};

export const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  NOT_ON_WHATSAPP: 'Not on WhatsApp',
  DO_NOT_CONTACT: 'Do not contact',
  RECENTLY_MESSAGED: 'Recently messaged',
  NO_PHONE: 'No phone number',
  INVALID_PHONE: 'Invalid phone number',
  DUPLICATE: 'Duplicate',
  CHAT_ON_OTHER_NUMBER: 'Chat on another number',
  CANCELLED: 'Cancelled',
};

/** How long the rest will take, or null when nothing remains to send. */
export function estimateText(e: CampaignEstimate): string | null {
  if (e.remaining === 0) return null;
  if (e.days === null) return 'No sender can send';
  const days = `About ${e.days} working day${e.days === 1 ? '' : 's'}`;
  if (!e.finishBy) return days;
  const by = new Date(`${e.finishBy}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${days} (by ${by})`;
}
