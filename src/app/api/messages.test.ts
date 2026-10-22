import { describe, expect, it } from 'vitest';
import { ApiError } from '@app/api/client';
import { campaignActionMessage, messageFor, senderActionMessage } from '@app/api/messages';

describe('messageFor', () => {
  it('names the chat that belongs to someone else', () => {
    expect(messageFor(new ApiError(409, 'CHAT_TAKEN'))).toBe(
      'This number already has a chat assigned to someone else.',
    );
  });

  it('says when a number is not on WhatsApp', () => {
    expect(messageFor(new ApiError(404, 'NOT_ON_WHATSAPP'))).toBe('This number is not on WhatsApp.');
  });

  it('says when the number check failed', () => {
    expect(messageFor(new ApiError(502, 'LOOKUP_FAILED'))).toBe('Could not check this number on WhatsApp. Try again.');
  });

  it.each([
    ['CAMPAIGN_NOT_EDITABLE', 409, 'Only a draft campaign can be edited.'],
    ['TEMPLATE_HAS_LINK', 400, 'Campaign messages cannot contain links.'],
    ['TEMPLATE_NOT_TEXT', 400, 'Only text templates can be used in campaigns.'],
    ['PLACEHOLDER_UNMAPPED', 400, 'Every placeholder needs a value.'],
    ['MAPPING_COLUMN_REUSED', 400, 'A CSV column can be used only once.'],
    ['PHONE_COLUMN_REQUIRED', 400, 'Choose the column that holds the phone number.'],
    ['SENDER_STATE', 409, 'This number cannot be changed now.'],
  ])('says %s in a fixed sentence', (code, status, sentence) => {
    expect(messageFor(new ApiError(status, code))).toBe(sentence);
  });

  it('names the sender that cannot send campaigns', () => {
    const e = new ApiError(
      400,
      'SENDER_NOT_AVAILABLE',
      undefined,
      'senderIds',
      undefined,
      undefined,
      'x',
      '919800000001',
    );
    expect(messageFor(e)).toBe('+919800000001 cannot send campaigns right now.');
    expect(messageFor(new ApiError(400, 'SENDER_NOT_AVAILABLE'))).toBe('This number cannot send campaigns right now.');
  });
});

describe('campaignActionMessage', () => {
  it.each([
    ['start', 'started'],
    ['pause', 'paused'],
    ['resume', 'resumed'],
    ['terminate', 'terminated'],
  ] as const)('says a %s is not possible now', (action, done) => {
    expect(campaignActionMessage(new ApiError(409, 'CAMPAIGN_STATE'), action)).toBe(
      `This campaign cannot be ${done} now.`,
    );
  });

  it('falls back to the general sentence for other errors', () => {
    expect(campaignActionMessage(new ApiError(404, 'NOT_FOUND'), 'start')).toBe(
      "That item no longer exists or you can't see it.",
    );
  });
});

describe('senderActionMessage', () => {
  it.each([
    ['REST', 'rested'],
    ['RETIRE', 'retired'],
    ['REACTIVATE', 'reactivated'],
    ['RESUME', 'resumed'],
  ] as const)('says a %s is not possible now', (action, done) => {
    expect(senderActionMessage(new ApiError(409, 'SENDER_STATE'), action)).toBe(`This number cannot be ${done} now.`);
  });

  it('falls back to the general sentence for other errors', () => {
    expect(senderActionMessage(new ApiError(403, 'FORBIDDEN'), 'REST')).toBe("You don't have permission to do that.");
  });
});

describe('messageFor filters', () => {
  const IN_USE = 'This is used by a saved filter or a campaign. Remove it there first.';
  const usedBy = (filters: { id: string; name: string }[], campaigns: { id: string; name: string }[]) =>
    new ApiError(409, 'FILTER_IN_USE', undefined, undefined, undefined, undefined, undefined, undefined, {
      filters,
      campaigns,
    });

  it('says a query timed out', () => {
    expect(messageFor(new ApiError(504, 'QUERY_TIMEOUT'))).toBe(
      'This filter takes too long to run. Make it more specific.',
    );
  });

  it('names the filters and campaigns that use it', () => {
    const error = usedBy(
      [
        { id: 'f2', name: 'Lapsed VIPs' },
        { id: 'f3', name: 'Pune' },
      ],
      [{ id: 'c1', name: 'Diwali' }],
    );
    expect(messageFor(error)).toBe(`${IN_USE} Saved filters: Lapsed VIPs, Pune. Campaigns: Diwali.`);
  });

  it('names only the campaigns when no filter uses it', () => {
    expect(messageFor(usedBy([], [{ id: 'c1', name: 'Diwali' }]))).toBe(`${IN_USE} Campaigns: Diwali.`);
  });

  it('is the bare sentence without usedBy', () => {
    expect(messageFor(new ApiError(409, 'FILTER_IN_USE'))).toBe(IN_USE);
  });
});
