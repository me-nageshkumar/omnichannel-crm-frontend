import { describe, expect, it } from 'vitest';
import type { Rule, RuleGroup } from '@app/api/contacts';
import { LAPSED_TREE, attribute, label } from '../../../test/contacts';
import {
  OPERATORS,
  OPERATOR_LABELS,
  addTo,
  canAddGroup,
  canAddRule,
  cleanRules,
  countRules,
  depth,
  emptyGroup,
  fieldOptions,
  isComplete,
  missingIds,
  newRule,
  nodeAt,
  nodeName,
  removeAt,
  replaceAt,
  ruleMissing,
  rulePath,
  splitErrors,
  withField,
  withOperator,
} from './filterModel';

const CITY = attribute({ id: 'a1', name: 'City' });
const VIP = label({ id: 'l1', name: 'VIP' });

const rule = (field: string, operator: string, value: Rule['value']): Rule => ({ field, operator, value });
const group = (rules: RuleGroup['rules']): RuleGroup => ({ combinator: 'and', not: false, rules });
const tree = (...rules: Rule[]): RuleGroup => group(rules);

describe('filterModel', () => {
  it('fieldOptionsGroupContactFieldsLabelsAndAttributes', () => {
    expect(fieldOptions([CITY]).map((o) => [o.group, o.label, o.field])).toEqual([
      ['Contact fields', 'Name', 'name'],
      ['Contact fields', 'Phone', 'phone'],
      ['Contact fields', 'Source', 'source'],
      ['Contact fields', 'Number hidden', 'numberHidden'],
      ['Contact fields', 'Do not contact', 'doNotContact'],
      ['Contact fields', 'Created', 'creationTime'],
      ['Contact fields', 'Last message', 'lastMessageAt'],
      ['Labels', 'Labels', 'labels'],
      ['Attributes', 'City', 'attributes.a1'],
    ]);
  });

  it('operatorsFollowTheFieldType', () => {
    expect(OPERATORS).toEqual({
      text: ['is', 'isNot', 'contains', 'notContains', 'startsWith', 'endsWith', 'isSet', 'isNotSet'],
      enum: ['is', 'isNot', 'in', 'notIn'],
      boolean: ['is'],
      date: ['before', 'after', 'between', 'isSet', 'isNotSet'],
      labels: ['has', 'hasNot', 'hasAny', 'hasAll', 'hasNone', 'isEmpty', 'isNotEmpty'],
    });
    expect(OPERATORS.text.map((o) => OPERATOR_LABELS[o])).toEqual([
      'is',
      'is not',
      'contains',
      'does not contain',
      'starts with',
      'ends with',
      'is set',
      'is not set',
    ]);
    expect(OPERATORS.labels.map((o) => OPERATOR_LABELS[o])).toEqual([
      'has',
      'does not have',
      'has any of',
      'has all of',
      'has none of',
      'has no labels',
      'has labels',
    ]);
    expect(OPERATORS.date.map((o) => OPERATOR_LABELS[o])).toEqual([
      'is before',
      'is after',
      'is between',
      'is set',
      'is not set',
    ]);
    expect(OPERATORS.enum.map((o) => OPERATOR_LABELS[o])).toEqual(['is', 'is not', 'is any of', 'is none of']);
  });

  it('withFieldPicksTheFirstOperatorAndAnEmptyValue', () => {
    expect(withField(newRule(), 'source')).toEqual({ field: 'source', operator: 'is', value: '' });
    expect(withField(newRule(), 'labels')).toEqual({ field: 'labels', operator: 'has', value: '' });
    expect(withField(newRule(), 'creationTime')).toEqual({ field: 'creationTime', operator: 'before', value: '' });
    expect(withField(newRule(), 'attributes.a1')).toEqual({ field: 'attributes.a1', operator: 'is', value: '' });
    expect(withField(newRule(), 'nope')).toEqual({ field: 'nope', operator: '', value: null });
  });

  it('withOperatorKeepsACompatibleValue', () => {
    expect(withOperator(rule('name', 'is', 'Asha'), 'contains').value).toBe('Asha');
    expect(withOperator(rule('name', 'is', 'Asha'), 'isSet').value).toBeNull();
    expect(withOperator(rule('source', 'in', ['CHAT']), 'is').value).toBe('');
    expect(withOperator(rule('lastMessageAt', 'before', '2026-09-01'), 'after').value).toBe('2026-09-01');
    expect(withOperator(rule('lastMessageAt', 'before', '2026-09-01'), 'between').value).toEqual(['', '']);
    expect(withOperator(rule('labels', 'has', 'l1'), 'hasAny').value).toEqual([]);
  });

  it('addRemoveReplaceAtAPath', () => {
    const r = emptyGroup();
    const added = addTo(r, [], emptyGroup());
    expect(added.rules).toHaveLength(2);
    expect('rules' in added.rules[1]).toBe(true);
    const x = rule('name', 'is', 'X');
    expect(nodeAt(replaceAt(added, [1, 0], x), [1, 0])).toBe(x);
    const removed = removeAt(added, [0]);
    expect('rules' in removed.rules[0]).toBe(true);
    expect(removed.rules).toHaveLength(1);
    expect(r.rules).toHaveLength(1);
    expect(added.rules).toHaveLength(2);
  });

  it('removingTheLastRuleRemovesItsGroup', () => {
    const r1 = rule('name', 'is', 'a');
    const r2 = rule('name', 'is', 'b');
    expect(removeAt(group([r1, group([r2])]), [1, 0]).rules).toEqual([r1]);
    expect(removeAt(group([r1, group([group([r2])])]), [1, 0, 0]).rules).toEqual([r1]);
    expect(removeAt(group([r1]), [0]).rules).toEqual([]);
  });

  it('countsRulesAndDepth', () => {
    expect(countRules(LAPSED_TREE)).toBe(4);
    expect(depth(LAPSED_TREE)).toBe(2);
    let chain: RuleGroup = group([newRule()]);
    for (let i = 0; i < 4; i++) chain = group([chain]);
    expect(depth(chain)).toBe(5);
    expect(canAddGroup(chain, [0, 0, 0, 0])).toBe(false);
    expect(canAddGroup(chain, [0, 0, 0])).toBe(true);
    const full = group(Array.from({ length: 50 }, () => newRule()));
    expect(countRules(full)).toBe(50);
    expect(canAddRule(full)).toBe(false);
    expect(canAddGroup(full, [])).toBe(false);
    expect(canAddRule(LAPSED_TREE)).toBe(true);
  });

  it('missingIdsFindsDeletedLabelsAndAttributes', () => {
    const t = tree(
      rule('attributes.a9', 'is', 'x'),
      rule('labels', 'has', 'l9'),
      rule('labels', 'hasAny', ['l1', 'l8']),
    );
    expect(missingIds(t, [VIP], [CITY])).toEqual({ attributeIds: ['a9'], labelIds: ['l9', 'l8'] });
    expect(t.rules.map((r) => ruleMissing(r as Rule, [VIP], [CITY]))).toEqual(['attribute', 'label', 'label']);
    expect(LAPSED_TREE.rules.filter((r) => 'field' in r).map((r) => ruleMissing(r as Rule, [VIP], [CITY]))).toEqual([
      null,
      null,
    ]);
  });

  it('isCompleteChecksEveryRule', () => {
    const one = (r: Rule) => isComplete(tree(r));
    expect(isComplete(LAPSED_TREE)).toBe(true);
    expect(one(rule('name', 'is', '  '))).toBe(false);
    expect(one(rule('name', 'is', 'a'.repeat(201)))).toBe(false);
    expect(one(rule('name', 'is', 'a'.repeat(200)))).toBe(true);
    expect(one(rule('name', 'isSet', null))).toBe(true);
    expect(one(rule('source', 'in', []))).toBe(false);
    expect(one(rule('source', 'in', ['CHAT']))).toBe(true);
    expect(one(rule('source', 'is', 'OTHER'))).toBe(false);
    expect(
      one(
        rule(
          'labels',
          'hasAny',
          Array.from({ length: 21 }, (_, i) => `l${i}`),
        ),
      ),
    ).toBe(false);
    expect(one(rule('creationTime', 'before', '2026-9-1'))).toBe(false);
    expect(one(rule('creationTime', 'between', ['2026-09-10', '2026-09-01']))).toBe(false);
    expect(one(rule('creationTime', 'between', ['2026-09-01', '2026-09-10']))).toBe(true);
    expect(isComplete(group([newRule(), group([])]))).toBe(false);
    expect(isComplete(group([]))).toBe(false);
    expect(one(rule('numberHidden', 'is', 'yes'))).toBe(false);
    expect(one(rule('numberHidden', 'is', 'true'))).toBe(true);
    expect(one(rule('', '', null))).toBe(false);
    expect(one(rule('name', 'has', 'a'))).toBe(false);
    expect(one(rule('labels', 'has', ''))).toBe(false);
  });

  it('cleanRulesTrimsValues', () => {
    expect(cleanRules(tree(rule('attributes.a1', 'is', ' Pune '))).rules[0]).toEqual(
      rule('attributes.a1', 'is', 'Pune'),
    );
    expect(cleanRules(tree(rule('labels', 'hasAny', [' l1 ']))).rules[0]).toEqual(rule('labels', 'hasAny', ['l1']));
    expect(cleanRules(tree(rule('name', 'isSet', null))).rules[0]).toEqual(rule('name', 'isSet', null));
    expect(cleanRules(LAPSED_TREE)).toEqual(LAPSED_TREE);
  });

  it('rulePathAndErrorsUseTheServerPaths', () => {
    expect(rulePath([2, 0])).toBe('rules[2].rules[0]');
    expect(rulePath([])).toBe('rules');
    expect(
      splitErrors(
        {
          'rules[2].rules[0].value': 'must be at most 200 characters',
          rules: 'is too deep',
          name: 'is required',
          'rules[9]': 'x',
        },
        LAPSED_TREE,
      ),
    ).toEqual({
      byPath: { 'rules[2].rules[0]': 'must be at most 200 characters', rules: 'is too deep' },
      name: 'is required',
      other: ['rules[9]: x'],
    });
    expect(splitErrors({ 'rules[2].rules': 'bad' }, LAPSED_TREE).byPath).toEqual({ 'rules[2]': 'bad' });
  });

  it('nodeNamesNumberFromOne', () => {
    expect(nodeName([], true)).toBe('Filter rules');
    expect(nodeName([0], false)).toBe('Rule 1');
    expect(nodeName([2, 1], false)).toBe('Rule 3.2');
    expect(nodeName([2], true)).toBe('Group 3');
  });
});
