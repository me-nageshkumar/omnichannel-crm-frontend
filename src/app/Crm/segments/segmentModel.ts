import type { Rule, RuleGroup } from '@app/api/contacts';
import type { SegmentField, SegmentFieldCatalog, SegmentRule, SegmentRuleGroup, SegmentValueType } from '@app/api/crm';
import * as tree from '@app/Contacts/Filters/filterModel';

/*
 * The segment rule tree has the advanced contact filter's shape, so the generic tree helpers are the filter model's,
 * re-typed here; the field model (types, operators, value kinds) is the server's catalogue instead.
 */

export const MAX_RULES = 30;
export const MAX_DEPTH = 3;
export const MAX_VALUES = 50;
export const MAX_VALUE_LENGTH = 200;
export const MAX_DAYS = 3650;

export type Path = tree.Path;
export type Node = SegmentRule | SegmentRuleGroup;

const asGroup = (g: SegmentRuleGroup) => g as unknown as RuleGroup;
const asNode = (n: Node) => n as unknown as Rule | RuleGroup;
const back = (g: RuleGroup) => g as unknown as SegmentRuleGroup;

export const isGroup = (n: Node): n is SegmentRuleGroup => 'rules' in n;
export const nodeAt = (root: SegmentRuleGroup, path: Path): Node | undefined =>
  tree.nodeAt(asGroup(root), path) as Node | undefined;
export const replaceAt = (root: SegmentRuleGroup, path: Path, node: Node): SegmentRuleGroup =>
  back(tree.replaceAt(asGroup(root), path, asNode(node)));
export const addTo = (root: SegmentRuleGroup, groupPath: Path, child: Node): SegmentRuleGroup =>
  back(tree.addTo(asGroup(root), groupPath, asNode(child)));
export const removeAt = (root: SegmentRuleGroup, path: Path): SegmentRuleGroup =>
  back(tree.removeAt(asGroup(root), path));
export const rulePath = tree.rulePath;
export const nodeName = tree.nodeName;
export const splitErrors = (fields: Record<string, string>, root: SegmentRuleGroup) =>
  tree.splitErrors(fields, asGroup(root));
export const countRules = (root: SegmentRuleGroup): number => tree.countRules(asGroup(root));
export const depth = (root: SegmentRuleGroup): number => tree.depth(asGroup(root));
export const canAddRule = (root: SegmentRuleGroup): boolean => countRules(root) < MAX_RULES;
/** A new group carries one rule, so it needs room for a rule too. */
export const canAddGroup = (root: SegmentRuleGroup, groupPath: Path): boolean =>
  groupPath.length + 1 < MAX_DEPTH && canAddRule(root);

export const OPERATOR_LABELS: Record<string, string> = {
  is: 'is',
  isNot: 'is not',
  contains: 'contains',
  notContains: "doesn't contain",
  startsWith: 'starts with',
  isSet: 'is set',
  isNotSet: 'is not set',
  eq: 'equals',
  neq: "doesn't equal",
  lt: 'less than',
  lte: 'at most',
  gt: 'more than',
  gte: 'at least',
  between: 'between',
  before: 'before',
  after: 'after',
  withinLastDays: 'in the last … days',
  moreThanDaysAgo: 'more than … days ago',
  in: 'is any of',
  notIn: 'is none of',
  has: 'has',
  hasNot: "doesn't have",
  hasAny: 'has any of',
  hasAll: 'has all of',
  hasNone: 'has none of',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

export type ValueKind =
  | 'none'
  | 'text'
  | 'number'
  | 'numberRange'
  | 'date'
  | 'dateRange'
  | 'days'
  | 'option'
  | 'options'
  | 'user'
  | 'users'
  | 'company'
  | 'companies'
  | 'boolean'
  | 'label'
  | 'labels';

const NO_VALUE = new Set(['isSet', 'isNotSet', 'isEmpty', 'isNotEmpty']);
const LIST = new Set(['in', 'notIn', 'hasAny', 'hasAll', 'hasNone']);

export function valueKind(type: SegmentValueType, operator: string): ValueKind {
  if (NO_VALUE.has(operator)) return 'none';
  switch (type) {
    case 'TEXT':
    case 'MULTI':
      return 'text';
    case 'NUMBER':
    case 'MONEY':
      return operator === 'between' ? 'numberRange' : 'number';
    case 'DATE':
      if (operator === 'between') return 'dateRange';
      if (operator === 'withinLastDays' || operator === 'moreThanDaysAgo') return 'days';
      return 'date';
    case 'PICK':
    case 'ENUM':
      return LIST.has(operator) ? 'options' : 'option';
    case 'USER':
      return LIST.has(operator) ? 'users' : 'user';
    case 'COMPANY':
      return LIST.has(operator) ? 'companies' : 'company';
    case 'BOOLEAN':
      return 'boolean';
    case 'LABEL':
      return LIST.has(operator) ? 'labels' : 'label';
  }
}

export function emptyValue(kind: ValueKind): SegmentRule['value'] {
  switch (kind) {
    case 'none':
      return null;
    case 'options':
    case 'users':
    case 'companies':
    case 'labels':
      return [];
    case 'numberRange':
    case 'dateRange':
      return ['', ''];
    default:
      return '';
  }
}

export function fieldByKey(catalog: SegmentFieldCatalog, key: string): SegmentField | undefined {
  for (const g of catalog.groups) for (const f of g.fields) if (f.key === key) return f;
  return undefined;
}

export const newRule = (): SegmentRule => ({ field: '', operator: '', value: null });
export const emptyGroup = (): SegmentRuleGroup => ({ combinator: 'and', not: false, rules: [newRule()] });

/** The rule on another field: its first operator and an empty value of that kind. */
export function withField(rule: SegmentRule, field: string, catalog: SegmentFieldCatalog): SegmentRule {
  const spec = fieldByKey(catalog, field);
  if (!spec) return { field, operator: '', value: null };
  const operator = spec.operators[0];
  return { field, operator, value: emptyValue(valueKind(spec.type, operator)) };
}

/** The rule with another operator; the value survives when the operator takes the same kind of value. */
export function withOperator(rule: SegmentRule, operator: string, type: SegmentValueType): SegmentRule {
  const kind = valueKind(type, operator);
  return {
    field: rule.field,
    operator,
    value: kind === valueKind(type, rule.operator) ? rule.value : emptyValue(kind),
  };
}

export const isFlagged = (rule: SegmentRule): boolean => rule.missing === true || rule.inaccessible === true;

function valueComplete(kind: ValueKind, value: SegmentRule['value']): boolean {
  switch (kind) {
    case 'none':
      return true;
    case 'options':
    case 'users':
    case 'companies':
    case 'labels':
      return Array.isArray(value) && value.length > 0 && value.every((v) => v.trim() !== '');
    case 'numberRange':
    case 'dateRange':
      return Array.isArray(value) && value.length === 2 && value.every((v) => v.trim() !== '');
    default:
      return typeof value === 'string' && value.trim() !== '';
  }
}

function ruleComplete(r: SegmentRule, catalog: SegmentFieldCatalog): boolean {
  if (isFlagged(r)) return false;
  const spec = fieldByKey(catalog, r.field);
  if (!spec || !spec.operators.includes(r.operator)) return false;
  return valueComplete(valueKind(spec.type, r.operator), r.value);
}

function groupComplete(g: SegmentRuleGroup, catalog: SegmentFieldCatalog): boolean {
  return (
    g.rules.length > 0 && g.rules.every((n) => (isGroup(n) ? groupComplete(n, catalog) : ruleComplete(n, catalog)))
  );
}

/** Whether every rule can be sent: a known field, one of its operators, a value of the right shape. */
export function isComplete(root: SegmentRuleGroup, catalog: SegmentFieldCatalog): boolean {
  return countRules(root) <= MAX_RULES && depth(root) <= MAX_DEPTH && groupComplete(root, catalog);
}

/** The body every preview and save sends: trimmed values, no server flags. */
export function cleanRules(root: SegmentRuleGroup): SegmentRuleGroup {
  return {
    combinator: root.combinator,
    not: root.not,
    rules: root.rules.map((n): Node => {
      if (isGroup(n)) return cleanRules(n);
      const { value } = n;
      return {
        field: n.field,
        operator: n.operator,
        value: Array.isArray(value) ? value.map((v) => v.trim()) : typeof value === 'string' ? value.trim() : value,
      };
    }),
  };
}

/** The error for a node, whichever part of it the server named (the node, its field, operator or value). */
export function errorFor(errors: Record<string, string>, path: Path): string | undefined {
  const at = rulePath(path);
  return [at, `${at}.field`, `${at}.operator`, `${at}.value`, `${at}.combinator`, `${at}.rules`]
    .map((k) => errors[k])
    .find((m) => m !== undefined);
}

/** When a group's pipeline rule changes, its stage rules start over: their options belong to the old pipeline. */
export function withRuleChanged(group: SegmentRuleGroup, index: number, next: SegmentRule): SegmentRuleGroup {
  const before = group.rules[index];
  const pipelineChanged =
    next.field === 'deal.pipelineId' &&
    !isGroup(before) &&
    (before.field !== next.field || before.value !== next.value);
  return {
    ...group,
    rules: group.rules.map((n, i) => {
      if (i === index) return next;
      if (pipelineChanged && !isGroup(n) && n.field === 'deal.stageId')
        return { ...n, value: emptyValue(valueKind('PICK', n.operator)) };
      return n;
    }),
  };
}

export const dealRulesIn = (group: SegmentRuleGroup): SegmentRule[] =>
  group.rules.filter((n): n is SegmentRule => !isGroup(n) && n.field.startsWith('deal.'));

/** The pipeline an AND group pins with a single-valued rule, for its stage rules' options. */
export function pipelineOfGroup(group: SegmentRuleGroup): string | null {
  if (group.combinator !== 'and') return null;
  const pin = dealRulesIn(group).find((r) => r.field === 'deal.pipelineId' && r.operator === 'is');
  return pin && typeof pin.value === 'string' && pin.value !== '' ? pin.value : null;
}

/** A stage rule whose group does not pin a pipeline (the server refuses it). */
export function stageWithoutPipeline(group: SegmentRuleGroup): boolean {
  const rules = dealRulesIn(group);
  return (
    rules.some((r) => r.field === 'deal.stageId') &&
    (group.combinator !== 'and' || !rules.some((r) => r.field === 'deal.pipelineId'))
  );
}
