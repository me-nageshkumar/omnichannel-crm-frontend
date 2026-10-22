import { SOURCES } from '@app/api/contacts';
import type { ContactAttribute, ContactLabel, Rule, RuleGroup } from '@app/api/contacts';

export const MAX_DEPTH = 5;
export const MAX_RULES = 50;
export const MAX_VALUES = 20;
export const MAX_VALUE_LENGTH = 200;

export type FieldType = 'text' | 'enum' | 'boolean' | 'date' | 'labels';
export type FieldGroup = 'Contact fields' | 'Labels' | 'Attributes';

export interface FieldOption {
  field: string;
  label: string;
  group: FieldGroup;
  type: FieldType;
}

const ATTRIBUTE_PREFIX = 'attributes.';

const contactField = (label: string, field: string, type: FieldType): FieldOption => ({
  field,
  label,
  group: 'Contact fields',
  type,
});

export const CONTACT_FIELDS: FieldOption[] = [
  contactField('Name', 'name', 'text'),
  contactField('Phone', 'phone', 'text'),
  contactField('Source', 'source', 'enum'),
  contactField('Number hidden', 'numberHidden', 'boolean'),
  contactField('Do not contact', 'doNotContact', 'boolean'),
  contactField('Created', 'creationTime', 'date'),
  contactField('Last message', 'lastMessageAt', 'date'),
];

const LABELS_FIELD: FieldOption = { field: 'labels', label: 'Labels', group: 'Labels', type: 'labels' };

export function fieldOptions(attributes: ContactAttribute[]): FieldOption[] {
  return [
    ...CONTACT_FIELDS,
    LABELS_FIELD,
    ...attributes.map(
      (a): FieldOption => ({ field: ATTRIBUTE_PREFIX + a.id, label: a.name, group: 'Attributes', type: 'text' }),
    ),
  ];
}

export function fieldType(field: string): FieldType | null {
  const known = CONTACT_FIELDS.find((f) => f.field === field);
  if (known) return known.type;
  if (field === 'labels') return 'labels';
  if (field.startsWith(ATTRIBUTE_PREFIX) && field.length > ATTRIBUTE_PREFIX.length) return 'text';
  return null;
}

export const OPERATORS: Record<FieldType, string[]> = {
  text: ['is', 'isNot', 'contains', 'notContains', 'startsWith', 'endsWith', 'isSet', 'isNotSet'],
  enum: ['is', 'isNot', 'in', 'notIn'],
  boolean: ['is'],
  date: ['before', 'after', 'between', 'isSet', 'isNotSet'],
  labels: ['has', 'hasNot', 'hasAny', 'hasAll', 'hasNone', 'isEmpty', 'isNotEmpty'],
};

export const OPERATOR_LABELS: Record<string, string> = {
  is: 'is',
  isNot: 'is not',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  isSet: 'is set',
  isNotSet: 'is not set',
  in: 'is any of',
  notIn: 'is none of',
  before: 'is before',
  after: 'is after',
  between: 'is between',
  has: 'has',
  hasNot: 'does not have',
  hasAny: 'has any of',
  hasAll: 'has all of',
  hasNone: 'has none of',
  isEmpty: 'has no labels',
  isNotEmpty: 'has labels',
};

export type ValueKind = 'none' | 'text' | 'option' | 'options' | 'date' | 'dateRange' | 'label' | 'labels';

export function valueKind(type: FieldType, operator: string): ValueKind {
  switch (type) {
    case 'text':
      return operator === 'isSet' || operator === 'isNotSet' ? 'none' : 'text';
    case 'enum':
      return operator === 'in' || operator === 'notIn' ? 'options' : 'option';
    case 'boolean':
      return 'option';
    case 'date':
      if (operator === 'between') return 'dateRange';
      if (operator === 'isSet' || operator === 'isNotSet') return 'none';
      return 'date';
    case 'labels':
      if (operator === 'isEmpty' || operator === 'isNotEmpty') return 'none';
      if (operator === 'hasAny' || operator === 'hasAll' || operator === 'hasNone') return 'labels';
      return 'label';
  }
}

export function emptyValue(kind: ValueKind): Rule['value'] {
  switch (kind) {
    case 'none':
      return null;
    case 'options':
    case 'labels':
      return [];
    case 'dateRange':
      return ['', ''];
    default:
      return '';
  }
}

export const newRule = (): Rule => ({ field: '', operator: '', value: null });
export const emptyGroup = (): RuleGroup => ({ combinator: 'and', not: false, rules: [newRule()] });

export type Path = number[];
type Node = Rule | RuleGroup;

export const isGroup = (n: Node): n is RuleGroup => 'rules' in n;

export function nodeAt(root: RuleGroup, path: Path): Node | undefined {
  let node: Node | undefined = root;
  for (const i of path) {
    if (!node || !isGroup(node)) return undefined;
    node = node.rules[i];
  }
  return node;
}

export function replaceAt(root: RuleGroup, path: Path, node: Node): RuleGroup {
  if (path.length === 0) return isGroup(node) ? node : root;
  const [head, ...rest] = path;
  const child = root.rules[head];
  if (child === undefined) return root;
  const next = rest.length === 0 ? node : isGroup(child) ? replaceAt(child, rest, node) : child;
  return { ...root, rules: root.rules.map((r, i) => (i === head ? next : r)) };
}

export function addTo(root: RuleGroup, groupPath: Path, child: Node): RuleGroup {
  const target = nodeAt(root, groupPath);
  if (!target || !isGroup(target)) return root;
  return replaceAt(root, groupPath, { ...target, rules: [...target.rules, child] });
}

/** Removes a node, and each non-root ancestor that is left with no rules. */
export function removeAt(root: RuleGroup, path: Path): RuleGroup {
  if (path.length === 0) return root;
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...root, rules: root.rules.filter((_, i) => i !== head) };
  const child = root.rules[head];
  if (child === undefined || !isGroup(child)) return root;
  const next = removeAt(child, rest);
  if (next.rules.length === 0) return { ...root, rules: root.rules.filter((_, i) => i !== head) };
  return { ...root, rules: root.rules.map((r, i) => (i === head ? next : r)) };
}

export function withField(rule: Rule, field: string): Rule {
  const type = fieldType(field);
  if (!type) return { ...rule, field, operator: '', value: null };
  const operator = OPERATORS[type][0];
  return { ...rule, field, operator, value: emptyValue(valueKind(type, operator)) };
}

export function withOperator(rule: Rule, operator: string): Rule {
  const type = fieldType(rule.field);
  if (!type) return { ...rule, operator };
  const kind = valueKind(type, operator);
  return {
    ...rule,
    operator,
    value: kind === valueKind(type, rule.operator) ? rule.value : emptyValue(kind),
  };
}

export function countRules(root: RuleGroup): number {
  return root.rules.reduce((n, r) => n + (isGroup(r) ? countRules(r) : 1), 0);
}

export function depth(root: RuleGroup): number {
  return 1 + root.rules.reduce((d, r) => (isGroup(r) ? Math.max(d, depth(r)) : d), 0);
}

export const groupLevel = (path: Path): number => path.length + 1;
export const canAddRule = (root: RuleGroup): boolean => countRules(root) < MAX_RULES;
/** A new group carries one rule, so it needs room for a rule too. */
export const canAddGroup = (root: RuleGroup, groupPath: Path): boolean =>
  groupLevel(groupPath) < MAX_DEPTH && canAddRule(root);

export interface Missing {
  attributeIds: string[];
  labelIds: string[];
}

function eachRule(root: RuleGroup, visit: (r: Rule) => void): void {
  for (const n of root.rules) {
    if (isGroup(n)) eachRule(n, visit);
    else visit(n);
  }
}

const idsOf = (value: Rule['value']): string[] =>
  Array.isArray(value) ? value : typeof value === 'string' && value !== '' ? [value] : [];

export function missingIds(root: RuleGroup, labels: ContactLabel[], attributes: ContactAttribute[]): Missing {
  const attributeIds: string[] = [];
  const labelIds: string[] = [];
  const push = (list: string[], id: string) => {
    if (!list.includes(id)) list.push(id);
  };
  eachRule(root, (r) => {
    if (r.field.startsWith(ATTRIBUTE_PREFIX)) {
      const id = r.field.slice(ATTRIBUTE_PREFIX.length);
      if (id && !attributes.some((a) => a.id === id)) push(attributeIds, id);
    } else if (r.field === 'labels') {
      for (const id of idsOf(r.value)) if (!labels.some((l) => l.id === id)) push(labelIds, id);
    }
  });
  return { attributeIds, labelIds };
}

export function ruleMissing(
  rule: Rule,
  labels: ContactLabel[],
  attributes: ContactAttribute[],
): 'attribute' | 'label' | null {
  const m = missingIds({ combinator: 'and', not: false, rules: [rule] }, labels, attributes);
  if (m.attributeIds.length > 0) return 'attribute';
  if (m.labelIds.length > 0) return 'label';
  return null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: unknown): v is string => typeof v === 'string' && DATE.test(v);

function valueFits(type: FieldType, kind: ValueKind, value: Rule['value']): boolean {
  switch (kind) {
    case 'none':
      return value === null;
    case 'text':
      return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_VALUE_LENGTH;
    case 'option':
      if (typeof value !== 'string') return false;
      return type === 'boolean' ? value === 'true' || value === 'false' : (SOURCES as string[]).includes(value);
    case 'options':
      return (
        Array.isArray(value) &&
        value.length >= 1 &&
        value.length <= MAX_VALUES &&
        value.every((v) => (SOURCES as string[]).includes(v))
      );
    case 'label':
      return typeof value === 'string' && value !== '';
    case 'labels':
      return (
        Array.isArray(value) &&
        value.length >= 1 &&
        value.length <= MAX_VALUES &&
        value.every((v) => typeof v === 'string' && v !== '')
      );
    case 'date':
      return isDate(value);
    case 'dateRange':
      return Array.isArray(value) && value.length === 2 && isDate(value[0]) && isDate(value[1]) && value[0] <= value[1];
  }
}

function ruleComplete(rule: Rule): boolean {
  const type = fieldType(rule.field);
  if (!type || !OPERATORS[type].includes(rule.operator)) return false;
  return valueFits(type, valueKind(type, rule.operator), rule.value);
}

function groupComplete(group: RuleGroup): boolean {
  return group.rules.length > 0 && group.rules.every((n) => (isGroup(n) ? groupComplete(n) : ruleComplete(n)));
}

export function isComplete(root: RuleGroup): boolean {
  return countRules(root) <= MAX_RULES && depth(root) <= MAX_DEPTH && groupComplete(root);
}

/** The body every preview and save sends: strings and list elements trimmed. */
export function cleanRules(root: RuleGroup): RuleGroup {
  return {
    ...root,
    rules: root.rules.map((n): Node => {
      if (isGroup(n)) return cleanRules(n);
      const { value } = n;
      return {
        ...n,
        value: Array.isArray(value) ? value.map((v) => v.trim()) : typeof value === 'string' ? value.trim() : value,
      };
    }),
  };
}

export const rulePath = (path: Path): string =>
  'rules' +
  path
    .map((i) => `[${i}].rules`)
    .join('')
    .replace(/\.rules$/, '');

const NODE_KEY = /^rules(?:\[\d+\]\.rules)*(?:\[\d+\])?$/;

/** The node a validation key names: a trailing .field/.operator/.value/.combinator/.rules is stripped. */
function pathOfKey(key: string): Path | null {
  const node = key.replace(/\.(?:field|operator|value|combinator|rules)$/, '');
  if (!NODE_KEY.test(node)) return null;
  return (node.match(/\d+/g) ?? []).map(Number);
}

export function splitErrors(
  fields: Record<string, string>,
  root: RuleGroup,
): { byPath: Record<string, string>; name?: string; other: string[] } {
  const byPath: Record<string, string> = {};
  const other: string[] = [];
  let name: string | undefined;
  for (const [key, sentence] of Object.entries(fields)) {
    if (key === 'name') {
      name = sentence;
      continue;
    }
    const path = pathOfKey(key);
    if (path && nodeAt(root, path)) {
      const at = rulePath(path);
      if (!(at in byPath)) byPath[at] = sentence;
    } else {
      other.push(`${key}: ${sentence}`);
    }
  }
  return name === undefined ? { byPath, other } : { byPath, name, other };
}

export const nodeName = (path: Path, group: boolean): string =>
  path.length === 0 ? 'Filter rules' : `${group ? 'Group' : 'Rule'} ${path.map((i) => i + 1).join('.')}`;
