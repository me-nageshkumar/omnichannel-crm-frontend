import { describe, expect, it } from 'vitest';
import { priceItems, requiresProblems, setGroupMode, toDraft, toInput } from '@app/Billing/platform/planDraft';
import { LIMIT_KEYS, SEEDED_GROUPS, plan } from '../../../test/billing';

describe('planDraft', () => {
  it('reads a plan into the form and back', () => {
    const draft = toDraft(plan(), SEEDED_GROUPS, LIMIT_KEYS);
    expect(draft.groups.crm).toEqual({ mode: 'INCLUDED', price: '1000' });
    expect(draft.groups.automations).toEqual({ mode: 'ADDON', price: '300' });
    expect(draft.groups.campaigns).toEqual({ mode: 'NONE', price: '' });
    expect(draft.groups.inbox).toBeUndefined(); // default groups are not sold
    expect(draft.limits.USERS).toEqual({ limit: '5', unitPrice: '100', unit: '5' });
    expect(draft.limits.BRANDS).toEqual({ limit: '', unitPrice: '', unit: '' });
    expect(draft.messageRate).toBe('0.05');

    expect(toInput(draft)).toEqual({
      code: 'gold-monthly',
      name: 'Gold',
      description: '',
      period: 'MONTHLY',
      rank: 2,
      items: [{ groupCode: 'crm', price: 1000 }],
      addOns: [{ groupCode: 'automations', price: 300 }],
      limits: { USERS: 5 },
      limitAddOns: [{ key: 'USERS', unitPrice: 100, unit: 5 }],
      discountPercent: 10,
      rates: { WHATSAPP_MESSAGE: 0.05 },
      offered: true,
    });
  });

  it('starts a new plan empty', () => {
    const draft = toDraft(null, SEEDED_GROUPS, LIMIT_KEYS);
    expect(draft.period).toBe('MONTHLY');
    expect(toInput(draft)).toMatchObject({
      items: [],
      addOns: [],
      limits: {},
      limitAddOns: [],
      rates: {},
      discountPercent: 0,
    });
  });

  it('leaves out what is blank or not available', () => {
    const draft = toDraft(plan(), SEEDED_GROUPS, LIMIT_KEYS);
    draft.limits.USERS = { limit: '', unitPrice: '100', unit: '5' };
    draft.limits.BRANDS = { limit: '3', unitPrice: '50', unit: '' };
    draft.messageRate = '';
    const input = toInput(setGroupMode(draft, 'automations', 'NONE'));
    expect(input.addOns).toEqual([]);
    expect(input.limits).toEqual({ BRANDS: 3 });
    // an extra-unit price needs both a price and a unit, and a limit to add to
    expect(input.limitAddOns).toEqual([]);
    expect(input.rates).toEqual({});
  });

  it('keeps a price when a group is switched off and on again', () => {
    const draft = toDraft(plan(), SEEDED_GROUPS, LIMIT_KEYS);
    const off = setGroupMode(draft, 'crm', 'NONE');
    expect(off.groups.crm).toEqual({ mode: 'NONE', price: '1000' });
    expect(priceItems(off)).toEqual([]);
    const on = setGroupMode(off, 'crm', 'ADDON');
    expect(on.groups.crm).toEqual({ mode: 'ADDON', price: '1000' });
    expect(priceItems(setGroupMode(on, 'crm', 'INCLUDED'))).toEqual([{ groupCode: 'crm', price: 1000 }]);
  });

  it('says which group another one needs', () => {
    const draft = toDraft(null, SEEDED_GROUPS, LIMIT_KEYS);
    expect(requiresProblems(draft, SEEDED_GROUPS)).toEqual({});
    const included = setGroupMode(draft, 'ai', 'INCLUDED');
    expect(requiresProblems(included, SEEDED_GROUPS)).toEqual({ ai: 'AI needs Chatbots to be included' });
    expect(requiresProblems(setGroupMode(included, 'chatbots', 'ADDON'), SEEDED_GROUPS)).toEqual({
      ai: 'AI needs Chatbots to be included',
    });
    expect(requiresProblems(setGroupMode(included, 'chatbots', 'INCLUDED'), SEEDED_GROUPS)).toEqual({});
    const offered = setGroupMode(draft, 'ai', 'ADDON');
    expect(requiresProblems(offered, SEEDED_GROUPS)).toEqual({
      ai: 'AI needs Chatbots to be included or offered as an add-on',
    });
    expect(requiresProblems(setGroupMode(offered, 'chatbots', 'ADDON'), SEEDED_GROUPS)).toEqual({});
  });
});
