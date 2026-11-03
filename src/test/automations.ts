import type { AutomationOptions, AutomationTest, Rule, RuleSummary } from '@app/api/automations';
import type { MockRoute } from './fetchMock';

export const AUTOMATIONS_BASE = '/api/workspaces/w1/automations';

export const OPTIONS: AutomationOptions = {
  numbers: [
    { id: 'n1', number: '919928088743', label: 'Main line', owningTeam: { id: 't1', name: 'Support' } },
    { id: 'n2', number: '919928088744', label: 'Sales line', owningTeam: null },
  ],
  agents: [
    { id: 'u1', name: 'Demo Agent', teamIds: ['t1'], seesAllNumbers: false },
    { id: 'u2', name: 'Demo Manager', teamIds: [], seesAllNumbers: true },
  ],
  teams: [{ id: 't1', name: 'Support' }],
  templates: [
    {
      id: 'tp1',
      name: 'Welcome',
      type: 'TEXT',
      placeholders: [{ name: 'contact.name', kind: 'CONTACT_FIELD', label: null, required: false, fallback: 'there' }],
    },
    {
      id: 'tp2',
      name: 'Order ready',
      type: 'TEXT',
      placeholders: [{ name: 'order_id', kind: 'AGENT', label: 'Order id', required: true, fallback: null }],
    },
  ],
  crm: {
    enabled: true,
    defaultPipelineId: 'p1',
    pipelines: [
      {
        id: 'p1',
        name: 'Sales',
        active: true,
        lanes: [
          { id: 's1', name: 'New', type: 'OPEN' },
          { id: 's2', name: 'Proposal sent', type: 'OPEN' },
          { id: 's3', name: 'Won', type: 'WON' },
          { id: 's4', name: 'Lost', type: 'LOST' },
        ],
      },
    ],
  },
};

export const WELCOME_RULE: Rule = {
  id: 'r1',
  name: 'Welcome new chats',
  description: null,
  event: 'MESSAGE_RECEIVED',
  priority: 1,
  conditions: { combinator: 'and', not: false, rules: [{ field: 'chat.new', operator: 'is', value: true }] },
  actions: [
    { type: 'SEND_TEMPLATE', templateId: 'tp1', values: {} },
    { type: 'ASSIGN_CHAT', mode: 'TEAM_ROUND_ROBIN', teamId: 't1', userId: null, whenAway: null },
    { type: 'ADD_TO_CRM', pipelineId: 'p1', stageId: 's1', dealTitle: null },
  ],
  status: 'DRAFT',
  version: 1,
  createdBy: { id: 'u2', name: 'Demo Manager' },
  creationTime: '2026-11-01T09:00:00Z',
  lastUpdateTime: '2026-11-01T09:00:00Z',
  publishedAt: null,
  publishedBy: null,
  activeTest: null,
};

export const PUBLISHED_RULE: Rule = {
  ...WELCOME_RULE,
  id: 'r2',
  name: 'Won deals thank-you',
  event: 'DEAL_LANE_CHANGED',
  priority: 2,
  conditions: { field: 'toLane.type', operator: 'is', value: 'WON' },
  actions: [{ type: 'SEND_TEMPLATE', templateId: 'tp1', values: {} }],
  status: 'PUBLISHED',
  version: 3,
  lastUpdateTime: '2026-11-02T09:00:00Z',
  publishedAt: '2026-11-02T09:00:00Z',
  publishedBy: { id: 'u2', name: 'Demo Manager' },
};

export const RULE_SUMMARIES: RuleSummary[] = [
  {
    id: 'r1',
    name: 'Welcome new chats',
    event: 'MESSAGE_RECEIVED',
    status: 'DRAFT',
    priority: 1,
    actionsSummary: 'Send Welcome, assign to Support, add to CRM',
    lastRunAt: null,
    runs7d: 0,
    failures7d: 0,
    creationTime: '2026-11-01T09:00:00Z',
  },
  {
    id: 'r2',
    name: 'Won deals thank-you',
    event: 'DEAL_LANE_CHANGED',
    status: 'PUBLISHED',
    priority: 2,
    actionsSummary: 'Send Welcome',
    lastRunAt: '2026-11-02T10:00:00Z',
    runs7d: 5,
    failures7d: 1,
    creationTime: '2026-11-01T09:30:00Z',
  },
];

const TEST_BASE: AutomationTest = {
  id: 'x1',
  ruleId: 'r1',
  ruleName: 'Welcome new chats',
  event: 'MESSAGE_RECEIVED',
  status: 'WAITING',
  endReason: null,
  startedBy: { id: 'u2', name: 'Demo Manager' },
  target: { contactId: 'c1', name: 'Asha Rao', phone: '919876543210' },
  treatAsNew: true,
  numbers: [{ id: 'n1', number: '919928088743', label: 'Main line' }],
  waitingSince: '2026-11-03T10:00:00Z',
  idleEndsAt: '2026-11-03T10:30:00Z',
  captured: null,
  conditionCount: 1,
  conditions: [],
  matched: null,
  actions: [],
  nextAction: null,
  runId: null,
};

export const WAITING_TEST: AutomationTest = TEST_BASE;

export const CAPTURED_TEST: AutomationTest = {
  ...TEST_BASE,
  status: 'CAPTURED',
  waitingSince: null,
  captured: {
    eventId: 'e1',
    at: '2026-11-03T10:05:00Z',
    treatedAsNew: true,
    data: {
      chat: { id: 'ch1', isNew: true, status: 'OPEN', assignedUser: null, assignedTeam: null },
      message: { id: 'm1', text: 'Hello', type: 'TEXT' },
      number: { id: 'n1', number: '919928088743', label: 'Main line' },
      contact: { id: 'c1', name: 'Asha Rao', phone: '919876543210', inCrm: false, doNotContact: false },
      deal: null,
      pipeline: null,
      fromLane: null,
      toLane: null,
    },
  },
  conditions: [{ path: '0', field: 'chat.new', operator: 'is', value: true, actual: true, passed: true }],
  actions: [
    { index: 0, type: 'SEND_TEMPLATE', summary: 'Send Welcome', outcome: null, reason: null, at: null },
    { index: 1, type: 'ASSIGN_CHAT', summary: 'Assign to Support', outcome: null, reason: null, at: null },
    { index: 2, type: 'ADD_TO_CRM', summary: 'Add to CRM', outcome: null, reason: null, at: null },
  ],
  nextAction: 0,
};

/** The routes every automations page calls; {@code overrides} replace or add to them. */
export function automationRoutes(overrides: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    [`GET ${AUTOMATIONS_BASE}/options`]: { status: 200, body: OPTIONS },
    [`GET ${AUTOMATIONS_BASE}/rules`]: { status: 200, body: RULE_SUMMARIES },
    ...overrides,
  };
}
