import { describe, expect, it } from 'vitest';
import type { AutomationAction, AutomationOptions, ConditionGroup } from '@app/api/automations';
import { OPTIONS } from '../../test/automations';
import {
  FIELDS,
  MAX_CONDITIONS,
  MAX_DEPTH,
  MESSAGE_KINDS,
  actionSummary,
  addTo,
  agentBlindNumbers,
  choicesFor,
  conditionErrors,
  conditionText,
  countRules,
  depth,
  emptyRule,
  newGroup,
  newLeaf,
  nodeAt,
  pruneConditions,
  removeAt,
  replaceAt,
  rulePath,
} from './automationModel';

const ALL_KINDS = MESSAGE_KINDS.map((k) => k.kind);

describe('field catalogue', () => {
  it('fieldsFollowTheContract', () => {
    const message = FIELDS.MESSAGE_RECEIVED;
    expect(message).toHaveLength(6);
    for (const f of [...message, ...FIELDS.DEAL_LANE_CHANGED]) expect(f.description).not.toBe('');
    const by = (list: typeof message, field: string) => list.find((f) => f.field === field)!;
    expect(by(message, 'message.type').operators).toEqual(['is_one_of']);
    expect(by(message, 'message.text').operators).toContain('ends_with');
    const amount = by(FIELDS.DEAL_LANE_CHANGED, 'deal.amount');
    expect(amount.operators).toEqual(expect.arrayContaining(['between', 'at_least', 'at_most']));
    expect(MESSAGE_KINDS).toHaveLength(9);
    expect(MAX_DEPTH).toBe(3);
    expect(MAX_CONDITIONS).toBe(30);
  });

  it('choicesListLanesWithPipeline', () => {
    expect(choicesFor('toLane', OPTIONS)).toContainEqual({ value: 's3', label: 'Sales › Won' });
    expect(choicesFor('number', OPTIONS)[0]).toEqual({ value: 'n1', label: 'Main line' });
    expect(choicesFor('toLane.type', OPTIONS).map((c) => c.value)).toEqual(['OPEN', 'WON', 'LOST']);
    expect(choicesFor('deal.owner', OPTIONS)[0]).toEqual({ value: 'u1', label: 'Demo Agent' });
  });

  it('builds new nodes and an empty rule', () => {
    expect(newLeaf('MESSAGE_RECEIVED')).toEqual({ field: 'chat.new', operator: 'is', value: true });
    expect(newLeaf('DEAL_LANE_CHANGED')).toEqual({ field: 'toLane', operator: 'is', value: [] });
    expect(newGroup()).toEqual({ combinator: 'and', not: false, rules: [] });
    expect(emptyRule()).toMatchObject({
      name: '',
      event: 'MESSAGE_RECEIVED',
      priority: null,
      conditions: null,
      actions: [],
    });
  });
});

describe('tree helpers', () => {
  const leaf = newLeaf('MESSAGE_RECEIVED');
  it('adds, finds, replaces, removes and counts', () => {
    let root = addTo(newGroup(), [], leaf);
    root = addTo(root, [], { ...newGroup(), rules: [leaf] });
    expect(countRules(root)).toBe(2);
    expect(depth(root)).toBe(2);
    expect(nodeAt(root, [1, 0])).toEqual(leaf);
    expect(rulePath([1, 0])).toBe('rules[1].rules[0]');
    const next = replaceAt(root, [0], { field: 'contact.inCrm', operator: 'is', value: false });
    expect(nodeAt(next, [0])).toMatchObject({ field: 'contact.inCrm' });
    expect(removeAt(root, [1, 0]).rules).toHaveLength(1);
  });
});

describe('pruneConditions', () => {
  const kinds = (value: string[]): ConditionGroup => ({
    combinator: 'and',
    not: false,
    rules: [{ field: 'message.type', operator: 'is_one_of', value }],
  });
  it('pruneDropsAllKinds', () => {
    expect(pruneConditions(kinds(ALL_KINDS))).toBeNull();
    expect(pruneConditions(kinds(['TEXT', 'PHOTO']))).toEqual(kinds(['TEXT', 'PHOTO']));
    expect(pruneConditions(null)).toBeNull();
  });
  it('removes groups left empty and keeps other rules', () => {
    const root: ConditionGroup = {
      combinator: 'or',
      not: false,
      rules: [kinds(ALL_KINDS), { field: 'chat.new', operator: 'is', value: true }],
    };
    expect(pruneConditions(root)).toEqual({
      combinator: 'or',
      not: false,
      rules: [{ field: 'chat.new', operator: 'is', value: true }],
    });
  });
});

describe('conditionErrors', () => {
  it('conditionErrorsSplit', () => {
    const e = conditionErrors({
      'conditions.rules[0].value': 'is required',
      'conditions.rules[1].rules[0].operator': 'is not allowed',
      'actions[1].templateId': 'The template is archived',
      'actions[0].values.order_id': 'is required',
      name: 'is required',
      priority: 'must be positive',
    });
    expect(e.byPath['rules[0]']).toBe('is required');
    expect(e.byPath['rules[1].rules[0]']).toBe('is not allowed');
    expect(e.byAction[1].templateId).toBe('The template is archived');
    expect(e.byAction[0]['values.order_id']).toBe('is required');
    expect(e.other).toEqual(['is required', 'priority: must be positive']);
  });
});

describe('conditionText', () => {
  it('conditionTextReadsPlainly', () => {
    expect(conditionText({ field: 'message.type', operator: 'is_one_of', value: ['TEXT', 'PHOTO'] }, OPTIONS)).toBe(
      'Message type is one of Text, Photo',
    );
    expect(conditionText({ field: 'chat.new', operator: 'is', value: true }, OPTIONS)).toBe('Chat is new');
    expect(conditionText({ field: 'contact.inCrm', operator: 'is', value: false }, OPTIONS)).toBe(
      'Contact is not in the CRM',
    );
    expect(conditionText({ field: 'deal.amount', operator: 'between', value: [1000, 5000] }, OPTIONS)).toBe(
      'Deal amount between 1000 and 5000',
    );
    expect(conditionText({ field: 'message.text', operator: 'contains', value: 'price' }, OPTIONS)).toBe(
      'Message text contains “price”',
    );
    expect(conditionText({ field: 'message.text', operator: 'is_empty', value: null }, OPTIONS)).toBe(
      'Message text is empty',
    );
    expect(conditionText({ field: 'toLane', operator: 'is', value: ['s3'] }, OPTIONS)).toBe(
      'Moved into lane is Sales › Won',
    );
  });
});

describe('actionSummary', () => {
  it('actionSummaryMatchesServer', () => {
    const s = (a: AutomationAction) => actionSummary(a, OPTIONS);
    expect(s({ type: 'SEND_TEMPLATE', templateId: 'tp1' })).toBe('Send “Welcome”');
    expect(s({ type: 'ASSIGN_CHAT', mode: 'AGENT', userId: 'u1' })).toBe('Assign to Demo Agent');
    expect(s({ type: 'ASSIGN_CHAT', mode: 'TEAM_QUEUE', teamId: 't1' })).toBe('Queue in Support');
    expect(s({ type: 'ASSIGN_CHAT', mode: 'TEAM_ROUND_ROBIN', teamId: 't1' })).toBe('Round robin in Support');
    expect(s({ type: 'ADD_TO_CRM', pipelineId: 'p1', stageId: 's1' })).toBe('Add to CRM (Sales › New)');
    expect(s({ type: 'ADD_TO_CRM', pipelineId: null, stageId: null })).toBe('Add to CRM (default pipeline)');
    expect(s({ type: 'SEND_TEMPLATE', templateId: 'zz' })).toBe('Send “zz”');
  });
});

describe('agentBlindNumbers', () => {
  it('lists the numbers an agent cannot see', () => {
    expect(agentBlindNumbers('u1', OPTIONS)).toEqual([]);
    const n3 = { id: 'n3', number: '1', label: null, owningTeam: { id: 't9', name: 'Other' } };
    const o: AutomationOptions = { ...OPTIONS, numbers: [...OPTIONS.numbers, n3] };
    expect(agentBlindNumbers('u1', o)).toEqual([n3]);
    expect(agentBlindNumbers('u2', o)).toEqual([]);
  });
});
