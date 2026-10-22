import { describe, expect, it } from 'vitest';
import { estimateText } from '@app/Campaigns/campaignDisplay';

describe('estimateText', () => {
  it('namesTheWorkingDaysAndTheFinishDate', () => {
    expect(estimateText({ remaining: 120, perDay: 45, days: 3, finishBy: '2026-10-24' })).toBe(
      'About 3 working days (by Sat 24 Oct)',
    );
  });

  it('usesTheSingularForOneDay', () => {
    expect(estimateText({ remaining: 20, perDay: 45, days: 1, finishBy: '2026-10-22' })).toBe(
      'About 1 working day (by Thu 22 Oct)',
    );
  });

  it('omitsTheDateWhenThereIsNone', () => {
    expect(estimateText({ remaining: 120, perDay: 45, days: 3, finishBy: null })).toBe('About 3 working days');
  });

  it('saysNoSenderCanSendWhenNothingSends', () => {
    expect(estimateText({ remaining: 120, perDay: 0, days: null, finishBy: null })).toBe('No sender can send');
  });

  it('isNothingWhenNothingRemains', () => {
    expect(estimateText({ remaining: 0, perDay: 45, days: 0, finishBy: null })).toBeNull();
  });
});
