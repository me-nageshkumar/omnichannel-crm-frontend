import type {
  AutomationAction,
  AutomationOptions,
  ConditionGroup,
  ConditionLeaf,
  ConditionNode,
  EventKind,
  MessageKind,
  RuleRequest,
} from '@app/api/automations';
import type { Rule, RuleGroup } from '@app/api/contacts';
import * as tree from '@app/Contacts/Filters/filterModel';

/*
 * The condition tree has the advanced contact filter's shape, so the generic tree helpers are the filter model's,
 * re-typed here; the fields, operators and wording are the automations contract's.
 */

export const MAX_DEPTH = 3;
export const MAX_CONDITIONS = 30;

export type FieldType = 'boolean' | 'text' | 'choice' | 'number';

export interface AutomationField {
  field: string;
  label: string;
  description: string;
  placeholder?: string;
  type: FieldType;
  operators: string[];
}

const TEXT_OPERATORS = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
];
const PICK_OPERATORS = ['is', 'is_not', 'is_one_of'];

export const FIELDS: Record<EventKind, AutomationField[]> = {
  MESSAGE_RECEIVED: [
    {
      field: 'chat.new',
      label: 'Chat',
      description: 'Whether this message starts a new chat or continues an existing one.',
      type: 'boolean',
      operators: ['is'],
    },
    {
      field: 'message.text',
      label: 'Message text',
      description: 'The words the contact sent, or a photo’s caption.',
      placeholder: 'For example: price',
      type: 'text',
      operators: TEXT_OPERATORS,
    },
    {
      field: 'message.type',
      label: 'Message type',
      description: 'What kind of message it is: text, photo, document and so on.',
      type: 'choice',
      operators: ['is_one_of'],
    },
    {
      field: 'number',
      label: 'Number',
      description: 'The WhatsApp number of yours that received the message.',
      type: 'choice',
      operators: PICK_OPERATORS,
    },
    {
      field: 'contact.inCrm',
      label: 'Contact',
      description: 'Whether the person who wrote is already a CRM contact.',
      type: 'boolean',
      operators: ['is'],
    },
    {
      field: 'contact.name',
      label: 'Contact name',
      description: 'The name saved for the contact, or their WhatsApp name.',
      placeholder: 'For example: Asha',
      type: 'text',
      operators: TEXT_OPERATORS,
    },
  ],
  DEAL_LANE_CHANGED: [
    {
      field: 'pipeline',
      label: 'Pipeline',
      description: 'The pipeline the deal belongs to.',
      type: 'choice',
      operators: PICK_OPERATORS,
    },
    {
      field: 'toLane',
      label: 'Moved into lane',
      description: 'The lane the deal moved into.',
      type: 'choice',
      operators: PICK_OPERATORS,
    },
    {
      field: 'fromLane',
      label: 'Moved from lane',
      description: 'The lane the deal moved out of.',
      type: 'choice',
      operators: PICK_OPERATORS,
    },
    {
      field: 'toLane.type',
      label: 'Lane type',
      description: 'Whether the new lane is an open, won or lost lane.',
      type: 'choice',
      operators: PICK_OPERATORS,
    },
    {
      field: 'deal.amount',
      label: 'Deal amount',
      description: 'The deal’s value in its currency.',
      placeholder: 'For example: 5000',
      type: 'number',
      operators: [
        'is',
        'is_not',
        'greater_than',
        'less_than',
        'at_least',
        'at_most',
        'between',
        'is_empty',
        'is_not_empty',
      ],
    },
    {
      field: 'deal.owner',
      label: 'Deal owner',
      description: 'The agent who owns the deal.',
      type: 'choice',
      operators: [...PICK_OPERATORS, 'is_empty', 'is_not_empty'],
    },
  ],
};

export const EVENTS: { kind: EventKind; label: string; description: string }[] = [
  {
    kind: 'MESSAGE_RECEIVED',
    label: 'A message comes in',
    description:
      'Runs when a contact sends one of your WhatsApp numbers a real message: text, photo, document and so on. Not calls, reactions or notices.',
  },
  {
    kind: 'DEAL_LANE_CHANGED',
    label: 'A deal moves to another lane',
    description: 'Runs when a deal is dragged or closed into another lane, won and lost included.',
  },
];

export const ACTIONS: { type: AutomationAction['type']; label: string; description: string }[] = [
  {
    type: 'SEND_TEMPLATE',
    label: 'Send template',
    description: 'Sends one of your templates to the contact, at any hour.',
  },
  {
    type: 'ASSIGN_CHAT',
    label: 'Assign chat',
    description: 'Gives the chat to an agent or a team, replacing what routing did.',
  },
  {
    type: 'ADD_TO_CRM',
    label: 'Add to CRM',
    description: 'Creates a CRM contact and a deal for the person, if they are not in the CRM yet.',
  },
];

export const OPERATOR_LABELS: Record<string, string> = {
  is: 'is',
  is_not: 'is not',
  is_one_of: 'is one of',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  greater_than: 'greater than',
  less_than: 'less than',
  at_least: 'at least',
  at_most: 'at most',
  between: 'between',
};

export const MESSAGE_KINDS: { kind: MessageKind; label: string }[] = [
  { kind: 'TEXT', label: 'Text' },
  { kind: 'PHOTO', label: 'Photo' },
  { kind: 'VIDEO', label: 'Video' },
  { kind: 'AUDIO', label: 'Audio / voice note' },
  { kind: 'DOCUMENT', label: 'Document' },
  { kind: 'STICKER', label: 'Sticker' },
  { kind: 'LOCATION', label: 'Location' },
  { kind: 'CONTACT_CARD', label: 'Contact card' },
  { kind: 'POLL', label: 'Poll' },
];

export const BOOLEAN_CHOICES: Record<'chat.new' | 'contact.inCrm', [string, string]> = {
  'chat.new': ['Chat is new', 'Chat is existing'],
  'contact.inCrm': ['Contact is in the CRM', 'Contact is not in the CRM'],
};

const LANE_TYPES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
];

type Choice = { value: string; label: string };

export function choicesFor(field: string, o: AutomationOptions): Choice[] {
  switch (field) {
    case 'message.type':
      return MESSAGE_KINDS.map((k) => ({ value: k.kind, label: k.label }));
    case 'number':
      return o.numbers.map((n) => ({ value: n.id, label: n.label ?? '+' + n.number }));
    case 'pipeline':
      return o.crm.pipelines.map((p) => ({ value: p.id, label: p.name }));
    case 'toLane':
    case 'fromLane':
      return o.crm.pipelines.reduce<Choice[]>(
        (all, p) => all.concat(p.lanes.map((l) => ({ value: l.id, label: `${p.name} › ${l.name}` }))),
        [],
      );
    case 'toLane.type':
      return LANE_TYPES;
    case 'deal.owner':
      return o.agents.map((a) => ({ value: a.id, label: a.name }));
    default:
      return [];
  }
}

export const newLeaf = (event: EventKind): ConditionLeaf =>
  event === 'MESSAGE_RECEIVED'
    ? { field: 'chat.new', operator: 'is', value: true }
    : { field: 'toLane', operator: 'is', value: [] };

export const newGroup = (): ConditionGroup => ({ combinator: 'and', not: false, rules: [] });

export const emptyRule = (): RuleRequest => ({
  name: '',
  description: null,
  event: 'MESSAGE_RECEIVED',
  priority: null,
  conditions: null,
  actions: [],
});

export type Path = tree.Path;

const asGroup = (g: ConditionGroup) => g as unknown as RuleGroup;
const asNode = (n: ConditionNode) => n as unknown as Rule | RuleGroup;
const back = (g: RuleGroup) => g as unknown as ConditionGroup;

export const isGroup = (n: ConditionNode): n is ConditionGroup => 'rules' in n;
export const nodeAt = (root: ConditionGroup, path: Path): ConditionNode | undefined =>
  tree.nodeAt(asGroup(root), path) as ConditionNode | undefined;
export const replaceAt = (root: ConditionGroup, path: Path, node: ConditionNode): ConditionGroup =>
  back(tree.replaceAt(asGroup(root), path, asNode(node)));
export const addTo = (root: ConditionGroup, groupPath: Path, child: ConditionNode): ConditionGroup =>
  back(tree.addTo(asGroup(root), groupPath, asNode(child)));
export const removeAt = (root: ConditionGroup, path: Path): ConditionGroup => back(tree.removeAt(asGroup(root), path));
export const rulePath = tree.rulePath;
export const countRules = (root: ConditionGroup): number => tree.countRules(asGroup(root));
export const depth = (root: ConditionGroup): number => tree.depth(asGroup(root));

const holdsAllKinds = (leaf: ConditionLeaf): boolean =>
  leaf.field === 'message.type' &&
  Array.isArray(leaf.value) &&
  MESSAGE_KINDS.every((k) => (leaf.value as string[]).indexOf(k.kind) >= 0);

function pruneGroup(g: ConditionGroup): ConditionGroup {
  const rules: ConditionNode[] = [];
  for (const n of g.rules) {
    if (isGroup(n)) {
      const kept = pruneGroup(n);
      if (kept.rules.length > 0) rules.push(kept);
    } else if (!holdsAllKinds(n)) rules.push(n);
  }
  return { ...g, rules };
}

/** The conditions as saved: a "message type is one of everything" leaf matches nothing new, so it goes. */
export function pruneConditions(root: ConditionGroup | null): ConditionGroup | null {
  if (!root) return null;
  const kept = pruneGroup(root);
  return kept.rules.length === 0 ? null : kept;
}

const LEAF_KEY = /\.(?:field|operator|value|combinator|rules)$/;

/**
 * Splits the server's field errors: "conditions.<path>" by rule path, "actions[i].<key>" by action, the rest as
 * lines for the form ("<key>: <message>", or the message alone for the name).
 */
export function conditionErrors(fields: Record<string, string>): {
  byPath: Record<string, string>;
  byAction: Record<number, Record<string, string>>;
  other: string[];
} {
  const byPath: Record<string, string> = {};
  const byAction: Record<number, Record<string, string>> = {};
  const other: string[] = [];
  for (const key of Object.keys(fields)) {
    const message = fields[key];
    const action = /^actions\[(\d+)\]\.(.+)$/.exec(key);
    if (key.indexOf('conditions.') === 0) {
      const rest = key.slice('conditions.'.length);
      const path = /^(?:field|operator|value)$/.test(rest) ? 'rules' : rest.replace(LEAF_KEY, '');
      if (!(path in byPath)) byPath[path] = message;
    } else if (action) {
      const i = Number(action[1]);
      byAction[i] = { ...byAction[i], [action[2]]: message };
    } else other.push(key === 'name' ? message : `${key}: ${message}`);
  }
  return { byPath, byAction, other };
}

const fieldSpec = (field: string): AutomationField | undefined =>
  FIELDS.MESSAGE_RECEIVED.concat(FIELDS.DEAL_LANE_CHANGED).find((f) => f.field === field);

/** A condition in words: "Message type is one of Text, Photo". */
export function conditionText(leaf: ConditionLeaf, o: AutomationOptions): string {
  const spec = fieldSpec(leaf.field);
  const label = spec?.label ?? leaf.field;
  if (spec?.type === 'boolean') {
    const [yes, no] = BOOLEAN_CHOICES[leaf.field as 'chat.new' | 'contact.inCrm'];
    return leaf.value === false ? no : yes;
  }
  const operator = OPERATOR_LABELS[leaf.operator] ?? leaf.operator;
  if (leaf.operator === 'is_empty' || leaf.operator === 'is_not_empty') return `${label} ${operator}`;
  const choices = spec?.type === 'choice' ? choicesFor(leaf.field, o) : [];
  const show = (v: string | number | boolean): string => {
    if (spec?.type === 'choice') return choices.find((c) => c.value === String(v))?.label ?? String(v);
    return spec?.type === 'text' ? `“${v}”` : String(v);
  };
  const v = leaf.value;
  let value: string;
  if (Array.isArray(v)) {
    const items = (v as (string | number)[]).map(show);
    value = leaf.operator === 'between' ? items.join(' and ') : items.join(', ');
  } else value = v === null ? '' : show(v);
  return `${label} ${operator} ${value}`.trim();
}

/** The same words the server puts in a rule's actions summary. */
export function actionSummary(a: AutomationAction, o: AutomationOptions): string {
  switch (a.type) {
    case 'SEND_TEMPLATE':
      return `Send “${o.templates.find((t) => t.id === a.templateId)?.name ?? a.templateId ?? ''}”`;
    case 'ASSIGN_CHAT': {
      const team = o.teams.find((t) => t.id === a.teamId)?.name ?? a.teamId ?? '';
      if (a.mode === 'TEAM_QUEUE') return `Queue in ${team}`;
      if (a.mode === 'TEAM_ROUND_ROBIN') return `Round robin in ${team}`;
      return `Assign to ${o.agents.find((u) => u.id === a.userId)?.name ?? a.userId ?? ''}`;
    }
    case 'ADD_TO_CRM': {
      if (!a.pipelineId) return 'Add to CRM (default pipeline)';
      const pipeline = o.crm.pipelines.find((p) => p.id === a.pipelineId);
      const lane = pipeline?.lanes.find((l) => l.id === a.stageId);
      const name = pipeline?.name ?? a.pipelineId;
      return `Add to CRM (${a.stageId ? `${name} › ${lane?.name ?? a.stageId}` : name})`;
    }
  }
}

/** The numbers an agent cannot see: owned by a team they are not in, and they do not see every number. */
export function agentBlindNumbers(agentId: string, o: AutomationOptions): AutomationOptions['numbers'] {
  const agent = o.agents.find((a) => a.id === agentId);
  if (agent?.seesAllNumbers) return [];
  return o.numbers.filter((n) => n.owningTeam !== null && !(agent?.teamIds ?? []).includes(n.owningTeam.id));
}
