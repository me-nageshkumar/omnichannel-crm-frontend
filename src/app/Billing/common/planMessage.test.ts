import { describe, expect, it } from 'vitest';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { crmMessage } from '@app/Crm/errors';
import { planMessage } from '@app/Billing/common/planMessage';

const error = (status: number, code: string, extra?: Record<string, string>) =>
  new ApiError(status, code, undefined, undefined, undefined, undefined, undefined, undefined, undefined, extra);

describe('planMessage', () => {
  it('words an ended subscription and a feature outside the plan', () => {
    expect(planMessage(error(402, 'SUBSCRIPTION_EXPIRED'))).toBe(
      'Your plan has ended, so nothing can be changed until it is renewed.',
    );
    expect(planMessage(error(402, 'SUBSCRIPTION_INACTIVE'))).toBe('Your plan does not allow this.');
  });

  it('names the limit that was reached', () => {
    const reached = (key: string, limit: string) =>
      planMessage(error(409, 'LIMIT_REACHED', { key, limit, used: limit }));
    expect(reached('USERS', '5')).toBe('Your plan allows 5 users.');
    expect(reached('BRANDS', '1')).toBe('Your plan allows 1 brand.');
    expect(reached('PHONE_NUMBERS', '2')).toBe('Your plan allows 2 WhatsApp numbers.');
    expect(reached('AUTOMATION_RULES', '10')).toBe('Your plan allows 10 automation rules.');
    expect(reached('CHATBOTS', '3')).toBe('Your plan allows 3 chatbots.');
    expect(reached('AI_PROFILES', '1')).toBe('Your plan allows 1 AI profile.');
    expect(reached('CRM_PIPELINES', '2')).toBe('Your plan allows 2 pipelines in a brand.');
    expect(reached('CRM_CUSTOM_FIELDS', '20')).toBe('Your plan allows 20 fields per record type.');
    expect(planMessage(error(409, 'LIMIT_REACHED', { limit: '4' }))).toBe("Your plan's limit of 4 has been reached.");
    expect(planMessage(error(409, 'LIMIT_REACHED'))).toBe("Your plan's limit has been reached.");
  });

  it('leaves everything else alone', () => {
    expect(planMessage(error(403, 'FORBIDDEN'))).toBeNull();
    expect(planMessage(new Error('x'))).toBeNull();
  });

  it('is what the shared and the CRM messages say', () => {
    expect(messageFor(error(402, 'SUBSCRIPTION_EXPIRED'))).toBe(
      'Your plan has ended, so nothing can be changed until it is renewed.',
    );
    expect(messageFor(error(409, 'LIMIT_REACHED', { key: 'USERS', limit: '5', used: '5' }))).toBe(
      'Your plan allows 5 users.',
    );
    expect(crmMessage(error(409, 'LIMIT_REACHED', { key: 'CRM_PIPELINES', limit: '2', used: '2' }))).toBe(
      'Your plan allows 2 pipelines in a brand.',
    );
    expect(messageFor(error(403, 'FORBIDDEN'))).toBe("You don't have permission to do that.");
  });
});
