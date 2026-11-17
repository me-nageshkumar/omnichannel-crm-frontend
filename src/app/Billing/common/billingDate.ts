const DAY_MS = 24 * 60 * 60 * 1000;

function formatter(zone: string): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: zone });
  } catch {
    // a zone this browser does not know: the date as UTC has it
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' });
  }
}

/**
 * A term date as "1 Oct 2026". Term dates are instants at midnight in the billing zone, so they are shown in that
 * zone, never the browser's. `minusDays` steps back whole days: a term's end is the first moment after its last day,
 * so the last day is the end minus one.
 */
export function billingDate(iso: string, zone: string, minusDays = 0): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // noon in the zone, so a daylight-saving shift cannot move the day
  return formatter(zone).format(new Date(d.getTime() - minusDays * DAY_MS));
}

/** Today's date in the zone, as an ISO local date (for a date input's default). */
export function todayIn(zone: string, now: Date = new Date()): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The ISO local date an instant falls on in the zone: a term's first day, or the day after its last. */
export function localDateIn(iso: string, zone: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : todayIn(zone, d);
}
