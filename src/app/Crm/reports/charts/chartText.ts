/** Number and date wording for chart ticks and labels. */

/** 950 → "950", 1,200 → "1.2k", 3,400,000 → "3.4M". */
export function compact(n: number): string {
  const abs = Math.abs(n);
  const trim = (v: number) => String(Number(v.toFixed(1)));
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}k`;
  return String(Number(n.toFixed(1)));
}

/** "24 Oct" */
export const day = (d: Date): string => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** "w/c 20 Oct" */
export const week = (d: Date): string => `w/c ${day(d)}`;

/** "Oct 2026" */
export const month = (d: Date): string => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/** A label cut to {@code max} characters with an ellipsis. */
export function clip(label: string, max = 18): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** Round tick values: at most five, on clean steps (1, 2, 5 × 10ⁿ), ending at or above the maximum. */
export function ticks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** The series slot's colour variable, 1-based; past 8 the caller folds into "Other". */
export const seriesColor = (slot: number): string => `var(--crm-series-${Math.min(Math.max(slot, 1), 8)})`;
