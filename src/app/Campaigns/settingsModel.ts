import { CampaignSettings, RECOMMENDED_SETTINGS } from '@app/api/campaigns';

/** The recommended values; the form warns on pacing fields set looser than these. */
export const RECOMMENDED = RECOMMENDED_SETTINGS;

/** The cap the recommended warm-up table allows from day {@code d}. */
function recommendedCapAt(d: number): number {
  let cap = Infinity;
  for (const row of RECOMMENDED.warmupCaps) {
    if (row.fromDay <= d) cap = row.cap;
  }
  return cap;
}

const LOWER_IS_LOOSER = [
  'gapMinSeconds',
  'gapMaxSeconds',
  'skipGapMinSeconds',
  'skipGapMaxSeconds',
  'restDays',
  'recontactDays',
] as const;
const HIGHER_IS_LOOSER = ['hourlyCap', 'matureCap', 'healthyCap'] as const;

/** The pacing fields set looser than recommended; the working window never warns. */
export function looserFields(s: CampaignSettings): Set<string> {
  const out = new Set<string>();
  for (const k of LOWER_IS_LOOSER) if (s[k] < RECOMMENDED[k]) out.add(k);
  for (const k of HIGHER_IS_LOOSER) if (s[k] > RECOMMENDED[k]) out.add(k);
  s.warmupCaps.forEach((row, i) => {
    if (row.cap > recommendedCapAt(row.fromDay)) out.add(`warmupCaps.${i}`);
  });
  const words = new Set(s.stopWords.map((w) => w.trim().toLowerCase()));
  if (RECOMMENDED.stopWords.some((w) => !words.has(w.trim().toLowerCase()))) out.add('stopWords');
  return out;
}

/** The timezones to offer: {@code current} first when the browser's list lacks it, then that list. */
export function timezoneOptions(current: string): string[] {
  const known = (Intl as unknown as { supportedValuesOf(key: 'timeZone'): string[] }).supportedValuesOf('timeZone');
  return known.includes(current) ? known : [current, ...known];
}
