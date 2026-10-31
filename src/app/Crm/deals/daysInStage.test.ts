import { describe, expect, it } from 'vitest';
import { daysInStageLabel } from './daysInStage';

const now = new Date('2026-10-31T12:00:00Z');
const open = (stageEnteredAt: string | null) => ({ status: 'OPEN' as const, stageEnteredAt });

describe('daysInStageLabel', () => {
  it('newInStageUnderADay', () => {
    expect(daysInStageLabel(open('2026-10-31T01:00:00Z'), now)).toBe('New in stage');
    expect(daysInStageLabel(open('2026-10-30T12:30:00Z'), now)).toBe('New in stage');
  });

  it('countsWholeDays', () => {
    expect(daysInStageLabel(open('2026-10-30T12:00:00Z'), now)).toBe('1d in stage');
    expect(daysInStageLabel(open('2026-10-20T11:00:00Z'), now)).toBe('11d in stage');
  });

  it('closedDealShowsNothing', () => {
    expect(daysInStageLabel({ status: 'WON', stageEnteredAt: '2026-10-20T11:00:00Z' }, now)).toBeNull();
    expect(daysInStageLabel({ status: 'LOST', stageEnteredAt: '2026-10-20T11:00:00Z' }, now)).toBeNull();
  });

  it('missingOrBadDateShowsNothing', () => {
    expect(daysInStageLabel(open(null), now)).toBeNull();
    expect(daysInStageLabel(open('not a date'), now)).toBeNull();
  });

  it('futureDateIsNotNegative', () => {
    expect(daysInStageLabel(open('2026-11-02T12:00:00Z'), now)).toBe('New in stage');
  });
});
