import type { BillingPeriod, FeatureGroup, LimitKeyInfo, Plan, PlanInput, PlanItem } from '@app/api/billing';

/** How a plan treats a paid feature group. */
export type GroupMode = 'INCLUDED' | 'ADDON' | 'NONE';

export const MESSAGE_METER = 'WHATSAPP_MESSAGE';

/** The plan editor's form: every number is the text the person typed, so a half-typed value is not lost. */
export interface PlanDraft {
  code: string;
  name: string;
  description: string;
  period: BillingPeriod;
  rank: string;
  offered: boolean;
  discountPercent: string;
  /** By paid group code. A group switched to NONE keeps its price in case it is switched back. */
  groups: Record<string, { mode: GroupMode; price: string }>;
  /** By limit key: the limit (blank = unlimited) and the price of `unit` extra. */
  limits: Record<string, { limit: string; unitPrice: string; unit: string }>;
  /** Rupees per WhatsApp message sent; blank = free. */
  messageRate: string;
}

const text = (n: number | undefined | null) => (n === undefined || n === null ? '' : String(n));
const filled = (s: string) => s.trim() !== '' && !Number.isNaN(Number(s));

export function toDraft(plan: Plan | null, groups: FeatureGroup[], limitKeys: LimitKeyInfo[]): PlanDraft {
  const draft: PlanDraft = {
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    period: plan?.period ?? 'MONTHLY',
    rank: text(plan?.rank ?? 1),
    offered: plan?.offered ?? true,
    discountPercent: text(plan?.discountPercent ?? 0),
    groups: {},
    limits: {},
    messageRate: text(plan?.rates?.[MESSAGE_METER]),
  };
  groups
    .filter((g) => g.category === 'PAID')
    .forEach((g) => {
      const item = plan?.items.find((i) => i.groupCode === g.code);
      const addOn = plan?.addOns.find((i) => i.groupCode === g.code);
      draft.groups[g.code] = item
        ? { mode: 'INCLUDED', price: text(item.price) }
        : addOn
          ? { mode: 'ADDON', price: text(addOn.price) }
          : { mode: 'NONE', price: '' };
    });
  limitKeys.forEach((k) => {
    const extra = plan?.limitAddOns.find((a) => a.key === k.key);
    draft.limits[k.key] = {
      limit: text(plan?.limits[k.key]),
      unitPrice: text(extra?.unitPrice),
      unit: text(extra?.unit),
    };
  });
  return draft;
}

export function setGroupMode(draft: PlanDraft, code: string, mode: GroupMode): PlanDraft {
  const current = draft.groups[code] ?? { mode: 'NONE' as GroupMode, price: '' };
  return { ...draft, groups: { ...draft.groups, [code]: { ...current, mode } } };
}

const itemsIn = (draft: PlanDraft, mode: GroupMode): PlanItem[] =>
  Object.keys(draft.groups)
    .filter((code) => draft.groups[code].mode === mode)
    .map((code) => ({ groupCode: code, price: Number(draft.groups[code].price || 0) }));

/** The included groups with their prices: what the plan's price is made of. */
export const priceItems = (draft: PlanDraft): PlanItem[] => itemsIn(draft, 'INCLUDED');

/** What is sent to the server. Blank limits, extra-unit prices and rates are left out. */
export function toInput(draft: PlanDraft): PlanInput {
  const limits: Record<string, number> = {};
  const limitAddOns: PlanInput['limitAddOns'] = [];
  Object.keys(draft.limits).forEach((key) => {
    const row = draft.limits[key];
    if (!filled(row.limit)) return;
    limits[key] = Number(row.limit);
    if (filled(row.unitPrice) && filled(row.unit)) {
      limitAddOns.push({ key, unitPrice: Number(row.unitPrice), unit: Number(row.unit) });
    }
  });
  const rates: Record<string, number> = {};
  if (filled(draft.messageRate)) rates[MESSAGE_METER] = Number(draft.messageRate);
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    period: draft.period,
    rank: Number(draft.rank || 0),
    items: itemsIn(draft, 'INCLUDED'),
    addOns: itemsIn(draft, 'ADDON'),
    limits,
    limitAddOns,
    discountPercent: Number(draft.discountPercent || 0),
    rates,
    offered: draft.offered,
  };
}

/** By group code: which group it needs that the plan does not have in the right place. */
export function requiresProblems(draft: PlanDraft, groups: FeatureGroup[]): Record<string, string> {
  const problems: Record<string, string> = {};
  const modeOf = (code: string) => draft.groups[code]?.mode ?? 'NONE';
  groups.forEach((g) => {
    const mode = modeOf(g.code);
    if (g.category !== 'PAID' || mode === 'NONE') return;
    for (const needs of g.requires) {
      const needed = groups.find((x) => x.code === needs);
      if (!needed || needed.category !== 'PAID') continue;
      const has = modeOf(needs);
      if (mode === 'INCLUDED' && has !== 'INCLUDED') {
        problems[g.code] = `${g.name} needs ${needed.name} to be included`;
        return;
      }
      if (mode === 'ADDON' && has === 'NONE') {
        problems[g.code] = `${g.name} needs ${needed.name} to be included or offered as an add-on`;
        return;
      }
    }
  });
  return problems;
}

/**
 * What is missing where something was started: a rank, the price of a group the plan sells, or half of an extra-unit
 * price. Keys are `rank`, `group:<code>` and `limit:<key>`. A blank is never sent as 0 and a half-typed row is never
 * dropped without a word.
 */
export function fieldProblems(
  draft: PlanDraft,
  groups: FeatureGroup[],
  limitKeys: LimitKeyInfo[],
): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!filled(draft.rank)) problems.rank = 'Enter a rank';
  groups.forEach((g) => {
    const row = draft.groups[g.code];
    if (g.category === 'PAID' && row && row.mode !== 'NONE' && !filled(row.price)) {
      problems[`group:${g.code}`] = `Enter a price for ${g.name} (0 if it is free)`;
    }
  });
  limitKeys.forEach((k) => {
    const row = draft.limits[k.key];
    if (!row) return;
    const price = filled(row.unitPrice);
    const unit = filled(row.unit);
    if (!price && !unit) return;
    if (!filled(row.limit)) problems[`limit:${k.key}`] = `Extra ${k.label} need a limit to add to`;
    else if (!unit) problems[`limit:${k.key}`] = `Enter how many extra ${k.label} the price buys`;
    else if (!price) problems[`limit:${k.key}`] = `Enter the price of extra ${k.label}`;
  });
  return problems;
}
