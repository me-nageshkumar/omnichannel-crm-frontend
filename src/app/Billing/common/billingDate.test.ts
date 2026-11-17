import { describe, expect, it } from 'vitest';
import { billingDate } from '@app/Billing/common/billingDate';

describe('billingDate', () => {
  it('shows a term date in the billing zone, not the browser zone', () => {
    // midnight on 1 Jan 2027 in India is still 31 Dec in UTC
    expect(billingDate('2026-12-31T18:30:00Z', 'Asia/Kolkata')).toBe('1 Jan 2027');
    expect(billingDate('2026-12-31T18:30:00Z', 'UTC')).toBe('31 Dec 2026');
  });

  it('steps back whole days for the last day of a term', () => {
    expect(billingDate('2026-12-31T18:30:00Z', 'Asia/Kolkata', 1)).toBe('31 Dec 2026');
    expect(billingDate('2027-02-28T18:30:00Z', 'Asia/Kolkata', 1)).toBe('28 Feb 2027');
  });

  it('gives back what is not a date, and survives an unknown zone', () => {
    expect(billingDate('soon', 'Asia/Kolkata')).toBe('soon');
    expect(billingDate('2026-12-31T18:30:00Z', 'Mars/Olympus')).toBe('31 Dec 2026');
  });
});
