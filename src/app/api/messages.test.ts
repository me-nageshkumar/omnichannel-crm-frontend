import { describe, expect, it } from 'vitest';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';

describe('messageFor', () => {
  it('names the chat that belongs to someone else', () => {
    expect(messageFor(new ApiError(409, 'CHAT_TAKEN'))).toBe(
      'This number already has a chat assigned to someone else.',
    );
  });
});
