import { describe, expect, it } from 'vitest';
import { fieldsSummary, localDayRange, progressSummary, rangeTooLong } from '@app/Chatbots/chatbotDisplay';

describe('report display helpers', () => {
  it('localDayRange spans whole local days', () => {
    const r = localDayRange('2026-11-01', '2026-11-20');
    expect(r.from).toBe(new Date(2026, 10, 1, 0, 0, 0, 0).toISOString());
    expect(r.to).toBe(new Date(2026, 10, 20, 23, 59, 59, 999).toISOString());
  });

  it('rangeTooLong over 92 days', () => {
    expect(rangeTooLong('2026-01-01', '2026-04-03')).toBe(false); // 92 days apart
    expect(rangeTooLong('2026-01-01', '2026-04-04')).toBe(true); // 93 days apart
  });

  it('progressSummary omits empty buckets', () => {
    expect(progressSummary([12, 9, 11, 0])).toBe('gave nothing 12 · 1 detail 9 · 2 details 11');
    expect(progressSummary([0, 0, 0])).toBe('');
  });

  it('fieldsSummary uses the label, else the key', () => {
    expect(
      fieldsSummary([
        { key: 'name', label: 'name', given: 29 },
        { key: 'city', label: null, given: 20 },
      ]),
    ).toBe('name 29 · city 20');
  });
});
