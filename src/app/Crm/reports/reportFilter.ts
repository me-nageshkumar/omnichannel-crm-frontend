import type { ReportFilter } from '@app/api/crm';

export type Preset = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'custom';

export const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last90', label: 'Last 90 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisQuarter', label: 'This quarter' },
  { key: 'custom', label: 'Custom range' },
];
export const DEFAULT_PRESET: Preset = 'last90';
/** The longest range a report may cover, in days (the server enforces the same). */
export const MAX_RANGE_DAYS = 731;
export const RANGE_TOO_LONG = 'Pick a range of at most two years.';

/** A half-open range of instants: {@code from} inclusive, {@code to} exclusive, both at a day's start in the zone. */
export interface DateRange {
  from: Date;
  to: Date;
}

/** The filter as the page keeps it (and the URL carries it). Dates are yyyy-MM-dd and belong to the custom preset. */
export interface ReportState {
  preset: Preset;
  from?: string;
  to?: string;
  pipelineId: string;
  numbers: string[];
  ownerId: string;
}

interface Ymd {
  y: number;
  /** 1–12 */
  m: number;
  d: number;
}

const DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** The wall-clock reading of {@code instant} in {@code tz}. */
function zoned(instant: Date, tz: string): Ymd & { h: number; min: number; s: number } {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(instant)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, min: p.minute, s: p.second };
}

/** The instant at which the day {@code day} starts in {@code tz}. */
export function zonedMidnight(day: Ymd, tz: string): Date {
  const wanted = Date.UTC(day.y, day.m - 1, day.d);
  let t = wanted;
  // Correct the UTC guess by the zone's offset at that instant; twice, since the offset may change across the correction.
  for (let i = 0; i < 2; i++) {
    const z = zoned(new Date(t), tz);
    t -= Date.UTC(z.y, z.m - 1, z.d, z.h, z.min, z.s) - wanted;
  }
  return new Date(t);
}

function shiftDays(day: Ymd, days: number): Ymd {
  const d = new Date(Date.UTC(day.y, day.m - 1, day.d + days));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function firstOfMonth(day: Ymd, monthsBack = 0): Ymd {
  const d = new Date(Date.UTC(day.y, day.m - 1 - monthsBack, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: 1 };
}

function parseYmd(s: string | undefined): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const day = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const check = new Date(Date.UTC(day.y, day.m - 1, day.d));
  const valid = check.getUTCFullYear() === day.y && check.getUTCMonth() + 1 === day.m && check.getUTCDate() === day.d;
  return valid ? day : null;
}

const dayNumber = (day: Ymd) => Date.UTC(day.y, day.m - 1, day.d) / DAY;

/** Why a custom range can't be used, or null when it can. */
export function customRangeError(custom: { from: string; to: string }): string | null {
  if (!custom.from || !custom.to) return 'Pick both dates.';
  const from = parseYmd(custom.from);
  const to = parseYmd(custom.to);
  if (!from || !to) return 'Enter the dates as yyyy-mm-dd.';
  if (dayNumber(from) > dayNumber(to)) return 'The start must not be after the end.';
  if (dayNumber(to) - dayNumber(from) + 1 > MAX_RANGE_DAYS) return RANGE_TOO_LONG;
  return null;
}

/**
 * The instants a preset covers as of {@code now}, day-aligned in {@code tz}: "Last N days" ends at the start of
 * tomorrow and includes today; the custom range includes its last day. Null when the custom range is unusable.
 */
export function rangeOf(
  preset: Preset,
  now: Date,
  tz: string,
  custom?: { from: string; to: string },
): DateRange | null {
  const today = zoned(now, tz);
  const tomorrow = zonedMidnight(shiftDays(today, 1), tz);
  const at = (day: Ymd) => zonedMidnight(day, tz);
  switch (preset) {
    case 'last7':
      return { from: at(shiftDays(today, -6)), to: tomorrow };
    case 'last30':
      return { from: at(shiftDays(today, -29)), to: tomorrow };
    case 'last90':
      return { from: at(shiftDays(today, -89)), to: tomorrow };
    case 'thisMonth':
      return { from: at(firstOfMonth(today)), to: tomorrow };
    case 'lastMonth':
      return { from: at(firstOfMonth(today, 1)), to: at(firstOfMonth(today)) };
    case 'thisQuarter':
      return { from: at({ y: today.y, m: Math.floor((today.m - 1) / 3) * 3 + 1, d: 1 }), to: tomorrow };
    case 'custom': {
      if (!custom || customRangeError(custom)) return null;
      const from = parseYmd(custom.from)!;
      const to = parseYmd(custom.to)!;
      return { from: at(from), to: at(shiftDays(to, 1)) };
    }
  }
}

const monthName = (day: Ymd) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(day.y, day.m - 1, 15)),
  );

/** "1 Aug – 29 Oct 2026", "20 Dec 2025 – 5 Jan 2026", "1 – 15 Oct 2026" or "29 Oct 2026": the days the range covers. */
export function periodLabel(range: DateRange, tz: string): string {
  const a = zoned(range.from, tz);
  const b = zoned(new Date(range.to.getTime() - 1), tz);
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.d} ${monthName(a)} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} ${monthName(b)} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${monthName(a)} – ${b.d} ${monthName(b)} ${b.y}`;
  return `${a.d} ${monthName(a)} ${a.y} – ${b.d} ${monthName(b)} ${b.y}`;
}

const isPreset = (s: string | null): s is Preset => PRESETS.some((p) => p.key === s);

/** The filter the URL describes; what it leaves out comes from {@code defaults}. */
export function fromSearch(params: URLSearchParams, defaults: { pipelineId: string }): ReportState {
  const range = params.get('range');
  const preset = isPreset(range) ? range : DEFAULT_PRESET;
  const state: ReportState = {
    preset,
    pipelineId: params.get('pipelineId') || defaults.pipelineId,
    numbers: (params.get('numbers') ?? '').split(',').filter(Boolean),
    ownerId: params.get('owner') ?? '',
  };
  if (preset === 'custom') {
    if (params.has('from')) state.from = params.get('from') ?? '';
    if (params.has('to')) state.to = params.get('to') ?? '';
  }
  return state;
}

/** The query string of a filter: every field that is set, in a fixed order. */
export function toSearch(state: ReportState): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set('range', state.preset);
  if (state.preset === 'custom') {
    if (state.from) sp.set('from', state.from);
    if (state.to) sp.set('to', state.to);
  }
  if (state.pipelineId) sp.set('pipelineId', state.pipelineId);
  if (state.numbers.length) sp.set('numbers', state.numbers.join(','));
  if (state.ownerId) sp.set('owner', state.ownerId);
  return sp;
}

/** The request body of a filter; an unusable custom range falls back to the default preset. */
export function bodyOf(state: ReportState, tz: string, now: Date = new Date()): ReportFilter {
  const custom = { from: state.from ?? '', to: state.to ?? '' };
  const range = rangeOf(state.preset, now, tz, custom) ?? rangeOf(DEFAULT_PRESET, now, tz)!;
  const body: ReportFilter = {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    tz,
    pipelineId: state.pipelineId,
  };
  if (state.numbers.length) body.phoneNumberIds = state.numbers;
  if (state.ownerId) body.ownerIds = [state.ownerId];
  return body;
}
