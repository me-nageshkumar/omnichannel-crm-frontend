import { apiFetch } from '@app/api/client';
import type { Page } from '@app/api/historyImports';

export type { Page };

type Ref = { id: string; name: string };
type Lane = { id: string; name: string | null; type: 'OPEN' | 'WON' | 'LOST' };

export type EventKind = 'MESSAGE_RECEIVED' | 'DEAL_LANE_CHANGED';
export type MessageKind =
  | 'TEXT'
  | 'PHOTO'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'STICKER'
  | 'LOCATION'
  | 'CONTACT_CARD'
  | 'POLL';

export type ConditionNode =
  | { combinator: 'and' | 'or'; not: boolean; rules: ConditionNode[] }
  | { field: string; operator: string; value: string | number | boolean | string[] | number[] | null };
export type ConditionGroup = Extract<ConditionNode, { rules: unknown }>;
export type ConditionLeaf = Extract<ConditionNode, { field: string }>;

export type AutomationAction = {
  type: 'SEND_TEMPLATE' | 'ASSIGN_CHAT' | 'ADD_TO_CRM';
  // SEND_TEMPLATE
  templateId?: string | null;
  values?: Record<string, string>;
  // ASSIGN_CHAT
  mode?: 'AGENT' | 'TEAM_QUEUE' | 'TEAM_ROUND_ROBIN';
  userId?: string | null;
  teamId?: string | null;
  whenAway?: 'KEEP_WITH_AGENT' | 'OWNING_TEAM_QUEUE' | null;
  // ADD_TO_CRM
  pipelineId?: string | null;
  stageId?: string | null;
  dealTitle?: string | null;
};

export type TestStatus = 'WAITING' | 'CAPTURED' | 'ENDED';

export type RuleRequest = {
  name: string;
  description: string | null;
  event: EventKind;
  priority: number | null;
  conditions: ConditionNode | null;
  actions: AutomationAction[];
  version?: number;
};

export type Rule = RuleRequest & {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  version: number;
  createdBy: Ref | null;
  creationTime: string;
  lastUpdateTime: string;
  publishedAt: string | null;
  publishedBy: Ref | null;
  activeTest: { id: string; startedBy: Ref; status: TestStatus } | null;
};

export type RuleSummary = {
  id: string;
  name: string;
  event: EventKind;
  status: 'DRAFT' | 'PUBLISHED';
  priority: number | null;
  actionsSummary: string;
  lastRunAt: string | null;
  runs7d: number;
  failures7d: number;
  creationTime: string;
};

export type AutomationOptions = {
  numbers: { id: string; number: string; label: string | null; owningTeam: Ref | null }[];
  agents: { id: string; name: string; teamIds: string[]; seesAllNumbers: boolean }[];
  teams: Ref[];
  templates: {
    id: string;
    name: string;
    type: string;
    placeholders: {
      name: string;
      kind: 'CONTACT_FIELD' | 'CONTACT_ATTRIBUTE' | 'AGENT';
      label: string | null;
      required: boolean;
      fallback: string | null;
    }[];
  }[];
  crm: {
    enabled: boolean;
    defaultPipelineId: string | null;
    pipelines: {
      id: string;
      name: string;
      active: boolean;
      lanes: { id: string; name: string; type: 'OPEN' | 'WON' | 'LOST' }[];
    }[];
  };
};

export type EventData = {
  chat: {
    id: string;
    isNew: boolean;
    status: 'OPEN' | 'CLOSED' | null;
    assignedUser: Ref | null;
    assignedTeam: Ref | null;
  } | null;
  message: {
    id: string;
    text: string | null;
    type: MessageKind;
    ad: { sourceId: string | null; sourceUrl: string | null; headline: string | null } | null;
  } | null;
  number: { id: string; number: string; label: string | null } | null;
  contact: { id: string; name: string | null; phone: string | null; inCrm: boolean; doNotContact: boolean } | null;
  deal: {
    id: string;
    title: string;
    status: 'OPEN' | 'WON' | 'LOST';
    amount: number | null;
    currency: string | null;
    owner: Ref | null;
    lostReason: string | null;
  } | null;
  pipeline: Ref | null;
  fromLane: Lane | null;
  toLane: Lane | null;
};

export type StepView = {
  index: number;
  type: AutomationAction['type'];
  summary: string;
  outcome: 'DONE' | 'SKIPPED' | 'FAILED' | 'RETRYING' | 'INTERRUPTED' | null;
  reason: string | null;
  at: string | null;
};

export type Preflight = {
  canRun: boolean;
  checks: { level: 'BLOCKER' | 'WARNING'; actionIndex: number | null; message: string }[];
};

export type Run = {
  id: string;
  eventId: string;
  ruleId: string;
  ruleName: string;
  test: boolean;
  status: 'RUNNING' | 'TESTING' | 'DONE' | 'FAILED' | 'INTERRUPTED';
  eventKind: EventKind;
  summary: string;
  contact: { id: string; name: string | null; phone: string | null } | null;
  deal: { id: string; title: string } | null;
  startedAt: string;
  finishedAt: string | null;
  steps: StepView[];
};

export type EventRecord = {
  id: string;
  kind: EventKind;
  createdAt: string;
  finishedAt: string;
  outcome: 'DONE' | 'FAILED';
  error: string | null;
  summary: string;
  contact: Run['contact'];
  deal: Run['deal'];
  number: EventData['number'];
  test: boolean;
  runs: Run[];
};

export type TestContact = {
  contactId: string;
  name: string | null;
  phone: string | null;
  numbers: { id: string; number: string; label: string | null }[];
};

/** Exactly one of contactId / phone is set. */
export type TestStartRequest = { contactId: string | null; phone: string | null; treatAsNew: boolean };

export type AutomationTest = {
  id: string;
  ruleId: string;
  ruleName: string;
  event: EventKind;
  status: TestStatus;
  endReason: 'DONE' | 'IDLE' | 'RULE_PUBLISHED' | 'RULE_DELETED' | null;
  startedBy: Ref;
  target: { contactId: string | null; name: string | null; phone: string | null };
  treatAsNew: boolean;
  /** Where the test contact should write (message event). */
  numbers: { id: string; number: string; label: string | null }[];
  waitingSince: string | null;
  idleEndsAt: string;
  captured: { eventId: string; at: string; data: EventData; treatedAsNew: boolean } | null;
  conditionCount: number;
  conditions: { path: string; field: string; operator: string; value: unknown; actual: unknown; passed: boolean }[];
  /** Set once every condition is checked (true with none). */
  matched: boolean | null;
  actions: StepView[];
  nextAction: number | null;
  runId: string | null;
};

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/automations`;
const rulePath = (ws: string, id: string) => `${base(ws)}/rules/${encodeURIComponent(id)}`;
const testPath = (ws: string, id: string) => `${base(ws)}/tests/${encodeURIComponent(id)}`;
const withQuery = (path: string, params: [string, string | number | undefined][]) => {
  const query = new URLSearchParams();
  for (const [k, v] of params) if (v !== undefined) query.set(k, String(v));
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
};

export const getAutomationOptions = (token: string, ws: string) =>
  apiFetch<AutomationOptions>(`${base(ws)}/options`, { token });

export const listRules = (token: string, ws: string) => apiFetch<RuleSummary[]>(`${base(ws)}/rules`, { token });

export const getRule = (token: string, ws: string, id: string) => apiFetch<Rule>(rulePath(ws, id), { token });

export const createRule = (token: string, ws: string, body: RuleRequest) =>
  apiFetch<Rule>(`${base(ws)}/rules`, { token, method: 'POST', body });

export const updateRule = (token: string, ws: string, id: string, body: RuleRequest) =>
  apiFetch<Rule>(rulePath(ws, id), { token, method: 'PUT', body });

export const publishRule = (token: string, ws: string, id: string) =>
  apiFetch<Rule>(`${rulePath(ws, id)}/publish`, { token, method: 'POST' });

export const unpublishRule = (token: string, ws: string, id: string) =>
  apiFetch<Rule>(`${rulePath(ws, id)}/unpublish`, { token, method: 'POST' });

export const deleteRule = (token: string, ws: string, id: string) =>
  apiFetch<void>(rulePath(ws, id), { token, method: 'DELETE' });

export const listRuns = (token: string, ws: string, ruleId: string, page = 0) =>
  apiFetch<Page<Run>>(withQuery(`${rulePath(ws, ruleId)}/runs`, [['page', page]]), { token });

export const listEvents = (
  token: string,
  ws: string,
  f: { kind?: EventKind; ruleId?: string; contactId?: string; from?: string; to?: string; page?: number } = {},
) =>
  apiFetch<Page<EventRecord>>(
    withQuery(`${base(ws)}/events`, [
      ['kind', f.kind],
      ['ruleId', f.ruleId],
      ['contactId', f.contactId],
      ['from', f.from],
      ['to', f.to],
      ['page', f.page],
    ]),
    { token },
  );

export const searchTestContacts = (token: string, ws: string, q: string) =>
  apiFetch<TestContact[]>(withQuery(`${base(ws)}/test-contacts`, [['q', q]]), { token });

export const startTest = (token: string, ws: string, ruleId: string, body: TestStartRequest) =>
  apiFetch<AutomationTest>(`${rulePath(ws, ruleId)}/tests`, { token, method: 'POST', body });

/** The rule's open test, or undefined when there is none (the server answers 204, which apiFetch returns as undefined). */
export const getActiveTest = (token: string, ws: string, ruleId: string) =>
  apiFetch<AutomationTest | undefined>(`${rulePath(ws, ruleId)}/tests/active`, { token });

export const getTest = (token: string, ws: string, testId: string) =>
  apiFetch<AutomationTest>(testPath(ws, testId), { token });

export const checkNextCondition = (token: string, ws: string, testId: string) =>
  apiFetch<AutomationTest>(`${testPath(ws, testId)}/check`, { token, method: 'POST' });

export const runTestAction = (token: string, ws: string, testId: string, index: number) =>
  apiFetch<AutomationTest>(`${testPath(ws, testId)}/actions/${index}/run`, { token, method: 'POST' });

export const skipTestAction = (token: string, ws: string, testId: string, index: number) =>
  apiFetch<AutomationTest>(`${testPath(ws, testId)}/actions/${index}/skip`, { token, method: 'POST' });

export const testAgain = (token: string, ws: string, testId: string) =>
  apiFetch<AutomationTest>(`${testPath(ws, testId)}/again`, { token, method: 'POST' });

export const endTest = (token: string, ws: string, testId: string) =>
  apiFetch<AutomationTest>(`${testPath(ws, testId)}/end`, { token, method: 'POST' });

export const getTestPreflight = (token: string, ws: string, ruleId: string) =>
  apiFetch<Preflight>(`${rulePath(ws, ruleId)}/tests/preflight`, { token });

export const replayTest = (token: string, ws: string, testId: string) =>
  apiFetch<AutomationTest>(`${testPath(ws, testId)}/replay`, { token, method: 'POST' });
