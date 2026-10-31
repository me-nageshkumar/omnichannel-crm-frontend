import { describe, expect, it } from 'vitest';
import type { SegmentRule, SegmentRuleGroup } from '@app/api/crm';
import { sampleSegmentFields } from '../../../test/crm';
import {
  MAX_DAYS,
  MAX_DEPTH,
  MAX_RULES,
  MAX_VALUES,
  MAX_VALUE_LENGTH,
  cleanRules,
  emptyGroup,
  hasFlagged,
  isComplete,
  isFlagged,
  newRule,
  pipelineOfGroup,
  removeRule,
  stageWithoutPipeline,
  valueKind,
  withField,
  withOperator,
  withRuleChanged,
} from '@app/Crm/segments/segmentModel';

const CATALOG = sampleSegmentFields();
const rule = (field: string, operator: string, value: SegmentRule['value'] = null): SegmentRule => ({
  field,
  operator,
  value,
});
const group = (combinator: 'and' | 'or', ...rules: (SegmentRule | SegmentRuleGroup)[]): SegmentRuleGroup => ({
  combinator,
  not: false,
  rules,
});

describe('segmentModel', () => {
  it('valueKindPerTypeAndOperator', () => {
    expect(valueKind('TEXT', 'is')).toBe('text');
    expect(valueKind('TEXT', 'isSet')).toBe('none');
    expect(valueKind('NUMBER', 'gt')).toBe('number');
    expect(valueKind('MONEY', 'between')).toBe('numberRange');
    expect(valueKind('DATE', 'before')).toBe('date');
    expect(valueKind('DATE', 'between')).toBe('dateRange');
    expect(valueKind('DATE', 'withinLastDays')).toBe('days');
    expect(valueKind('DATE', 'moreThanDaysAgo')).toBe('days');
    expect(valueKind('DATE', 'isNotSet')).toBe('none');
    expect(valueKind('PICK', 'is')).toBe('option');
    expect(valueKind('PICK', 'in')).toBe('options');
    expect(valueKind('ENUM', 'notIn')).toBe('options');
    expect(valueKind('USER', 'is')).toBe('user');
    expect(valueKind('USER', 'notIn')).toBe('users');
    expect(valueKind('COMPANY', 'is')).toBe('company');
    expect(valueKind('COMPANY', 'in')).toBe('companies');
    expect(valueKind('BOOLEAN', 'is')).toBe('boolean');
    expect(valueKind('LABEL', 'has')).toBe('label');
    expect(valueKind('LABEL', 'hasAny')).toBe('labels');
    expect(valueKind('LABEL', 'isEmpty')).toBe('none');
    expect(valueKind('MULTI', 'contains')).toBe('text');
    expect(valueKind('MULTI', 'isSet')).toBe('none');
  });

  it('withFieldResetsOperatorAndValue', () => {
    const r = withField(rule('contact.email', 'contains', 'x'), 'contact.lifecycleStatus', CATALOG);
    expect(r).toEqual({ field: 'contact.lifecycleStatus', operator: 'is', value: '' });
    const d = withField(r, 'contact.creationTime', CATALOG);
    expect(d.operator).toBe('before');
    expect(d.value).toBe('');
    expect(withField(r, 'nope', CATALOG)).toEqual({ field: 'nope', operator: '', value: null });
  });

  it('withOperatorKeepsValueWhenKindUnchanged', () => {
    const r = rule('contact.email', 'is', 'asha');
    expect(withOperator(r, 'contains', 'TEXT').value).toBe('asha');
    expect(withOperator(r, 'isSet', 'TEXT').value).toBeNull();
    expect(withOperator(rule('contact.lifecycleStatus', 'is', 'lead'), 'in', 'PICK').value).toEqual([]);
    expect(withOperator(rule('deal.amount', 'gt', '5'), 'between', 'MONEY').value).toEqual(['', '']);
    expect(withOperator(rule('contact.creationTime', 'before', '2026-01-01'), 'withinLastDays', 'DATE').value).toBe('');
  });

  it('isCompleteNeedsKnownFieldOperatorAndValue', () => {
    expect(isComplete(group('and', rule('contact.email', 'contains', 'a')), CATALOG)).toBe(true);
    expect(isComplete(group('and', rule('contact.email', 'isSet')), CATALOG)).toBe(true);
    expect(isComplete(group('and', rule('contact.email', 'contains', '')), CATALOG)).toBe(false);
    expect(isComplete(group('and', rule('contact.email', 'endsWith', 'a')), CATALOG)).toBe(false);
    expect(isComplete(group('and', rule('nope', 'is', 'a')), CATALOG)).toBe(false);
    expect(isComplete(group('and', rule('contact.lifecycleStatus', 'in', [])), CATALOG)).toBe(false);
    expect(isComplete(group('and', rule('deal.amount', 'between', ['1', ''])), CATALOG)).toBe(false);
    expect(isComplete(group('and', rule('deal.amount', 'between', ['1', '2'])), CATALOG)).toBe(true);
    expect(isComplete(group('and'), CATALOG)).toBe(false);
    expect(isComplete(group('and', group('or', rule('channel.label', 'has', 'l1'))), CATALOG)).toBe(true);
    expect(isComplete(group('and', newRule()), CATALOG)).toBe(false);
  });

  it('cleanRulesTrimsAndStripsFlags', () => {
    const dirty: SegmentRuleGroup = group(
      'and',
      { field: 'contact.email', operator: 'contains', value: ' a ', missing: true },
      group('or', { field: 'deal.pipelineId', operator: 'in', value: [' p1 ', 'p2'], inaccessible: true }),
    );
    expect(cleanRules(dirty)).toEqual(
      group('and', rule('contact.email', 'contains', 'a'), group('or', rule('deal.pipelineId', 'in', ['p1', 'p2']))),
    );
    expect(isFlagged({ field: 'x', operator: 'is', value: null, missing: true })).toBe(true);
    expect(isFlagged(rule('x', 'is'))).toBe(false);
  });

  it('stageWithoutPipelineDetectsAndGroupsOnly', () => {
    expect(stageWithoutPipeline(group('and', rule('deal.stageId', 'is', 's1')))).toBe(true);
    expect(
      stageWithoutPipeline(group('and', rule('deal.pipelineId', 'is', 'p1'), rule('deal.stageId', 'is', 's1'))),
    ).toBe(false);
    expect(
      stageWithoutPipeline(group('or', rule('deal.pipelineId', 'is', 'p1'), rule('deal.stageId', 'is', 's1'))),
    ).toBe(true);
    expect(pipelineOfGroup(group('and', rule('deal.pipelineId', 'is', 'p2'), rule('deal.stageId', 'is', '')))).toBe(
      'p2',
    );
    expect(pipelineOfGroup(group('or', rule('deal.pipelineId', 'is', 'p2')))).toBeNull();
    expect(pipelineOfGroup(group('and', rule('deal.pipelineId', 'in', ['p1', 'p2'])))).toBeNull();
  });

  it('hasFlaggedLooksThroughNestedGroups', () => {
    expect(hasFlagged(group('and', rule('contact.email', 'isSet')))).toBe(false);
    expect(hasFlagged(group('and', group('or', { field: 'x', operator: 'is', value: 'a', inaccessible: true })))).toBe(
      true,
    );
  });

  it('stageRulesStartOverWhenThePipelineRuleChangesAtAll', () => {
    const before = group('and', rule('deal.pipelineId', 'is', 'p1'), rule('deal.stageId', 'in', ['s1', 's2']));
    const reset = rule('deal.stageId', 'in', []);
    expect(withRuleChanged(before, 0, rule('deal.pipelineId', 'isNot', 'p1')).rules[1]).toEqual(reset);
    expect(withRuleChanged(before, 0, rule('contact.email', 'isSet')).rules[1]).toEqual(reset);
    const other = group('and', rule('contact.email', 'is', 'a'), rule('deal.stageId', 'is', 's1'));
    expect(withRuleChanged(other, 0, rule('contact.email', 'is', 'b')).rules[1]).toEqual(
      rule('deal.stageId', 'is', 's1'),
    );
  });

  it('removeRuleStartsStageRulesOverOnlyForAPipelineRule', () => {
    const inner = group('and', rule('deal.pipelineId', 'is', 'p1'), rule('deal.stageId', 'is', 's1'));
    const root = group('and', rule('deal.stageId', 'is', 's2'), inner);
    expect(removeRule(root, [1, 0])).toEqual(
      group('and', rule('deal.stageId', 'is', 's2'), group('and', rule('deal.stageId', 'is', ''))),
    );
    expect(removeRule(root, [1, 1])).toEqual(
      group('and', rule('deal.stageId', 'is', 's2'), group('and', rule('deal.pipelineId', 'is', 'p1'))),
    );
  });

  it('capsMirrorTheServer', () => {
    expect([MAX_RULES, MAX_DEPTH, MAX_VALUES, MAX_VALUE_LENGTH, MAX_DAYS]).toEqual([30, 3, 50, 200, 3650]);
    expect(emptyGroup()).toEqual({ combinator: 'and', not: false, rules: [newRule()] });
  });
});
