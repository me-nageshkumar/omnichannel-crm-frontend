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

export interface BillingSettings {
  zone: string;
  graceDays: number;
  customersWithoutPlan: WithoutPlan;
  version: number | null;
}

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
}

export interface AssignInput {
  planCode: string;
  /** ISO local dates in the billing zone. */
  startDate: string;
  endDate: string;
  addOns: SubscriptionAddOnInput[];
  /** The subscription's revision this change was made from; null when the customer has none. */
  revision: number | null;
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
const subscriptionOf = (customerId: string) => `/api/billing/customers/${enc(customerId)}/subscription`;

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

export const putBillingSettings = (token: string, body: BillingSettings) =>
  apiFetch<BillingSettings>('/api/billing/settings', { method: 'PUT', token, body });

export const getCustomerSubscription = (token: string, customerId: string) =>
  apiFetch<Subscription>(subscriptionOf(customerId), { token });

export const putCustomerSubscription = (token: string, customerId: string, body: AssignInput) =>
  apiFetch<Subscription>(subscriptionOf(customerId), { method: 'PUT', token, body });

export const deleteCustomerSubscription = (token: string, customerId: string) =>
  apiFetch<void>(subscriptionOf(customerId), { method: 'DELETE', token });

export const customerSubscriptionEvents = (token: string, customerId: string) =>
  apiFetch<BillingEvent[]>(`${subscriptionOf(customerId)}/events`, { token });

/** The signed-in user's own customer's plan. */
export const getMySubscription = (token: string) => apiFetch<Subscription>('/api/my/billing/subscription', { token });
