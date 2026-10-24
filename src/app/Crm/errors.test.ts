import { describe, expect, it } from 'vitest';
import { ApiError } from '@app/api/client';
import { crmMessage } from '@app/Crm/errors';

describe('crmMessage', () => {
  it.each(['CRM_NOT_ENABLED', 'VERSION_CONFLICT', 'LIMIT_REACHED', 'PIPELINE_INACTIVE', 'CHANNEL_MISMATCH'])(
    'wordsCode %s in plain English',
    (code) => {
      const text = crmMessage(new ApiError(409, code));
      expect(text).not.toBe('Something went wrong. Please try again.');
      expect(text).not.toContain('_');
    },
  );
  it('usesTheFallbackForOtherCodes', () => {
    expect(crmMessage(new ApiError(500, 'OTHER'), 'Could not do it.')).toBe('Could not do it.');
  });
});
