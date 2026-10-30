import { describe, expect, it } from 'vitest';
import {
  MAX_RANGE_DAYS,
  PRESETS,
  type ReportState,
  bodyOf,
  customRangeError,
  fromSearch,
  periodLabel,
  rangeOf,
  toSearch,
} from '@app/Crm/reports/reportFilter';

const TZ = 'Asia/Kolkata';
const NOW = new Date('2026-10-30T10:00:00Z');
const iso = (d: Date) => d.toISOString();
const DAY = 86_400_000;

describe('report filter', () => {
  it('presetLabels', () => {
    expect(PRESETS.map((p) => p.label)).toEqual([
      'Last 7 days',
      'Last 30 days',
      'Last 90 days',
      'This month',
      'Last month',
      'This quarter',
      'Custom range',
    ]);
    expect(MAX_RANGE_DAYS).toBe(731);
  });

  it('last7IsDayAlignedInZone', () => {
    const r = rangeOf('last7', NOW, TZ)!;
    expect(iso(r.from)).toBe('2026-10-23T18:30:00.000Z'); // 24 Oct 00:00 +05:30
    expect(iso(r.to)).toBe('2026-10-30T18:30:00.000Z'); // 31 Oct 00:00 +05:30
    expect(rangeOf('last30', NOW, TZ)!.from.getTime()).toBe(r.to.getTime() - 30 * DAY);
    expect(rangeOf('last90', NOW, TZ)!.from.getTime()).toBe(r.to.getTime() - 90 * DAY);
  });

  it('thisMonthAndLastMonth', () => {
    const month = rangeOf('thisMonth', NOW, TZ)!;
    expect(iso(month.from)).toBe('2026-09-30T18:30:00.000Z');
    expect(iso(month.to)).toBe('2026-10-30T18:30:00.000Z');
    const last = rangeOf('lastMonth', NOW, TZ)!;
    expect(iso(last.from)).toBe('2026-08-31T18:30:00.000Z');
    expect(iso(last.to)).toBe('2026-09-30T18:30:00.000Z');
    // January's last month is December of the year before.
    const jan = rangeOf('lastMonth', new Date('2026-01-10T10:00:00Z'), TZ)!;
    expect(iso(jan.from)).toBe('2025-11-30T18:30:00.000Z');
    expect(iso(jan.to)).toBe('2025-12-31T18:30:00.000Z');
  });

  it('thisQuarter', () => {
    const q = rangeOf('thisQuarter', new Date('2026-11-15T10:00:00Z'), TZ)!;
    expect(iso(q.from)).toBe('2026-09-30T18:30:00.000Z');
    expect(iso(q.to)).toBe('2026-11-15T18:30:00.000Z');
  });

  it('dstChangeKeepsMidnights', () => {
    // New York left daylight time on 1 Nov 2026: the two ends have different offsets.
    const r = rangeOf('last7', new Date('2026-11-05T12:00:00Z'), 'America/New_York')!;
    expect(iso(r.from)).toBe('2026-10-30T04:00:00.000Z');
    expect(iso(r.to)).toBe('2026-11-06T05:00:00.000Z');
  });

  it('customRangeInclusiveOfToDay', () => {
    const r = rangeOf('custom', NOW, TZ, { from: '2026-08-01', to: '2026-10-29' })!;
    expect(iso(r.from)).toBe('2026-07-31T18:30:00.000Z');
    expect(iso(r.to)).toBe('2026-10-29T18:30:00.000Z');
    expect(periodLabel(r, TZ)).toBe('1 Aug – 29 Oct 2026');
    expect(periodLabel(rangeOf('custom', NOW, TZ, { from: '2025-12-20', to: '2026-01-05' })!, TZ)).toBe(
      '20 Dec 2025 – 5 Jan 2026',
    );
    expect(periodLabel(rangeOf('custom', NOW, TZ, { from: '2026-10-29', to: '2026-10-29' })!, TZ)).toBe('29 Oct 2026');
  });

  it('customOverMaxIsNull', () => {
    expect(rangeOf('custom', NOW, TZ, { from: '2024-01-01', to: '2025-12-31' })).not.toBeNull(); // 731 days
    expect(rangeOf('custom', NOW, TZ, { from: '2024-01-01', to: '2026-01-01' })).toBeNull(); // 732 days
    expect(rangeOf('custom', NOW, TZ, { from: '2026-10-29', to: '2026-10-01' })).toBeNull();
    expect(rangeOf('custom', NOW, TZ, { from: '2026-13-01', to: '2026-10-01' })).toBeNull();
    expect(rangeOf('custom', NOW, TZ)).toBeNull();
    expect(customRangeError({ from: '2024-01-01', to: '2026-01-01' })).toBe('Pick a range of at most two years.');
    expect(customRangeError({ from: '2026-10-29', to: '2026-10-01' })).toBe('The start must not be after the end.');
    expect(customRangeError({ from: '', to: '2026-10-01' })).toBe('Pick both dates.');
    expect(customRangeError({ from: '2026-08-01', to: '2026-10-29' })).toBeNull();
  });

  it('urlRoundTrip', () => {
    const state: ReportState = {
      preset: 'custom',
      from: '2026-08-01',
      to: '2026-10-29',
      pipelineId: 'p2',
      numbers: ['n1', 'n2'],
      ownerId: 'u9',
    };
    const params = toSearch(state);
    expect(params.toString()).toBe('range=custom&from=2026-08-01&to=2026-10-29&pipelineId=p2&numbers=n1%2Cn2&owner=u9');
    expect(fromSearch(params, { pipelineId: 'p1' })).toEqual(state);
    expect(fromSearch(new URLSearchParams(''), { pipelineId: 'p1' })).toEqual({
      preset: 'last90',
      pipelineId: 'p1',
      numbers: [],
      ownerId: '',
    });
    expect(fromSearch(new URLSearchParams('range=bogus&numbers='), { pipelineId: 'p1' }).preset).toBe('last90');
    expect(toSearch({ preset: 'last7', pipelineId: 'p1', numbers: [], ownerId: '' }).toString()).toBe(
      'range=last7&pipelineId=p1',
    );
  });

  it('bodyOfSendsIsoAndZone', () => {
    expect(bodyOf({ preset: 'last7', pipelineId: 'p1', numbers: ['n1'], ownerId: 'u9' }, TZ, NOW)).toEqual({
      from: '2026-10-23T18:30:00.000Z',
      to: '2026-10-30T18:30:00.000Z',
      tz: TZ,
      pipelineId: 'p1',
      phoneNumberIds: ['n1'],
      ownerIds: ['u9'],
    });
    const plain = bodyOf({ preset: 'last90', pipelineId: 'p1', numbers: [], ownerId: '' }, TZ, NOW);
    expect(plain).not.toHaveProperty('phoneNumberIds');
    expect(plain).not.toHaveProperty('ownerIds');
  });
});
