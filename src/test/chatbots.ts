import type { Chatbot, ChatbotOptions, ChatbotSummary, Run, VersionView } from '@app/api/chatbots';
import { OPTIONS as AUTOMATION_OPTIONS } from './automations';
import type { MockRoute } from './fetchMock';

export const CHATBOTS_BASE = '/api/workspaces/w1/chatbots';

export const LEAD_QUALIFIER: Chatbot = {
  id: 'c1',
  name: 'Lead qualifier',
  description: null,
  status: 'DRAFT',
  flow: {
    nodes: [
      {
        id: 'n1',
        type: 'send_message',
        position: { x: 100, y: 100 },
        data: {
          name: 'Welcome',
          settings: {
            message: {
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: 'Hi {{contact.name}}, book a demo?' },
                action: {
                  buttons: [
                    { type: 'reply', reply: { id: 'yes', title: 'Yes' } },
                    { type: 'reply', reply: { id: 'no', title: 'No' } },
                  ],
                },
              },
            },
          },
        },
      },
      {
        id: 'n2',
        type: 'ask_question',
        position: { x: 500, y: 100 },
        data: { name: 'AskBudget', settings: { text: 'Your budget?', answerType: 'NUMBER', retries: 2 } },
      },
      {
        id: 'n3',
        type: 'send_message',
        position: { x: 900, y: 100 },
        data: {
          name: 'High',
          settings: { message: { type: 'text', text: { body: 'Great, {{AskBudget.answer}} it is' } } },
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', sourceHandle: 'reply:yes', target: 'n2' },
      { id: 'e2', source: 'n2', sourceHandle: 'next', target: 'n3' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
  settings: {
    reminderAfterMinutes: null,
    reminderMessage: null,
    endAfterMinutes: 120,
    endMessage: null,
    invalidReplyRetries: 2,
    retryMessage: "Sorry, I didn't get that. Please choose one of the options.",
    giveUpMessage: null,
    stopOnAgentReply: true,
  },
  versionNumber: 2,
  version: 3,
  createdBy: { id: 'u2', name: 'Demo Manager' },
  creationTime: '2026-11-13T09:00:00Z',
  lastUpdateTime: '2026-11-13T09:30:00Z',
  publishedAt: null,
  publishedBy: null,
};

export const PUBLISHED_BOT: Chatbot = {
  ...LEAD_QUALIFIER,
  id: 'c2',
  name: 'Price bot',
  status: 'PUBLISHED',
  publishedAt: '2026-11-13T10:00:00Z',
  publishedBy: { id: 'u2', name: 'Demo Manager' },
};

export const SUMMARIES: ChatbotSummary[] = [
  {
    id: 'c1',
    name: 'Lead qualifier',
    status: 'DRAFT',
    runs7d: 0,
    activeNow: 0,
    lastRunAt: null,
    lastUpdateTime: '2026-11-13T09:30:00Z',
  },
  {
    id: 'c2',
    name: 'Price bot',
    status: 'PUBLISHED',
    runs7d: 12,
    activeNow: 2,
    lastRunAt: '2026-11-13T10:30:00Z',
    lastUpdateTime: '2026-11-13T10:00:00Z',
  },
];

export const OPTIONS: ChatbotOptions = {
  numbers: AUTOMATION_OPTIONS.numbers,
  agents: AUTOMATION_OPTIONS.agents,
  teams: AUTOMATION_OPTIONS.teams,
  templates: AUTOMATION_OPTIONS.templates,
  crm: AUTOMATION_OPTIONS.crm,
  attributes: [
    { id: 'a1', name: 'City', key: 'city' },
    { id: 'a2', name: 'Budget', key: 'budget' },
  ],
  labels: [{ id: 'l1', name: 'VIP' }],
  chatbots: [
    { id: 'c1', name: 'Lead qualifier', status: 'DRAFT' },
    { id: 'c2', name: 'Price bot', status: 'PUBLISHED' },
  ],
};

export const VERSIONS: VersionView[] = [
  { versionNumber: 2, savedAt: '2026-11-13T09:30:00Z', savedBy: { id: 'u2', name: 'Demo Manager' } },
  { versionNumber: 1, savedAt: '2026-11-13T09:00:00Z', savedBy: { id: 'u2', name: 'Demo Manager' } },
];

export const RUN_WAITING: Run = {
  id: 'r1',
  chatbotId: 'c1',
  chatbotName: 'Lead qualifier',
  versionNumber: 2,
  chat: { id: 'ch1', remoteId: '919799750743@c.us' },
  contact: { id: 'k1', name: 'Veenu', phone: '919799750743' },
  number: { id: 'n1', label: 'Main line' },
  status: 'WAITING',
  currentNodeId: 'n2',
  currentNodeName: 'AskBudget',
  waiting: {
    kind: 'WHATSAPP_REPLY',
    key: 'ch1',
    since: '2026-11-13T10:00:05Z',
    expiresAt: null,
    prompt: 'Your budget?',
  },
  test: true,
  startedBy: { ruleId: null, ruleName: 'Test', eventId: null, userId: 'u2' },
  steps: [
    {
      index: 0,
      nodeId: 'n1',
      nodeName: 'Welcome',
      type: 'send_message',
      startedAt: '2026-11-13T10:00:00Z',
      finishedAt: '2026-11-13T10:00:01Z',
      outcome: 'DONE',
      output: 'reply:yes',
      summary: 'Reply “Yes”',
      error: null,
      result: { reply: { id: 'yes', title: 'Yes', text: 'yes' } },
      waitedFor: { kind: 'WHATSAPP_REPLY', key: 'ch1', since: '2026-11-13T10:00:00Z', expiresAt: null, prompt: 'Hi' },
    },
    {
      index: 1,
      nodeId: 'n2',
      nodeName: 'AskBudget',
      type: 'ask_question',
      startedAt: '2026-11-13T10:00:05Z',
      finishedAt: null,
      outcome: 'WAITING',
      output: null,
      summary: 'Asked “Your budget?”',
      error: null,
      result: null,
      waitedFor: {
        kind: 'WHATSAPP_REPLY',
        key: 'ch1',
        since: '2026-11-13T10:00:05Z',
        expiresAt: null,
        prompt: 'Your budget?',
      },
    },
  ],
  variables: {
    contact: { name: 'Veenu', phone: '919799750743', attributes: { city: 'Pune' }, labels: [], doNotContact: false },
    Welcome: { reply: { id: 'yes', title: 'Yes', text: 'yes' } },
  },
  endReason: null,
  stoppedBy: null,
  createdAt: '2026-11-13T10:00:00Z',
  finishedAt: null,
};

export const RUN_FORM_WAITING: Run = {
  ...RUN_WAITING,
  id: 'r3',
  currentNodeName: 'AskDetails',
  waiting: {
    kind: 'FORM',
    key: 'tok123',
    since: '2026-11-13T10:00:05Z',
    expiresAt: '2026-11-14T10:00:05Z',
    prompt: 'Your details',
  },
};

export const RUN_DONE: Run = {
  ...RUN_WAITING,
  id: 'r2',
  status: 'COMPLETED',
  currentNodeId: 'n3',
  currentNodeName: 'High',
  waiting: null,
  steps: [
    RUN_WAITING.steps[0],
    {
      ...RUN_WAITING.steps[1],
      finishedAt: '2026-11-13T10:01:00Z',
      outcome: 'DONE',
      output: 'next',
      result: { answer: 7000 },
    },
    {
      index: 2,
      nodeId: 'n3',
      nodeName: 'High',
      type: 'send_message',
      startedAt: '2026-11-13T10:01:00Z',
      finishedAt: '2026-11-13T10:01:01Z',
      outcome: 'DONE',
      output: 'next',
      summary: 'Sent “Great, 7000 it is”',
      error: null,
      result: null,
      waitedFor: null,
    },
  ],
  variables: { ...RUN_WAITING.variables, AskBudget: { answer: 7000 } },
  endReason: 'High: no edge from next',
  finishedAt: '2026-11-13T10:01:01Z',
};

export function chatbotRoutes(overrides: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    [`GET ${CHATBOTS_BASE}`]: { status: 200, body: SUMMARIES },
    [`GET ${CHATBOTS_BASE}/options`]: { status: 200, body: OPTIONS },
    [`GET ${CHATBOTS_BASE}/c1`]: { status: 200, body: LEAD_QUALIFIER },
    [`GET ${CHATBOTS_BASE}/c2`]: { status: 200, body: PUBLISHED_BOT },
    [`GET ${CHATBOTS_BASE}/c1/versions`]: { status: 200, body: VERSIONS },
    [`GET ${CHATBOTS_BASE}/c1/runs`]: { status: 200, body: { items: [RUN_WAITING, RUN_DONE], total: 2 } },
    [`GET ${CHATBOTS_BASE}/c1/runs/r1`]: { status: 200, body: RUN_WAITING },
    [`GET ${CHATBOTS_BASE}/c1/runs/r2`]: { status: 200, body: RUN_DONE },
    ...overrides,
  };
}
