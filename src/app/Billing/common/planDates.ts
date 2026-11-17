import { billingDate } from '@app/Billing/common/billingDate';
import type { Subscription } from '@app/api/billing';

/** An ISO local date `months` later on the same day of the month, or that month's last day when it is shorter. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(day)}`;
}

/** "1 Dec 2026 – 31 Dec 2026": the first and the last day of the term. */
export function termText(s: Pick<Subscription, 'termStart' | 'termEnd' | 'zone'>): string {
  if (!s.termStart || !s.termEnd) return '';
  return `${billingDate(s.termStart, s.zone)} – ${billingDate(s.termEnd, s.zone, 1)}`;
}

/** What the dates mean for the customer now; "" when there is nothing to add. */
export function stateText(s: Pick<Subscription, 'state' | 'termEnd' | 'graceEnd' | 'zone'>): string {
  if (s.state === 'GRACE' && s.graceEnd) return `The plan has ended. Read-only from ${billingDate(s.graceEnd, s.zone)}`;
  if (s.state === 'EXPIRED' && s.graceEnd) return `Read-only since ${billingDate(s.graceEnd, s.zone)}`;
  return '';
}
