import { describe, expect, it } from 'vitest';
import { sampleChecklist, sampleRecurrence, sampleTask } from '../../../test/crm';
import {
  canWorkTask,
  checklistProgress,
  isDelegatedToMe,
  recurrenceFromForm,
  recurrenceSummary,
  recurrenceToForm,
  weekdayOf,
} from './taskDisplay';
import type { RepeatForm } from './taskDisplay';

const form = (over: Partial<RepeatForm> = {}): RepeatForm => ({
  frequency: 'WEEKLY',
  interval: '2',
  weekdays: ['THURSDAY', 'MONDAY'],
  ends: 'NEVER',
  count: '',
  until: '',
  ...over,
});

describe('task display helpers (phase E)', () => {
  it('progressCountsDone', () => {
    expect(checklistProgress(sampleTask({ checklist: sampleChecklist() }))).toEqual({ done: 1, total: 3 });
    expect(checklistProgress(sampleTask())).toEqual({ done: 0, total: 0 });
  });

  it('delegatedToMeNeedsAnotherAssigner', () => {
    const me = 'u4';
    expect(isDelegatedToMe(sampleTask({ assignedBy: { id: 'u2', name: 'Priya Agent' } }), me)).toBe(true);
    expect(isDelegatedToMe(sampleTask({ assignedBy: { id: 'u4', name: 'Meera Manager' } }), me)).toBe(false);
    expect(isDelegatedToMe(sampleTask({ assignedBy: null }), me)).toBe(false);
    expect(isDelegatedToMe(sampleTask({ assignedBy: { id: 'u2', name: null } }), 'u9')).toBe(false);
  });

  it('canWorkForAssigneeOrEditor', () => {
    expect(canWorkTask(sampleTask(), false, 'u4')).toBe(true);
    expect(canWorkTask(sampleTask(), false, 'u9')).toBe(false);
    expect(canWorkTask(sampleTask(), true, 'u9')).toBe(true);
    expect(canWorkTask(sampleTask(), false, undefined)).toBe(false);
  });

  it('summaryReadsTheRule', () => {
    expect(recurrenceSummary(null)).toBe('');
    expect(recurrenceSummary(sampleRecurrence({ frequency: 'DAILY', interval: 1 }))).toBe('Repeats daily');
    expect(
      recurrenceSummary(sampleRecurrence({ frequency: 'WEEKLY', interval: 2, weekdays: ['MONDAY', 'THURSDAY'] })),
    ).toBe('Repeats every 2 weeks on Mon, Thu');
    expect(recurrenceSummary(sampleRecurrence({ frequency: 'MONTHLY', interval: 1, dayOfMonth: 31 }))).toBe(
      'Repeats monthly on day 31',
    );
    expect(recurrenceSummary(sampleRecurrence({ frequency: 'DAILY', interval: 3, endsOn: '2026-12-31' }))).toBe(
      'Repeats every 3 days until 31 Dec 2026',
    );
    expect(recurrenceSummary(sampleRecurrence({ frequency: 'DAILY', interval: 1, endsAfter: 6 }))).toBe(
      'Repeats daily, 6 times',
    );
  });

  it('fromFormKeepsStoredZoneAndDayOfMonth', () => {
    const existing = sampleRecurrence({ frequency: 'MONTHLY', interval: 1, dayOfMonth: 31, timeZone: 'Asia/Kolkata' });
    const rule = recurrenceFromForm(
      form({ frequency: 'MONTHLY', interval: '1', weekdays: [] }),
      '2026-02-28T09:00:00.000Z',
      'Europe/London',
      existing,
    );
    expect(rule).toEqual({
      frequency: 'MONTHLY',
      interval: 1,
      weekdays: null,
      dayOfMonth: 31,
      timeZone: 'Asia/Kolkata',
      endsAfter: null,
      endsOn: null,
    });
  });

  it('fromFormTakesDayOfMonthFromDueOnCreate', () => {
    const due = new Date(2026, 0, 31, 9, 0).toISOString();
    const rule = recurrenceFromForm(form({ frequency: 'MONTHLY', interval: '1' }), due, 'Europe/London', null);
    expect(rule?.dayOfMonth).toBe(31);
    expect(rule?.timeZone).toBe('Europe/London');
    expect(recurrenceFromForm(form({ frequency: 'NONE' }), due, 'UTC', null)).toBeNull();
    const weekly = recurrenceFromForm(form({ ends: 'AFTER', count: '6' }), due, 'UTC', null);
    expect(weekly).toEqual({
      frequency: 'WEEKLY',
      interval: 2,
      weekdays: ['MONDAY', 'THURSDAY'],
      dayOfMonth: null,
      timeZone: 'UTC',
      endsAfter: 6,
      endsOn: null,
    });
    expect(recurrenceFromForm(form({ ends: 'ON', until: '2026-12-31' }), due, 'UTC', null)?.endsOn).toBe('2026-12-31');
  });

  it('toFormRoundTrips', () => {
    expect(recurrenceToForm(null)).toEqual(form({ frequency: 'NONE', interval: '1', weekdays: [] }));
    const rule = sampleRecurrence({ frequency: 'WEEKLY', interval: 2, weekdays: ['MONDAY', 'THURSDAY'], endsAfter: 6 });
    expect(recurrenceToForm(rule)).toEqual(form({ weekdays: ['MONDAY', 'THURSDAY'], ends: 'AFTER', count: '6' }));
    expect(recurrenceToForm(sampleRecurrence({ endsOn: '2026-12-31' }))).toMatchObject({
      ends: 'ON',
      until: '2026-12-31',
    });
  });

  it('weekdayOfLocalDate', () => {
    expect(weekdayOf(new Date(2026, 10, 5, 9, 0).toISOString())).toBe('THURSDAY'); // 5 Nov 2026
    expect(weekdayOf(new Date(2026, 10, 8, 9, 0).toISOString())).toBe('SUNDAY');
  });
});
