import { apiFetch } from '@app/api/client';
import type { RoleLevel } from '@app/api/roles';

export type GroupCategory = 'DEFAULT' | 'PAID';
export type BillingPeriod = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';
export type SubscriptionState = 'NONE' | 'ACTIVE' | 'GRACE' | 'EXPIRED';
export type WithoutPlan = 'UNRESTRICTED' | 'READ_ONLY';

export const PERIODS: BillingPeriod[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];

export const PERIOD_LABEL: Record<BillingPeriod, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
};

/** For a sentence: "₹900 per month". */
export const PERIOD_UNIT: Record<BillingPeriod, string> = {
  MONTHLY: 'month',
  QUARTERLY: 'quarter',
  HALF_YEARLY: 'half year',
  YEARLY: 'year',
};

export const PERIOD_MONTHS: Record<BillingPeriod, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };

/** Authorities that are sold together. An authority is in at most one group. */
export interface FeatureGroup {
  code: string;
  name: string;
  description: string;
  /** DEFAULT groups are in every plan; PAID ones are in a plan or held as an add-on. */
  category: GroupCategory;
  authorities: string[];
  /** Codes of the groups that must be present with this one. */
  requires: string[];
  builtIn: boolean;
  sortOrder: number;
  version: number;
  /** The plans that include it or offer it as an add-on. */
  planCodes: string[];
}

export interface FeatureGroupInput {
  name: string;
  description: string;
  category: GroupCategory;
  authorities: string[];
  requires: string[];
  sortOrder: number;
}

export interface Ungrouped {
  code: string;
  description: string;
  level: RoleLevel;
}

export interface PlanItem {
  groupCode: string;
  price: number;
}

export interface LimitAddOn {
  key: string;
  unitPrice: number;
  unit: number;
}

export interface PlanInput {
  code: string;
  name: string;
  description: string;
  period: BillingPeriod;
  rank: number;
  items: PlanItem[];
  addOns: PlanItem[];
  /** A key that is absent is unlimited. */
  limits: Record<string, number>;
  limitAddOns: LimitAddOn[];
  discountPercent: number;
  /** Rupees per unit by meter; absent is free. */
  rates: Record<string, number>;
  offered: boolean;
}

/** The money fields are worked out by the server; the console never computes them. */
export interface Plan extends PlanInput {
  status: PlanStatus;
  revision: number;
  version: number;
  actualPrice: number;
  discountAmount: number;
  discountedPrice: number;
  customers: number;
}

export interface Price {
  actualPrice: number;
  discountAmount: number;
  discountedPrice: number;
}

/** The supplier fields are what an invoice prints; `complete` says an order can be raised. */
export interface BillingSettings {
  zone: string;
  graceDays: number;
  customersWithoutPlan: WithoutPlan;
  version: number | null;
  supplierLegalName: string | null;
  supplierAddress: string | null;
  supplierStateCode: string | null;
  supplierGstin: string | null;
  sacCode: string | null;
  gstRatePercent: number;
  invoicePrefix: string;
  creditNotePrefix: string;
  quoteValidDays: number;
  renewalWindowDays: number;
  /** How a customer pays a request; shown to it beside a request that waits. */
  paymentInstructions: string | null;
  complete: boolean;
}

/** What a settings save sends: a field left out keeps what is stored, an empty text clears it. */
export type BillingSettingsInput = Partial<Omit<BillingSettings, 'complete'>> &
  Pick<BillingSettings, 'zone' | 'graceDays' | 'customersWithoutPlan' | 'version'>;

export interface LimitKeyInfo {
  key: string;
  scope: 'CUSTOMER' | 'BRAND' | 'CHATBOT';
  label: string;
}

export interface SubscriptionAddOnInput {
  kind: 'GROUP' | 'LIMIT';
  groupCode?: string | null;
  limitKey?: string | null;
  quantity?: number | null;
}

export interface SubscriptionLimit {
  key: string;
  label: string;
  scope: string;
  /** Null when unlimited. */
  limit: number | null;
  /** Null for a limit that is not counted across the customer. */
  used: number | null;
}

/** The dates are instants at midnight in `zone`; `termEnd` is the first moment after the last day. */
export interface Subscription {
  state: SubscriptionState;
  readOnly: boolean;
  plan: { code: string; name: string; period: BillingPeriod; rank: number } | null;
  termStart: string | null;
  termEnd: string | null;
  graceEnd: string | null;
  zone: string;
  groups: { code: string; name: string; source: 'DEFAULT' | 'PLAN' | 'ADDON' }[];
  addOns: (SubscriptionAddOnInput & { id: string })[];
  limits: SubscriptionLimit[];
  revision: number;
  /** Money the platform owes the customer, tax included. */
  creditBalance: number;
  /** A renewal that is paid for and has not begun. */
  next: { planName: string | null; termStart: string; termEnd: string } | null;
  /** Cancelled: read-only from the term's end, with no grace, until a plan is bought again. */
  cancelled: boolean;
}

export type OrderKind = 'NEW' | 'RENEWAL' | 'UPGRADE' | 'CHANGE' | 'ADDON' | 'ADJUST' | 'CANCEL_ADDON' | 'CANCEL_PLAN';
export type OrderStatus =
  | 'REQUESTED'
  | 'ACTIVATING'
  | 'ACTIVATED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED';
export type PaymentMethod = 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH' | 'OTHER' | 'NONE';

/** GST on one document: CGST and SGST within a state, IGST between states. */
export interface Tax {
  ratePercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  interState: boolean;
}

export interface OrderLine {
  type: 'PLAN' | 'ADDON' | 'LIMIT_ADDON';
  description: string;
  groupCode: string | null;
  limitKey: string | null;
  quantity: number;
  /** The price before the plan's discount and any extra discount. */
  listAmount: number;
  amount: number;
}

/** Value an order gives back on one earlier invoice. */
export interface OrderCredit {
  creditNoteId: string;
  invoiceId: string;
  invoiceNumber: string;
  description: string;
  taxable: number;
  tax: Tax;
  total: number;
}

/** A priced request. Every figure is the server's; the console adds nothing up. */
export interface Quote {
  kind: OrderKind;
  lines: OrderLine[];
  extraDiscountPercent: number;
  taxable: number;
  tax: Tax;
  total: number;
  credits: OrderCredit[];
  creditFromNotes: number;
  accountCredit: number;
  accountCreditUsed: number;
  payable: number;
  planCode: string | null;
  planName: string | null;
  period: BillingPeriod | null;
  termStart: string | null;
  termEnd: string | null;
  validUntil: string | null;
}

export interface Payment {
  method: PaymentMethod;
  reference: string | null;
  receivedOn: string | null;
  note: string | null;
  /** Null in what a customer is sent. */
  recordedByName: string | null;
  recordedAt: string;
}

export interface Order extends Quote {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  /** Null in what a customer is sent. */
  raisedBy: string | null;
  raisedByName: string;
  raisedByStaff: boolean;
  raisedAt: string;
  reason: string | null;
  extraDiscountReason: string | null;
  payment: Payment | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  creditNoteIds: string[];
  rejectedReason: string | null;
  /** An adjustment's posting to the account credit (negative takes away); null otherwise. */
  creditPosting: number | null;
  /** The end an adjustment moved the last paid term to; null otherwise. */
  newTermEnd: string | null;
}

export interface QuoteRequest {
  kind: OrderKind;
  planCode?: string;
  /** NEW: an ISO local date in the billing zone. */
  startDate?: string;
  /** NEW and CHANGE: the add-ons wanted. */
  addOns?: SubscriptionAddOnInput[];
  /** RENEWAL: the held add-ons to keep; null keeps all. */
  keepAddOnIds?: string[] | null;
  /** ADDON: the one being bought. */
  addOn?: SubscriptionAddOnInput;
  extraDiscountPercent?: number;
  extraDiscountReason?: string;
}

export interface PayInput {
  method: PaymentMethod;
  reference?: string;
  receivedOn?: string;
  note?: string;
}

export interface Party {
  legalName: string;
  address: string | null;
  stateCode: string | null;
  stateName: string | null;
  gstin: string | null;
}

export interface DocumentLine {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  issuedAt: string;
  orderId: string;
  orderNumber: string;
  supplier: Party;
  customer: Party;
  sacCode: string | null;
  lines: DocumentLine[];
  taxable: number;
  tax: Tax;
  total: number;
  totalInWords: string;
  accountCreditUsed: number;
  amountPaid: number;
  payment: Payment | null;
  /** The taxable value credit notes have given back on this invoice. */
  credited: number;
  hasPdf: boolean;
}

export interface CreditNote {
  id: string;
  number: string;
  issuedAt: string;
  orderId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: Party;
  customer: Party;
  lines: DocumentLine[];
  taxable: number;
  tax: Tax;
  total: number;
  totalInWords: string;
  reason: string | null;
  hasPdf: boolean;
}

export interface Refund {
  id: string;
  number: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  paidOn: string;
  note: string | null;
  /** Null in what a customer is sent. */
  recordedByName: string | null;
  recordedAt: string;
  status: 'RECORDING' | 'RECORDED' | 'FAILED';
}

export interface RefundInput {
  amount: number;
  method: PaymentMethod;
  reference: string;
  paidOn: string;
  note?: string;
}

/** Who a customer is on its invoices. */
export interface BillingProfile {
  legalName: string | null;
  address: string | null;
  stateCode: string | null;
  gstin: string | null;
  complete: boolean;
}

export interface BillingProfileInput {
  legalName: string;
  address: string;
  stateCode: string;
  gstin: string;
}

export interface IndianState {
  code: string;
  name: string;
}

/** What a customer may ask for now. */
export interface BillingOptions {
  paymentInstructions: string | null;
  renewal: { allowed: boolean; reason: string | null; from: string | null };
  upgrades: { code: string; name: string; period: BillingPeriod; rank: number; discountedPrice: number }[];
  addOns: {
    kind: 'GROUP' | 'LIMIT';
    groupCode: string | null;
    name: string;
    limitKey: string | null;
    label: string | null;
    unit: number;
    unitPrice: number;
  }[];
}

/** One of the two. `termEnd` is the day after the term's last day, as an ISO local date. */
export interface AdjustInput {
  termEnd?: string;
  creditAmount?: number;
  reason: string;
}

/** `addOnId` null cancels the plan. `creditTaxable` replaces the unused part as the amount to credit. */
export interface CancelInput {
  addOnId: string | null;
  creditTaxable?: number;
  reason?: string;
}

export interface OrderPage {
  items: Order[];
  total: number;
  page: number;
}

export interface BillingEvent {
  id: string;
  kind: string;
  by: string;
  byName: string;
  at: string;
  summary: string;
}

/** What `/api/users/me` says about the user's customer's plan. */
export interface SubscriptionSummary {
  state: SubscriptionState;
  planName: string | null;
  termEnd: string | null;
  graceEnd: string | null;
  readOnly: boolean;
  zone: string;
}

const GROUPS = '/api/billing/feature-groups';
const PLANS = '/api/billing/plans';
const enc = encodeURIComponent;
const customerOf = (customerId: string) => `/api/billing/customers/${enc(customerId)}`;
const subscriptionOf = (customerId: string) => `${customerOf(customerId)}/subscription`;
const MY = '/api/my/billing';

export const listGroups = (token: string) => apiFetch<FeatureGroup[]>(GROUPS, { token });

export const createGroup = (token: string, body: FeatureGroupInput & { code: string }) =>
  apiFetch<FeatureGroup>(GROUPS, { method: 'POST', token, body });

export const updateGroup = (token: string, code: string, body: FeatureGroupInput & { version: number }) =>
  apiFetch<FeatureGroup>(`${GROUPS}/${enc(code)}`, { method: 'PUT', token, body });

export const deleteGroup = (token: string, code: string) =>
  apiFetch<void>(`${GROUPS}/${enc(code)}`, { method: 'DELETE', token });

export const listUngrouped = (token: string) => apiFetch<Ungrouped[]>(`${GROUPS}/ungrouped`, { token });

export const groupHistory = (token: string, code: string) =>
  apiFetch<BillingEvent[]>(`${GROUPS}/${enc(code)}/history`, { token });

export const listPlans = (token: string, status?: PlanStatus) =>
  apiFetch<Plan[]>(status ? `${PLANS}?status=${status}` : PLANS, { token });

export const getPlan = (token: string, code: string) => apiFetch<Plan>(`${PLANS}/${enc(code)}`, { token });

export const createPlan = (token: string, body: PlanInput) => apiFetch<Plan>(PLANS, { method: 'POST', token, body });

export const updatePlan = (token: string, code: string, body: PlanInput & { version: number }) =>
  apiFetch<Plan>(`${PLANS}/${enc(code)}`, { method: 'PUT', token, body });

/** What a plan with these groups and this discount costs; the only place a plan's price comes from. */
export const pricePlan = (token: string, body: { items: PlanItem[]; discountPercent: number }) =>
  apiFetch<Price>(`${PLANS}/price`, { method: 'POST', token, body });

export const duplicatePlan = (
  token: string,
  code: string,
  body: { code: string; name: string; period: BillingPeriod },
) => apiFetch<Plan>(`${PLANS}/${enc(code)}/duplicate`, { method: 'POST', token, body });

export const activatePlan = (token: string, code: string) =>
  apiFetch<Plan>(`${PLANS}/${enc(code)}/activate`, { method: 'POST', token });

export const retirePlan = (token: string, code: string) =>
  apiFetch<Plan>(`${PLANS}/${enc(code)}/retire`, { method: 'POST', token });

export const deletePlan = (token: string, code: string) =>
  apiFetch<void>(`${PLANS}/${enc(code)}`, { method: 'DELETE', token });

export const planHistory = (token: string, code: string) =>
  apiFetch<BillingEvent[]>(`${PLANS}/${enc(code)}/history`, { token });

export const listLimitKeys = (token: string) => apiFetch<LimitKeyInfo[]>('/api/billing/limit-keys', { token });

export const getBillingSettings = (token: string) => apiFetch<BillingSettings>('/api/billing/settings', { token });

export const putBillingSettings = (token: string, body: BillingSettingsInput) =>
  apiFetch<BillingSettings>('/api/billing/settings', { method: 'PUT', token, body });

export const getCustomerSubscription = (token: string, customerId: string) =>
  apiFetch<Subscription>(subscriptionOf(customerId), { token });

export const customerSubscriptionEvents = (token: string, customerId: string) =>
  apiFetch<BillingEvent[]>(`${subscriptionOf(customerId)}/events`, { token });

/** The signed-in user's own customer's plan. */
export const getMySubscription = (token: string) => apiFetch<Subscription>(`${MY}/subscription`, { token });

// --- phase 2: orders and money, for platform staff -------------------------------------------------------------------

export const listStates = (token: string) => apiFetch<IndianState[]>('/api/billing/states', { token });

export const getBillingProfile = (token: string, customerId: string) =>
  apiFetch<BillingProfile>(`${customerOf(customerId)}/billing-profile`, { token });

export const putBillingProfile = (token: string, customerId: string, body: BillingProfileInput) =>
  apiFetch<BillingProfile>(`${customerOf(customerId)}/billing-profile`, { method: 'PUT', token, body });

/** What the request would cost now. Nothing is stored. */
/** What the customer may be sold now, on the terms its term was sold under. */
export const getCustomerOptions = (token: string, customerId: string) =>
  apiFetch<BillingOptions>(`${customerOf(customerId)}/options`, { token });

export const quoteFor = (token: string, customerId: string, body: QuoteRequest) =>
  apiFetch<Quote>(`${customerOf(customerId)}/quotes`, { method: 'POST', token, body });

export const raiseOrder = (token: string, customerId: string, body: QuoteRequest) =>
  apiFetch<Order>(`${customerOf(customerId)}/orders`, { method: 'POST', token, body });

export const listCustomerOrders = (token: string, customerId: string) =>
  apiFetch<Order[]>(`${customerOf(customerId)}/orders`, { token });

/** Every customer's orders; open ones come oldest first. */
export const listOrders = (token: string, { status, page }: { status?: OrderStatus; page: number }) =>
  apiFetch<OrderPage>(`/api/billing/orders?${status ? `status=${status}&` : ''}page=${page}`, { token });

export const getOrder = (token: string, id: string) => apiFetch<Order>(`/api/billing/orders/${enc(id)}`, { token });

/** Records that the order was paid, which puts it into effect. */
export const payOrder = (token: string, id: string, body: PayInput) =>
  apiFetch<Order>(`/api/billing/orders/${enc(id)}/pay`, { method: 'POST', token, body });

export const rejectOrder = (token: string, id: string, reason: string) =>
  apiFetch<Order>(`/api/billing/orders/${enc(id)}/reject`, { method: 'POST', token, body: { reason } });

export const cancelOrder = (token: string, id: string) =>
  apiFetch<Order>(`/api/billing/orders/${enc(id)}/cancel`, { method: 'POST', token });

export const adjust = (token: string, customerId: string, body: AdjustInput) =>
  apiFetch<Order>(`${customerOf(customerId)}/adjustments`, { method: 'POST', token, body });

/** The credit a cancellation would give. Nothing is stored. */
export const quoteCancellation = (token: string, customerId: string, body: CancelInput) =>
  apiFetch<Quote>(`${customerOf(customerId)}/cancellations/quote`, { method: 'POST', token, body });

export const cancelSubscriptionPart = (token: string, customerId: string, body: CancelInput) =>
  apiFetch<Order>(`${customerOf(customerId)}/cancellations`, { method: 'POST', token, body });

export const listCustomerInvoices = (token: string, customerId: string) =>
  apiFetch<Invoice[]>(`${customerOf(customerId)}/invoices`, { token });

export const getInvoice = (token: string, id: string) =>
  apiFetch<Invoice>(`/api/billing/invoices/${enc(id)}`, { token });

export const listCustomerCreditNotes = (token: string, customerId: string) =>
  apiFetch<CreditNote[]>(`${customerOf(customerId)}/credit-notes`, { token });

export const getCreditNote = (token: string, id: string) =>
  apiFetch<CreditNote>(`/api/billing/credit-notes/${enc(id)}`, { token });

export const listCustomerRefunds = (token: string, customerId: string) =>
  apiFetch<Refund[]>(`${customerOf(customerId)}/refunds`, { token });

export const recordRefund = (token: string, customerId: string, body: RefundInput) =>
  apiFetch<Refund>(`${customerOf(customerId)}/refunds`, { method: 'POST', token, body });

/** Where a document's PDF is served; fetch it with `apiFetchBlob`, since it needs the auth header. */
export const invoicePdfPath = (id: string, mine: boolean) => `${mine ? MY : '/api/billing'}/invoices/${enc(id)}/pdf`;

export const creditNotePdfPath = (id: string, mine: boolean) =>
  `${mine ? MY : '/api/billing'}/credit-notes/${enc(id)}/pdf`;

/** The name a document's PDF is saved under: its number with the slashes as dashes. */
export const pdfFileName = (number: string) => `${number.replace(/\//g, '-')}.pdf`;

// --- phase 2: the signed-in customer's own billing ---------------------------------------------------------------

export const getMyOptions = (token: string) => apiFetch<BillingOptions>(`${MY}/options`, { token });

export const myQuote = (token: string, body: QuoteRequest) =>
  apiFetch<Quote>(`${MY}/quotes`, { method: 'POST', token, body });

export const raiseMyOrder = (token: string, body: QuoteRequest) =>
  apiFetch<Order>(`${MY}/orders`, { method: 'POST', token, body });

export const listMyOrders = (token: string) => apiFetch<Order[]>(`${MY}/orders`, { token });

export const cancelMyOrder = (token: string, id: string) =>
  apiFetch<Order>(`${MY}/orders/${enc(id)}/cancel`, { method: 'POST', token });

export const listMyInvoices = (token: string) => apiFetch<Invoice[]>(`${MY}/invoices`, { token });

export const getMyInvoice = (token: string, id: string) => apiFetch<Invoice>(`${MY}/invoices/${enc(id)}`, { token });

export const listMyCreditNotes = (token: string) => apiFetch<CreditNote[]>(`${MY}/credit-notes`, { token });

export const getMyCreditNote = (token: string, id: string) =>
  apiFetch<CreditNote>(`${MY}/credit-notes/${enc(id)}`, { token });

export const listMyRefunds = (token: string) => apiFetch<Refund[]>(`${MY}/refunds`, { token });

export const getMyProfile = (token: string) => apiFetch<BillingProfile>(`${MY}/profile`, { token });

export const putMyProfile = (token: string, body: BillingProfileInput) =>
  apiFetch<BillingProfile>(`${MY}/profile`, { method: 'PUT', token, body });

export const listMyStates = (token: string) => apiFetch<IndianState[]>(`${MY}/states`, { token });
