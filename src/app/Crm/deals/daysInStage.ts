import type { Deal } from '@app/api/crm';

const DAY_MS = 86_400_000;

/** "New in stage" or "5d in stage" for an open deal; null for a closed one or without a usable date. */
export function daysInStageLabel(deal: Pick<Deal, 'status' | 'stageEnteredAt'>, now: Date = new Date()): string | null {
  if (deal.status !== 'OPEN' || !deal.stageEnteredAt) return null;
  const entered = new Date(deal.stageEnteredAt).getTime();
  if (Number.isNaN(entered)) return null;
  const days = Math.floor((now.getTime() - entered) / DAY_MS);
  return days < 1 ? 'New in stage' : `${days}d in stage`;
}
