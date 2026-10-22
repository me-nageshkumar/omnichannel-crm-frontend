import type { CampaignAction, SenderAction } from '@app/api/campaigns';
import { ApiError } from '@app/api/client';
import { shown } from '@app/api/phoneNumbers';

export const MESSAGES = {
  sessionExpired: 'Your session has expired. Please log in again.',
  loggedOutElsewhere: 'You were logged out in another tab.',
  generic: 'Something went wrong. Please try again.',
};

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Invalid username or password.',
  account_inactive: 'This account is inactive.',
  invalid_otp: 'That code is not valid. Try again.',
  invalid_token: 'Your sign-in took too long. Please log in again.',
  weak_password: 'Use at least 10 characters, different from your temporary password.',
  forbidden: "You don't have permission to do that.",
  not_found: "That item no longer exists or you can't see it.",
  role_in_use: 'This role is assigned to users. Move them to another role first.',
  already_all_brands: 'This person already has access to every brand.',
  already_in_workspace: 'This person already has a role in this brand.',
  last_access: "This is the person's only brand. Disable them instead.",
  invalid_connect_code: 'Invalid or expired connect code.',
  disabled: 'This number, its brand or its company is disabled.',
  not_in_workspace: 'Everyone in a team must have access to this brand.',
  too_many_rows: 'Too many contacts to export (the limit is 100,000). Narrow the filter and try again.',
  chat_closed: 'This chat is closed. Reopen it to reply.',
  chat_taken: 'This number already has a chat assigned to someone else.',
  not_on_whatsapp: 'This number is not on WhatsApp.',
  lookup_failed: 'Could not check this number on WhatsApp. Try again.',
  media_unavailable: 'Media is no longer available on the phone.',
  no_device: 'WhatsApp is not connected on this number.',
  whatsapp_not_ready: 'WhatsApp is not connected on this number.',
  campaign_not_editable: 'Only a draft campaign can be edited.',
  template_has_link: 'Campaign messages cannot contain links.',
  template_not_text: 'Only text templates can be used in campaigns.',
  placeholder_unmapped: 'Every placeholder needs a value.',
  mapping_column_reused: 'A CSV column can be used only once.',
  phone_column_required: 'Choose the column that holds the phone number.',
  sender_state: 'This number cannot be changed now.',
  query_timeout: 'This filter takes too long to run. Make it more specific.',
  conflict: 'Someone else changed this at the same time. Reload and try again.',
};

/** The user-facing sentence for an error from the API layer. */
export function messageFor(error: unknown): string {
  if (!(error instanceof ApiError) || !error.code) return MESSAGES.generic;
  const code = error.code.toLowerCase();
  if (code === 'too_many_attempts') {
    const minutes = Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60));
    return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
  }
  if (code === 'authority_in_use') {
    return `This authority is in a role: ${(error.roles ?? []).join(', ')}. Remove it from those roles first.`;
  }
  if (code === 'template_in_use') {
    return error.serverMessage ?? 'This template has been used; archive it instead';
  }
  if (code === 'disabled_at_higher_level') {
    return error.serverMessage ?? 'This was disabled at a higher level. You cannot enable it.';
  }
  if (code === 'sender_not_available') {
    return `${error.number ? shown(error.number) : 'This number'} cannot send campaigns right now.`;
  }
  if (code === 'filter_in_use') {
    const names = (refs: { name: string }[] = []) => refs.map((r) => r.name).join(', ');
    const parts = [
      'This is used by a saved filter or a campaign. Remove it there first.',
      error.usedBy?.filters.length ? `Saved filters: ${names(error.usedBy.filters)}.` : '',
      error.usedBy?.campaigns.length ? `Campaigns: ${names(error.usedBy.campaigns)}.` : '',
    ];
    return parts.filter(Boolean).join(' ');
  }
  if (code === 'validation') {
    // The server names the field(s) in a readable sentence; show it rather than "try again".
    const fields = Object.entries(error.fields ?? {}).map(([k, v]) => `${k} ${v}`);
    return error.serverMessage ?? (fields.length > 0 ? fields.join('; ') : MESSAGES.generic);
  }
  return BY_CODE[code] ?? MESSAGES.generic;
}

const DONE: Record<CampaignAction, string> = {
  start: 'started',
  pause: 'paused',
  resume: 'resumed',
  terminate: 'terminated',
};

/** The sentence for a failed campaign lifecycle action; a wrong state names the action. */
export function campaignActionMessage(error: unknown, action: CampaignAction): string {
  if (error instanceof ApiError && error.code?.toLowerCase() === 'campaign_state') {
    return `This campaign cannot be ${DONE[action]} now.`;
  }
  return messageFor(error);
}

const SENDER_DONE: Record<SenderAction, string> = {
  REST: 'rested',
  RETIRE: 'retired',
  REACTIVATE: 'reactivated',
  RESUME: 'resumed',
};

/** Whether the server refused a sender action because of the sender's state (someone else changed it). */
export const isSenderState = (error: unknown): boolean =>
  error instanceof ApiError && error.code?.toLowerCase() === 'sender_state';

/** The sentence for a failed sender action; a wrong state names the action. */
export function senderActionMessage(error: unknown, action: SenderAction): string {
  return isSenderState(error) ? `This number cannot be ${SENDER_DONE[action]} now.` : messageFor(error);
}
