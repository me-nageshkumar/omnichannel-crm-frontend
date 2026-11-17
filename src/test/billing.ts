import type {
  BillingSettings,
  FeatureGroup,
  LimitKeyInfo,
  Plan,
  Subscription,
  SubscriptionSummary,
} from '@app/api/billing';
import type { MockRoute } from './fetchMock';

export function group(over: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    code: 'crm',
    name: 'CRM',
    description: 'Deals, pipelines, companies and tasks',
    category: 'PAID',
    authorities: ['crm:view', 'crm:edit'],
    requires: [],
    builtIn: true,
    sortOrder: 90,
    version: 0,
    planCodes: [],
    ...over,
  };
}

const seed = (
  code: string,
  name: string,
  category: FeatureGroup['category'],
  sortOrder: number,
  authorities: string[],
) => group({ code, name, category, sortOrder, authorities, description: '' });

/** The nine groups a new installation starts with. */
export const SEEDED_GROUPS: FeatureGroup[] = [
  seed('core', 'Core', 'DEFAULT', 10, ['user:manage', 'user:view', 'workspace:settings', 'billing:view']),
  seed('inbox', 'Inbox', 'DEFAULT', 20, ['inbox:view', 'inbox:send']),
  seed('contacts', 'Contacts', 'DEFAULT', 30, ['contact:view', 'contact:edit']),
  seed('templates', 'Templates', 'DEFAULT', 40, ['template:view', 'template:manage']),
  seed('campaigns', 'Campaigns', 'PAID', 50, ['campaign:view', 'campaign:manage']),
  seed('automations', 'Automations', 'PAID', 60, ['automation:view', 'automation:manage']),
  seed('chatbots', 'Chatbots', 'PAID', 70, ['chatbot:view', 'chatbot:manage']),
  { ...seed('ai', 'AI', 'PAID', 80, ['ai:view', 'ai:manage']), requires: ['chatbots'] },
  seed('crm', 'CRM', 'PAID', 90, ['crm:view', 'crm:edit', 'crm:export']),
];

export function plan(over: Partial<Plan> = {}): Plan {
  return {
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
    status: 'ACTIVE',
    revision: 0,
    version: 1,
    actualPrice: 1000,
    discountAmount: 100,
    discountedPrice: 900,
    customers: 0,
    ...over,
  };
}

export const LIMIT_KEYS: LimitKeyInfo[] = [
  { key: 'USERS', scope: 'CUSTOMER', label: 'Users' },
  { key: 'BRANDS', scope: 'CUSTOMER', label: 'Brands' },
  { key: 'PHONE_NUMBERS', scope: 'CUSTOMER', label: 'WhatsApp numbers' },
  { key: 'AUTOMATION_RULES', scope: 'CUSTOMER', label: 'Automation rules' },
  { key: 'CHATBOTS', scope: 'CUSTOMER', label: 'Chatbots' },
  { key: 'AI_PROFILES', scope: 'CUSTOMER', label: 'AI profiles' },
  { key: 'CHATBOT_NODES', scope: 'CHATBOT', label: 'Nodes per chatbot' },
  { key: 'CHATBOT_AI_NODES', scope: 'CHATBOT', label: 'AI nodes per chatbot' },
  { key: 'CRM_PIPELINES', scope: 'BRAND', label: 'CRM pipelines per brand' },
  { key: 'CRM_CUSTOM_FIELDS', scope: 'BRAND', label: 'CRM custom fields per record type' },
];

export const NO_SUBSCRIPTION: Subscription = {
  state: 'NONE',
  readOnly: false,
  plan: null,
  termStart: null,
  termEnd: null,
  graceEnd: null,
  zone: 'Asia/Kolkata',
  groups: [],
  addOns: [],
  limits: LIMIT_KEYS.map((k) => ({
    key: k.key,
    label: k.label,
    scope: k.scope,
    limit: null,
    used: k.scope === 'CUSTOMER' ? 1 : null,
  })),
  revision: 0,
};

/** On Gold from 1 Dec 2026 to 31 Dec 2026 (India), with automations as an add-on and 3 of 5 users. */
export function subscription(over: Partial<Subscription> = {}): Subscription {
  return {
    state: 'ACTIVE',
    readOnly: false,
    plan: { code: 'gold-monthly', name: 'Gold', period: 'MONTHLY', rank: 2 },
    termStart: '2026-11-30T18:30:00Z',
    termEnd: '2026-12-31T18:30:00Z',
    graceEnd: '2027-01-07T18:30:00Z',
    zone: 'Asia/Kolkata',
    groups: [
      { code: 'core', name: 'Core', source: 'DEFAULT' },
      { code: 'inbox', name: 'Inbox', source: 'DEFAULT' },
      { code: 'crm', name: 'CRM', source: 'PLAN' },
      { code: 'automations', name: 'Automations', source: 'ADDON' },
    ],
    addOns: [{ id: 'a1', kind: 'GROUP', groupCode: 'automations', limitKey: null, quantity: 0 }],
    limits: NO_SUBSCRIPTION.limits.map((l) => (l.key === 'USERS' ? { ...l, limit: 5, used: 3 } : l)),
    revision: 1,
    ...over,
  };
}

export const SETTINGS: BillingSettings = {
  zone: 'Asia/Kolkata',
  graceDays: 7,
  customersWithoutPlan: 'UNRESTRICTED',
  version: null,
};

/** What `/users/me` carries for a customer on Gold in the given state. */
export function summaryIn(state: SubscriptionSummary['state']): SubscriptionSummary {
  return {
    state,
    planName: 'Gold',
    termEnd: '2026-12-31T18:30:00Z',
    graceEnd: '2027-01-07T18:30:00Z',
    readOnly: state === 'EXPIRED',
    zone: 'Asia/Kolkata',
  };
}

/** Routes for every billing GET, each replaceable. */
export function billingRoutes(over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    'GET /api/billing/feature-groups': { status: 200, body: SEEDED_GROUPS },
    'GET /api/billing/feature-groups/ungrouped': { status: 200, body: [] },
    'GET /api/billing/plans': { status: 200, body: [plan()] },
    'GET /api/billing/limit-keys': { status: 200, body: LIMIT_KEYS },
    'GET /api/billing/settings': { status: 200, body: SETTINGS },
    ...over,
  };
}
