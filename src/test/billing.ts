import type {
  BillingOptions,
  BillingProfile,
  BillingSettings,
  CreditNote,
  FeatureGroup,
  IndianState,
  Invoice,
  LimitKeyInfo,
  Order,
  Party,
  Plan,
  Quote,
  Refund,
  Subscription,
  SubscriptionSummary,
  Tax,
  UsageDay,
  Wallet,
  WalletEntry,
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
  // a chatbot is started by an automation rule
  { ...seed('chatbots', 'Chatbots', 'PAID', 70, ['chatbot:view', 'chatbot:manage']), requires: ['automations'] },
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
  creditBalance: 0,
  next: null,
  cancelled: false,
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
    creditBalance: 0,
    next: null,
    cancelled: false,
    ...over,
  };
}

/** Settings with the supplier filled in, so orders can be raised. */
export const SETTINGS: BillingSettings = {
  zone: 'Asia/Kolkata',
  graceDays: 7,
  customersWithoutPlan: 'UNRESTRICTED',
  version: null,
  supplierLegalName: 'Omni Cloud Pvt Ltd',
  supplierAddress: '12 Residency Road, Bengaluru 560025',
  supplierStateCode: '29',
  supplierGstin: '29AAACO1234A1Z5',
  sacCode: '998314',
  gstRatePercent: 18,
  invoicePrefix: 'INV',
  creditNotePrefix: 'CN',
  quoteValidDays: 7,
  renewalWindowDays: 30,
  paymentInstructions: 'UPI omni@bank',
  complete: true,
};

/** Settings as a new installation has them: no supplier yet. */
export const NEW_SETTINGS: BillingSettings = {
  ...SETTINGS,
  supplierLegalName: null,
  supplierAddress: null,
  supplierStateCode: null,
  supplierGstin: null,
  sacCode: null,
  paymentInstructions: null,
  complete: false,
};

export const STATES: IndianState[] = [
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
];

export const PROFILE: BillingProfile = {
  legalName: 'Acme Retail Pvt Ltd',
  address: '1 MG Road, Bengaluru 560001',
  stateCode: '29',
  gstin: null,
  complete: true,
};

export const NO_PROFILE: BillingProfile = {
  legalName: null,
  address: null,
  stateCode: null,
  gstin: null,
  complete: false,
};

const SUPPLIER: Party = {
  legalName: 'Omni Cloud Pvt Ltd',
  address: '12 Residency Road, Bengaluru 560025',
  stateCode: '29',
  stateName: 'Karnataka',
  gstin: '29AAACO1234A1Z5',
};
const ACME_PARTY: Party = {
  legalName: 'Acme Retail Pvt Ltd',
  address: '1 MG Road, Bengaluru 560001',
  stateCode: '29',
  stateName: 'Karnataka',
  gstin: null,
};

/** Within the state: 18% as CGST 9% and SGST 9% of 900.00. */
export const TAX_A: Tax = { ratePercent: 18, cgst: 81, sgst: 81, igst: 0, interState: false };

/** Step A of the worked example: Gold from 1 Dec 2026, 900.00 + 162.00 tax = 1,062.00. */
export function quote(over: Partial<Quote> = {}): Quote {
  return {
    kind: 'NEW',
    lines: [
      {
        type: 'PLAN',
        description: 'Gold, monthly (1 Dec 2026 – 31 Dec 2026)',
        groupCode: null,
        limitKey: null,
        quantity: 0,
        listAmount: 1000,
        amount: 900,
      },
    ],
    extraDiscountPercent: 0,
    taxable: 900,
    tax: TAX_A,
    total: 1062,
    credits: [],
    creditFromNotes: 0,
    accountCredit: 0,
    accountCreditUsed: 0,
    payable: 1062,
    planCode: 'gold-monthly',
    planName: 'Gold',
    period: 'MONTHLY',
    termStart: '2026-11-30T18:30:00Z',
    termEnd: '2026-12-31T18:30:00Z',
    validUntil: '2026-12-08T05:00:00Z',
    ...over,
  };
}

/** Step D: an upgrade to Platinum on 16 Dec, with credit for the unused days of invoices 1 and 2. */
export function upgradeQuote(over: Partial<Quote> = {}): Quote {
  return quote({
    kind: 'UPGRADE',
    lines: [
      {
        type: 'PLAN',
        description: 'Platinum, monthly (16 Dec 2026 – 15 Jan 2027)',
        groupCode: null,
        limitKey: null,
        quantity: 0,
        listAmount: 1500,
        amount: 1500,
      },
    ],
    taxable: 1500,
    tax: { ratePercent: 18, cgst: 135, sgst: 135, igst: 0, interState: false },
    total: 1770,
    credits: [
      {
        creditNoteId: 'n1',
        invoiceId: 'i1',
        invoiceNumber: 'INV/26-27/000001',
        description: 'Unused value on invoice INV/26-27/000001',
        taxable: 464.52,
        tax: { ratePercent: 18, cgst: 41.81, sgst: 41.8, igst: 0, interState: false },
        total: 548.13,
      },
      {
        creditNoteId: 'n2',
        invoiceId: 'i2',
        invoiceNumber: 'INV/26-27/000002',
        description: 'Unused value on invoice INV/26-27/000002',
        taxable: 154.84,
        tax: { ratePercent: 18, cgst: 13.94, sgst: 13.93, igst: 0, interState: false },
        total: 182.71,
      },
    ],
    creditFromNotes: 730.84,
    accountCreditUsed: 730.84,
    payable: 1039.16,
    planCode: 'platinum-monthly',
    planName: 'Platinum',
    termStart: '2026-12-15T18:30:00Z',
    termEnd: '2027-01-15T18:30:00Z',
    validUntil: '2026-12-23T05:00:00Z',
    ...over,
  });
}

/** Step F: the same plan for a customer in another state, taxed as IGST. */
export function interStateQuote(over: Partial<Quote> = {}): Quote {
  return quote({ tax: { ratePercent: 18, cgst: 0, sgst: 0, igst: 162, interState: true }, ...over });
}

/** Step A as an order waiting for payment, raised by staff for Acme. */
export function order(over: Partial<Order> = {}): Order {
  return {
    ...quote(),
    id: 'o1',
    number: 'ORD-000001',
    customerId: 'c1',
    customerName: 'Acme',
    status: 'REQUESTED',
    raisedBy: 'u2',
    raisedByName: 'Asha Manager',
    raisedByStaff: true,
    raisedAt: '2026-12-01T05:00:00Z',
    reason: null,
    extraDiscountReason: null,
    payment: null,
    invoiceId: null,
    invoiceNumber: null,
    creditNoteIds: [],
    rejectedReason: null,
    creditPosting: null,
    newTermEnd: null,
    ...over,
  };
}

/** Step A after its payment was recorded. */
export function paidOrder(over: Partial<Order> = {}): Order {
  return order({
    status: 'ACTIVATED',
    payment: {
      method: 'UPI',
      reference: 'UTR-778899',
      receivedOn: '2026-12-01',
      note: null,
      recordedByName: 'Asha Manager',
      recordedAt: '2026-12-01T05:00:00Z',
    },
    invoiceId: 'i1',
    invoiceNumber: 'INV/26-27/000001',
    ...over,
  });
}

/** The invoice of step A. */
export function invoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: 'i1',
    number: 'INV/26-27/000001',
    issuedAt: '2026-12-01T05:00:00Z',
    orderId: 'o1',
    orderNumber: 'ORD-000001',
    supplier: SUPPLIER,
    customer: ACME_PARTY,
    sacCode: '998314',
    lines: [{ description: 'Gold, monthly (1 Dec 2026 – 31 Dec 2026)', amount: 900 }],
    taxable: 900,
    tax: TAX_A,
    total: 1062,
    totalInWords: 'Rupees One Thousand Sixty-Two Only',
    accountCreditUsed: 0,
    amountPaid: 1062,
    payment: paidOrder().payment,
    credited: 0,
    hasPdf: true,
    ...over,
  };
}

/** The first credit note of step D, against the invoice of step A. */
export function creditNote(over: Partial<CreditNote> = {}): CreditNote {
  return {
    id: 'n1',
    number: 'CN/26-27/000001',
    issuedAt: '2026-12-16T05:00:00Z',
    orderId: 'o4',
    invoiceId: 'i1',
    invoiceNumber: 'INV/26-27/000001',
    invoiceDate: '2026-12-01T05:00:00Z',
    supplier: SUPPLIER,
    customer: ACME_PARTY,
    lines: [{ description: 'Unused value on invoice INV/26-27/000001', amount: 464.52 }],
    taxable: 464.52,
    tax: { ratePercent: 18, cgst: 41.81, sgst: 41.8, igst: 0, interState: false },
    total: 548.13,
    totalInWords: 'Rupees Five Hundred Forty-Eight and Thirteen Paise Only',
    reason: 'Unused time on upgrade',
    hasPdf: true,
    ...over,
  };
}

export function refund(over: Partial<Refund> = {}): Refund {
  return {
    id: 'r1',
    number: 'RF-000001',
    amount: 100,
    method: 'BANK_TRANSFER',
    reference: 'NEFT-77',
    paidOn: '2026-12-17',
    note: null,
    recordedByName: 'Nagesh Kumar',
    recordedAt: '2026-12-17T05:00:00Z',
    status: 'RECORDED',
    ...over,
  };
}

/** What Acme on Gold may ask for on 16 Dec: renew, move to Platinum, buy automations or more users. */
export const OPTIONS: BillingOptions = {
  paymentInstructions: 'UPI omni@bank',
  renewal: { allowed: true, reason: null, from: null },
  upgrades: [{ code: 'platinum-monthly', name: 'Platinum', period: 'MONTHLY', rank: 3, discountedPrice: 1500 }],
  addOns: [
    {
      kind: 'GROUP',
      groupCode: 'automations',
      name: 'Automations',
      limitKey: null,
      label: null,
      unit: 0,
      unitPrice: 300,
    },
    { kind: 'LIMIT', groupCode: null, name: 'Extra users', limitKey: 'USERS', label: 'Users', unit: 5, unitPrice: 100 },
  ],
  topUp: { allowed: true, reason: null, min: 100, max: 1000000 },
  messageRate: 0.25,
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
    lowWallet: false,
  };
}

/** Acme's wallet after a top-up of 1,000.00 and three messages at 0.25. */
export function wallet(over: Partial<Wallet> = {}): Wallet {
  return { balance: 999.25, lowBalanceAt: null, low: false, messageRate: 0.25, refundable: 999.25, ...over };
}

/** A customer that never topped up, on a plan that charges nothing. */
export const NO_WALLET: Wallet = { balance: 0, lowBalanceAt: null, low: false, messageRate: null, refundable: 0 };

/** One message sent from the console in Brand A, as staff see it. */
export function walletEntry(over: Partial<WalletEntry> = {}): WalletEntry {
  return {
    id: 'e2',
    type: 'USAGE',
    amount: -0.25,
    balanceAfter: 999.75,
    meter: 'WHATSAPP_MESSAGE',
    source: 'CONSOLE',
    workspaceId: 'w1',
    workspaceName: 'Brand A',
    ref: null,
    note: null,
    byName: 'Ravi Agent',
    at: '2026-12-01T06:00:00Z',
    ...over,
  };
}

/** The worked example's ledger, newest first: a top-up, three messages, one returned, a refund of 400. */
export const LEDGER: WalletEntry[] = [
  walletEntry({
    id: 'e6',
    type: 'REFUND',
    amount: -400,
    balanceAfter: 599.5,
    meter: null,
    source: null,
    workspaceId: null,
    workspaceName: null,
    ref: 'ORD-000007',
    note: 'Closing the account',
    byName: 'Asha Manager',
    at: '2026-12-02T05:00:00Z',
  }),
  walletEntry({
    id: 'e5',
    type: 'REVERSAL',
    amount: 0.25,
    balanceAfter: 999.5,
    source: 'CAMPAIGN',
    ref: 'e4',
    note: 'the phone refused it',
    byName: null,
    at: '2026-12-01T06:03:00Z',
  }),
  walletEntry({ id: 'e4', amount: -0.25, balanceAfter: 999.25, source: 'CAMPAIGN', byName: null, ref: 'cmp1' }),
  walletEntry({ id: 'e3', amount: -0.25, balanceAfter: 999.5, source: 'CHATBOT', byName: null }),
  walletEntry(),
  walletEntry({
    id: 'e1',
    type: 'TOPUP',
    amount: 1000,
    balanceAfter: 1000,
    meter: null,
    source: null,
    workspaceId: null,
    workspaceName: null,
    ref: 'ORD-000006',
    byName: 'Asha Manager',
    at: '2026-12-01T05:00:00Z',
  }),
];

export const USAGE_DAYS: UsageDay[] = [
  { day: '2026-12-02', source: 'CAMPAIGN', messages: 120, amount: 30 },
  { day: '2026-12-01', source: 'CONSOLE', messages: 1, amount: 0.25 },
  { day: '2026-12-01', source: 'CHATBOT', messages: 3, amount: 0.7575 },
];

/** Worked example T: a top-up of 1,000.00 for Acme, 1,000.00 + 90.00 + 90.00 = 1,180.00. */
export function topUpQuote(over: Partial<Quote> = {}): Quote {
  return quote({
    kind: 'TOPUP',
    lines: [
      {
        type: 'TOPUP',
        description: 'Wallet top-up',
        groupCode: null,
        limitKey: null,
        quantity: 0,
        listAmount: 1000,
        amount: 1000,
      },
    ],
    taxable: 1000,
    tax: { ratePercent: 18, cgst: 90, sgst: 90, igst: 0, interState: false },
    total: 1180,
    payable: 1180,
    ...over,
  });
}

/** Refunding 400.00 of the wallet: a credit note of 400.00 + 72.00 against the top-up's invoice, nothing to pay. */
export function walletRefundQuote(over: Partial<Quote> = {}): Quote {
  return quote({
    kind: 'WALLET_REFUND',
    lines: [],
    taxable: 0,
    tax: { ratePercent: 18, cgst: 0, sgst: 0, igst: 0, interState: false },
    total: 0,
    credits: [
      {
        creditNoteId: '',
        invoiceId: 'i6',
        invoiceNumber: 'INV/26-27/000006',
        description: 'Wallet refunded',
        taxable: 400,
        tax: { ratePercent: 18, cgst: 36, sgst: 36, igst: 0, interState: false },
        total: 472,
      },
    ],
    creditFromNotes: 472,
    payable: 0,
    validUntil: null,
    ...over,
  });
}

/** Routes for every billing GET, each replaceable. */
export function billingRoutes(over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    'GET /api/billing/feature-groups': { status: 200, body: SEEDED_GROUPS },
    'GET /api/billing/feature-groups/ungrouped': { status: 200, body: [] },
    'GET /api/billing/plans': { status: 200, body: [plan()] },
    'GET /api/billing/limit-keys': { status: 200, body: LIMIT_KEYS },
    'GET /api/billing/settings': { status: 200, body: SETTINGS },
    'GET /api/billing/states': { status: 200, body: STATES },
    // Acme (c1) is the customer of every staff test
    'GET /api/billing/customers/c1/wallet': { status: 200, body: wallet() },
    'GET /api/billing/customers/c1/options': { status: 200, body: OPTIONS },
    ...over,
  };
}

/** Routes for every GET of the customer's own Plan & billing page, each replaceable. */
export function myBillingRoutes(over: Record<string, MockRoute> = {}): Record<string, MockRoute> {
  return {
    'GET /api/my/billing/subscription': { status: 200, body: subscription() },
    'GET /api/my/billing/options': { status: 200, body: OPTIONS },
    'GET /api/my/billing/orders': { status: 200, body: [] },
    'GET /api/my/billing/invoices': { status: 200, body: [] },
    'GET /api/my/billing/credit-notes': { status: 200, body: [] },
    'GET /api/my/billing/refunds': { status: 200, body: [] },
    'GET /api/my/billing/profile': { status: 200, body: PROFILE },
    'GET /api/my/billing/states': { status: 200, body: STATES },
    'GET /api/my/billing/wallet': { status: 200, body: wallet() },
    ...over,
  };
}
