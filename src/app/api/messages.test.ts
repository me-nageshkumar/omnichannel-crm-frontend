import { describe, expect, it } from 'vitest';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';

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
});
