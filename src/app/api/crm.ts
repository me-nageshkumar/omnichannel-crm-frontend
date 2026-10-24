import { apiFetch } from '@app/api/client';
import type { FieldOptionDef, FieldType } from '@app/Crm/common/fields/types';

export type { FieldType } from '@app/Crm/common/fields/types';

export type StageType = 'OPEN' | 'WON' | 'LOST';
export type DealStatus = 'OPEN' | 'WON' | 'LOST';
export type OriginKind = 'INBOUND_CHAT' | 'CTWA_AD' | 'FACEBOOK_LEAD' | 'WEBSITE_LEAD' | 'MANUAL' | 'IMPORT' | 'API';
export type TargetType = 'CONTACT' | 'COMPANY' | 'DEAL' | 'PIPELINE' | 'SETTINGS';
export type ManualActivityType = 'CALL' | 'MEETING' | 'EMAIL';

export interface Ref {
  id: string;
  name: string;
}

export interface CrmPhone {
  phoneNumberId: string;
  number: string;
  label: string | null;
  canChat: boolean;
}

export interface CrmStatus {
  enabled: boolean;
  limits: { maxPipelines: number | null; maxCustomFields: number | null };
  phones: CrmPhone[];
  /** "ALL" or the ids of the pipelines the caller may use. */
  pipelineAccess: 'ALL' | string[];
  authorities: string[];
  attachmentsEnabled: boolean;
}

/** The platform switch of a brand's CRM. */
export interface Enablement {
  enabled: boolean;
  maxPipelines: number | null;
  maxCustomFields: number | null;
}

export interface PicklistItem {
  key: string;
  label: string;
  color: string | null;
  position: number;
  active: boolean;
  isDefault: boolean;
}
export type Picklist = PicklistItem[];

export interface CrmSettings {
  defaultCurrency: string;
  defaultPipelineId: string | null;
  dealRottingDays: number | null;
  allowChannelMove: boolean;
  timelineShowsWhatsappMessages: boolean;
  lifecycleStatuses: Picklist;
  dealSources: Picklist;
  taskTypes: Picklist;
  lostReasons: Picklist;
  industries: Picklist;
  version: number;
}

export type FieldEntityType = 'CONTACT' | 'COMPANY' | 'DEAL';
export type FieldOption = FieldOptionDef;

export interface FieldDefinition {
  id: string;
  entityType: FieldEntityType;
  key: string;
  label: string;
  type: FieldType;
  options: FieldOption[];
  required: boolean;
  defaultValue: unknown;
  position: number;
  showInList: boolean;
  showInCard: boolean;
  active: boolean;
  version: number;
}

/** Create or update a definition; entityType, key and type are fixed once created. */
export interface FieldDefinitionInput {
  entityType: FieldEntityType;
  key: string;
  label: string;
  type: FieldType;
  /** In display order; a saved option is switched off (active false), never dropped. */
  options?: { key: string; label: string; color?: string | null; active?: boolean }[];
  required?: boolean;
  /** null keeps the stored default on update; "" clears it. */
  defaultValue?: unknown;
  showInList?: boolean;
  showInCard?: boolean;
  active?: boolean;
  /** Required on update. */
  version?: number;
}

export interface Stage {
  id: string;
  name: string;
  color: string | null;
  position: number;
  probability: number;
  type: StageType;
  wipLimit: number | null;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
  rottingDays: number | null;
  stages: Stage[];
  version: number;
}

/** A lane as sent: no id for a new lane; {@code moveToStageId} drops the lane and moves its deals there. */
export interface StageInput {
  id?: string;
  name: string;
  color?: string | null;
  probability: number;
  type: StageType;
  wipLimit?: number | null;
  moveToStageId?: string;
}

export interface PipelineInput {
  name: string;
  active?: boolean;
  isDefault?: boolean;
  /** On update absent or null keeps the stored value and 0 clears it. */
  rottingDays?: number | null;
  /** Create only. */
  stages?: StageInput[];
  /** Update only. */
  version?: number;
}

export interface UserPipelines {
  userId: string;
  pipelineIds: string[];
}

export interface Channel {
  phoneNumberId: string;
  number: string;
}

export interface CrmContact {
  id: string;
  contactId: string;
  channel: Channel | null;
  phone: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  jobTitle: string | null;
  company: Ref | null;
  owner: Ref | null;
  lifecycleStatus: string | null;
  source: string | null;
  origin: {
    kind: OriginKind;
    phoneNumberId: string | null;
    chatId: string | null;
    firstMessageAt: string | null;
    capturedBy: Ref | null;
  } | null;
  customFields: Record<string, unknown>;
  openDealCount: number;
  openDealAmount: number;
  lastActivityAt: string | null;
  nextTaskDueAt: string | null;
  contactDeleted: boolean;
  channelHistory: { from: string | null; to: string | null; by: Ref | null; at: string; reason: string | null }[];
  creationTime: string;
  version: number;
}

export interface ContactUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  companyId?: string;
  ownerId?: string;
  lifecycleStatus?: string;
  source?: string;
  /** Only the keys to change; null clears one. */
  customFields?: Record<string, unknown>;
  version: number;
}

export interface Address {
  line1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  annualRevenue: number | null;
  phone: string | null;
  email: string | null;
  address: Address | null;
  description: string | null;
  owner: Ref | null;
  teamId: string | null;
  labelIds: string[];
  customFields: Record<string, unknown>;
  contactCount: number;
  openDealAmount: number;
  lastActivityAt: string | null;
  creationTime: string;
  version: number;
}

export interface CompanyInput {
  name?: string;
  domain?: string;
  website?: string;
  industry?: string;
  size?: string;
  annualRevenue?: number | null;
  phone?: string;
  email?: string;
  address?: Partial<Address>;
  description?: string;
  ownerId?: string;
  teamId?: string;
  labelIds?: string[];
  customFields?: Record<string, unknown>;
  /** Required on update. */
  version?: number;
}

export interface CompanySummary {
  company: Company;
  contacts: CrmContact[];
  openDeals: Deal[];
  contactCount: number;
  openDealAmount: number;
}

export interface Deal {
  id: string;
  title: string;
  pipelineId: string;
  stageId: string;
  position: number;
  status: DealStatus;
  amount: number | null;
  currency: string | null;
  probability: number | null;
  probabilityOverridden: boolean;
  /** yyyy-MM-dd */
  expectedCloseDate: string | null;
  closedAt: string | null;
  lostReason: string | null;
  company: Ref | null;
  primaryContact: { id: string; name: string | null; phone: string | null } | null;
  crmContactIds: string[];
  owner: Ref | null;
  source: string | null;
  labelIds: string[];
  customFields: Record<string, unknown>;
  channel: Channel | null;
  stageEnteredAt: string | null;
  rotting: boolean;
  overdue: boolean;
  lastActivityAt: string | null;
  nextTaskDueAt: string | null;
  creationTime: string;
  version: number;
}

export interface DealInput {
  title?: string;
  pipelineId?: string;
  /** Create only; moves go through {@link moveDeal}. */
  stageId?: string;
  amount?: number | null;
  currency?: string;
  probability?: number | null;
  probabilityOverridden?: boolean;
  expectedCloseDate?: string;
  companyId?: string;
  primaryCrmContactId?: string;
  crmContactIds?: string[];
  ownerId?: string;
  teamId?: string;
  source?: string;
  labelIds?: string[];
  customFields?: Record<string, unknown>;
  /** Required on update. */
  version?: number;
}

export interface Lane {
  stage: Omit<Stage, 'position'> & { position?: number };
  total: number;
  sumAmount: number;
  deals: Deal[];
}

export interface Board {
  pipelineId: string;
  lanes: Lane[];
}

export interface Activity {
  id: string;
  /** May be LEGACY_NOTE. */
  type: string;
  target: { type: TargetType; id: string };
  summary: string | null;
  payload: Record<string, unknown> | null;
  actor: Ref | null;
  actorType: string;
  happenedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
}

export interface CaptureResult {
  contact: CrmContact;
  deal: Deal | null;
  createdContact: boolean;
  createdDeal: boolean;
}

export interface Communication {
  phoneNumberId: string;
  number: string;
  phone: string;
  chatId: string | null;
  canChat: boolean;
}

export interface InboxSummary {
  chatId: string;
  canCapture: boolean;
  captureBlockedReason: string | null;
  contact: CrmContact | null;
  openDeals: Deal[];
  nextTask: Task | null;
}

export type TaskStatus = 'OPEN' | 'DONE';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type TaskBucket = 'overdue' | 'today' | 'upcoming';
export type TaskTargetType = 'CONTACT' | 'COMPANY' | 'DEAL';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  /** A taskTypes key, or null. */
  type: string | null;
  priority: TaskPriority;
  dueAt: string | null;
  reminderAt: string | null;
  status: TaskStatus;
  completedAt: string | null;
  completedBy: Ref | null;
  assignee: Ref | null;
  target: { type: TaskTargetType; id: string; name: string | null };
  overdue: boolean;
  version: number;
}

/** A new task (target required) or the whole editable state of one: on update null clears, except assigneeId. */
export interface TaskInput {
  title: string;
  description?: string | null;
  type?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  reminderAt?: string | null;
  assigneeId?: string | null;
  target?: { type: TaskTargetType; id: string };
  version?: number;
}

export interface TaskCounts {
  overdue: number;
  today: number;
  upcoming: number;
}

export interface ContactSearch {
  q?: string;
  ownerId?: string;
  lifecycleStatus?: string;
  companyId?: string;
  pipelineId?: string;
  /** "field" or "field,asc|desc"; fields lastActivityAt, creationTime, firstName. */
  sort?: string;
  page: number;
  size: number;
}

export interface CompanySearch {
  q?: string;
  ownerId?: string;
  industry?: string;
  /** Fields name, creationTime, lastActivityAt. */
  sort?: string;
  page: number;
  size: number;
}

export interface DealSearch {
  pipelineId?: string;
  stageId?: string;
  status?: DealStatus;
  ownerId?: string;
  companyId?: string;
  crmContactId?: string;
  q?: string;
  /** Fields creationTime, lastActivityAt, amount, expectedCloseDate, title, position, closedAt, stageEnteredAt. */
  sort?: string;
  page: number;
  size: number;
}

export interface BoardQuery {
  pipelineId: string;
  perStageLimit?: number;
  ownerId?: string;
  q?: string;
}

const enc = encodeURIComponent;
const base = (ws: string) => `/api/workspaces/${enc(ws)}/crm`;

function query(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const get = <T>(token: string, path: string) => apiFetch<T>(path, { token });
const send = <T>(token: string, method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
  apiFetch<T>(path, { token, method, body });

export const getStatus = (token: string, ws: string) => get<CrmStatus>(token, `${base(ws)}/status`);

export const getSettings = (token: string, ws: string) => get<CrmSettings>(token, `${base(ws)}/settings`);
export const putSettings = (token: string, ws: string, body: CrmSettings) =>
  send<CrmSettings>(token, 'PUT', `${base(ws)}/settings`, body);

export const listFields = (token: string, ws: string, entityType: FieldEntityType, includeInactive = false) =>
  get<FieldDefinition[]>(
    token,
    `${base(ws)}/fields${query({ entityType, includeInactive: includeInactive ? 'true' : undefined })}`,
  );
export const createField = (token: string, ws: string, body: FieldDefinitionInput) =>
  send<FieldDefinition>(token, 'POST', `${base(ws)}/fields`, body);
export const updateField = (token: string, ws: string, id: string, body: FieldDefinitionInput) =>
  send<FieldDefinition>(token, 'PUT', `${base(ws)}/fields/${enc(id)}`, body);
/** Switches the field off (a soft delete: stored values stay). */
export const deleteField = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/fields/${enc(id)}`);
export const reorderFields = (token: string, ws: string, entityType: FieldEntityType, ids: string[]) =>
  send<void>(token, 'PUT', `${base(ws)}/fields/reorder`, { entityType, ids });

export const listPipelines = (token: string, ws: string) => get<Pipeline[]>(token, `${base(ws)}/pipelines`);
export const getPipeline = (token: string, ws: string, id: string) =>
  get<Pipeline>(token, `${base(ws)}/pipelines/${enc(id)}`);
export const createPipeline = (token: string, ws: string, body: PipelineInput) =>
  send<Pipeline>(token, 'POST', `${base(ws)}/pipelines`, body);
export const updatePipeline = (token: string, ws: string, id: string, body: PipelineInput) =>
  send<Pipeline>(token, 'PUT', `${base(ws)}/pipelines/${enc(id)}`, body);
export const putStages = (token: string, ws: string, id: string, body: { version: number; stages: StageInput[] }) =>
  send<Pipeline>(token, 'PUT', `${base(ws)}/pipelines/${enc(id)}/stages`, body);
export const deletePipeline = (token: string, ws: string, id: string, moveDealsToPipelineId?: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/pipelines/${enc(id)}${query({ moveDealsToPipelineId })}`);

export const getUserPipelines = (token: string, ws: string, userId: string) =>
  get<UserPipelines>(token, `${base(ws)}/users/${enc(userId)}/pipelines`);
export const putUserPipelines = (token: string, ws: string, userId: string, pipelineIds: string[]) =>
  send<UserPipelines>(token, 'PUT', `${base(ws)}/users/${enc(userId)}/pipelines`, { pipelineIds });

export const searchContacts = (token: string, ws: string, body: ContactSearch) =>
  send<Page<CrmContact>>(token, 'POST', `${base(ws)}/contacts/search`, body);
export const getContact = (token: string, ws: string, id: string) =>
  get<CrmContact>(token, `${base(ws)}/contacts/${enc(id)}`);
export const updateContact = (token: string, ws: string, id: string, body: ContactUpdate) =>
  send<CrmContact>(token, 'PUT', `${base(ws)}/contacts/${enc(id)}`, body);
export const captureChat = (
  token: string,
  ws: string,
  body: { chatId: string; pipelineId?: string; dealTitle?: string },
) => send<CaptureResult>(token, 'POST', `${base(ws)}/contacts/capture`, body);
export const createContact = (
  token: string,
  ws: string,
  body: {
    phone: string;
    phoneNumberId: string;
    firstName?: string;
    lastName?: string;
    pipelineId: string;
    dealTitle?: string;
  },
) => send<CaptureResult>(token, 'POST', `${base(ws)}/contacts/create`, body);
export const getCommunication = (token: string, ws: string, id: string, phoneNumberId?: string) =>
  get<Communication>(token, `${base(ws)}/contacts/${enc(id)}/communication${query({ phoneNumberId })}`);
export const moveChannel = (
  token: string,
  ws: string,
  id: string,
  body: { toPhoneNumberId: string; reason?: string; version: number },
) => send<CrmContact>(token, 'POST', `${base(ws)}/contacts/${enc(id)}/move-channel`, body);
export const inboxSummary = (token: string, ws: string, chatId: string) =>
  get<InboxSummary>(token, `${base(ws)}/contacts/by-chat/${enc(chatId)}/summary`);

export const searchCompanies = (token: string, ws: string, body: CompanySearch) =>
  send<Page<Company>>(token, 'POST', `${base(ws)}/companies/search`, body);
export const companyTypeahead = (token: string, ws: string, q: string) =>
  get<Ref[]>(token, `${base(ws)}/companies/typeahead${query({ q })}`);
export const getCompany = (token: string, ws: string, id: string) =>
  get<Company>(token, `${base(ws)}/companies/${enc(id)}`);
export const companySummary = (token: string, ws: string, id: string) =>
  get<CompanySummary>(token, `${base(ws)}/companies/${enc(id)}/summary`);
export const createCompany = (token: string, ws: string, body: CompanyInput) =>
  send<Company>(token, 'POST', `${base(ws)}/companies`, body);
export const updateCompany = (token: string, ws: string, id: string, body: CompanyInput) =>
  send<Company>(token, 'PUT', `${base(ws)}/companies/${enc(id)}`, body);
export const deleteCompany = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/companies/${enc(id)}`);

export const getBoard = (token: string, ws: string, q: BoardQuery) =>
  get<Board>(token, `${base(ws)}/deals/board${query({ ...q })}`);
export const searchDeals = (token: string, ws: string, body: DealSearch) =>
  send<Page<Deal>>(token, 'POST', `${base(ws)}/deals/search`, body);
export const getDeal = (token: string, ws: string, id: string) => get<Deal>(token, `${base(ws)}/deals/${enc(id)}`);
export const createDeal = (token: string, ws: string, body: DealInput) =>
  send<Deal>(token, 'POST', `${base(ws)}/deals`, body);
export const updateDeal = (token: string, ws: string, id: string, body: DealInput) =>
  send<Deal>(token, 'PUT', `${base(ws)}/deals/${enc(id)}`, body);
/** {@code beforeDealId} ends up directly above the moved card, {@code afterDealId} directly below it. */
export const moveDeal = (
  token: string,
  ws: string,
  id: string,
  body: { stageId: string; beforeDealId?: string; afterDealId?: string },
) => send<Deal>(token, 'POST', `${base(ws)}/deals/${enc(id)}/move`, body);
export const closeDeal = (
  token: string,
  ws: string,
  id: string,
  body: { outcome: 'WON' | 'LOST'; lostReason?: string },
) => send<Deal>(token, 'POST', `${base(ws)}/deals/${enc(id)}/close`, body);
export const deleteDeal = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/deals/${enc(id)}`);

export const listActivities = (
  token: string,
  ws: string,
  q: { targetType: TargetType; targetId: string; page?: number; size?: number },
) => get<Page<Activity>>(token, `${base(ws)}/activities${query({ ...q })}`);
export const logActivity = (
  token: string,
  ws: string,
  body: { target: { type: TargetType; id: string }; type: ManualActivityType; summary: string; happenedAt?: string },
) => send<Activity>(token, 'POST', `${base(ws)}/activities/log`, body);

export const listTasks = (
  token: string,
  ws: string,
  q: { targetType: TaskTargetType; targetId: string; status?: TaskStatus; page?: number; size?: number },
) => get<Page<Task>>(token, `${base(ws)}/tasks${query({ ...q })}`);
export const createTask = (token: string, ws: string, body: TaskInput) =>
  send<Task>(token, 'POST', `${base(ws)}/tasks`, body);
export const updateTask = (token: string, ws: string, id: string, body: TaskInput) =>
  send<Task>(token, 'PUT', `${base(ws)}/tasks/${enc(id)}`, body);
export const completeTask = (token: string, ws: string, id: string) =>
  send<Task>(token, 'POST', `${base(ws)}/tasks/${enc(id)}/complete`);
export const reopenTask = (token: string, ws: string, id: string) =>
  send<Task>(token, 'POST', `${base(ws)}/tasks/${enc(id)}/reopen`);
export const deleteTask = (token: string, ws: string, id: string) =>
  send<void>(token, 'DELETE', `${base(ws)}/tasks/${enc(id)}`);
/** {@code tz} is an IANA zone (the browser's); it decides where "today" starts and ends. */
export const myTasks = (
  token: string,
  ws: string,
  q: { bucket: TaskBucket; tz: string; assigneeId?: string; limit?: number },
) => get<Task[]>(token, `${base(ws)}/tasks/mine${query({ ...q })}`);
export const myTaskCounts = (token: string, ws: string, q: { tz: string; assigneeId?: string }) =>
  get<TaskCounts>(token, `${base(ws)}/tasks/mine/counts${query({ ...q })}`);

const switchPath = (customerId: string, ws: string) => `/api/customers/${enc(customerId)}/workspaces/${enc(ws)}/crm`;
export const getCrmSwitch = (token: string, customerId: string, ws: string) =>
  get<Enablement>(token, switchPath(customerId, ws));
export const putCrmSwitch = (token: string, customerId: string, ws: string, body: Enablement) =>
  send<Enablement>(token, 'PUT', switchPath(customerId, ws), body);
