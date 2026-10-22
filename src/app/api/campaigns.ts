import { apiFetch, apiFetchBlob, apiFetchFile } from '@app/api/client';
import type { ContactFilterSpec } from '@app/api/contacts';
import type { PhoneNumberStatus } from '@app/api/phoneNumbers';

export type CampaignStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'TERMINATED';
export type AudienceKind = 'FILTER' | 'CSV';
export type SourceKind = 'CONTACT_FIELD' | 'CONTACT_ATTRIBUTE' | 'CSV_COLUMN' | 'FIXED';

export type PlaceholderSource =
  | { kind: 'CONTACT_FIELD'; field: 'name' | 'phone' }
  | { kind: 'CONTACT_ATTRIBUTE'; attributeId: string }
  | { kind: 'CSV_COLUMN'; column: string }
  | { kind: 'FIXED'; text: string };

/** Where one template placeholder gets its value; {@code fallback} is "" for none. */
export interface CampaignPlaceholder {
  name: string;
  source: PlaceholderSource;
  fallback: string;
}

export interface CampaignCounts {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  skipped: number;
  failed: number;
}

export interface CampaignAudience {
  kind: AudienceKind;
  filterId: string | null;
  filterName: string | null;
  csvFileName: string | null;
  csvHeaders: string[] | null;
  csvRows: number | null;
  phoneColumn: string | null;
  nameColumn: string | null;
  /** The saved filter's criteria (extra; the console may ignore it). */
  filterSpec: ContactFilterSpec | null;
}

export type SenderState = 'WARMING' | 'ACTIVE' | 'RESTING' | 'SUSPENDED' | 'RETIRED';
export type SenderAction = 'REST' | 'RETIRE' | 'REACTIVATE' | 'RESUME';

export interface SenderView {
  phoneNumberId: string;
  number: string;
  label: string | null;
  phoneStatus: PhoneNumberStatus;
  state: SenderState;
  ageDay: number;
  /** Already halved when {@code lowReplyRate}. */
  capToday: number;
  usedToday: number;
  hourlyUsed: number;
  restUntil: string | null;
  pausedUntil: string | null;
  pauseReason: 'UNDELIVERED_RUN' | 'LOOKUP_FAILED' | null;
  lowReplyRate: boolean;
  halfPaceUntil: string | null;
  runsOn: string | null;
  ready: boolean;
  logoutAt: string | null;
  lastSendAt: string | null;
  nextSendAt: string | null;
  warmupStartedAt: string | null;
}

export interface CampaignEstimate {
  remaining: number;
  perDay: number;
  days: number | null;
  /** "YYYY-MM-DD". */
  finishBy: string | null;
}

export interface CampaignView {
  id: string;
  name: string;
  status: CampaignStatus;
  pausedBy: 'USER' | 'SYSTEM' | null;
  pauseReason: 'TWO_LOGOUTS' | 'SEND_REFUSED' | null;
  audience: CampaignAudience;
  templateIds: string[];
  templateNames: string[];
  placeholders: CampaignPlaceholder[];
  senderIds: string[];
  counts: CampaignCounts;
  creationTime: string;
  startedAt: string | null;
  finishedAt: string | null;
  version: number;
  createdBy: string;
  lastUpdateTime: string;
  /** Null in list items; set on every single-campaign reply. */
  estimate: CampaignEstimate | null;
  senders: SenderView[] | null;
}

/** A single campaign: the estimate and the senders are always present. */
export interface CampaignDetail extends CampaignView {
  estimate: CampaignEstimate;
  senders: SenderView[];
}

export interface CampaignPage {
  items: CampaignView[];
  total: number;
  page: number;
  /** Any campaign of the workspace (not only this page) is paused by the system. */
  systemPaused: boolean;
}

export type RecipientStatus = 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED';
export type SkipReason =
  | 'NOT_ON_WHATSAPP'
  | 'DO_NOT_CONTACT'
  | 'RECENTLY_MESSAGED'
  | 'NO_PHONE'
  | 'INVALID_PHONE'
  | 'DUPLICATE'
  | 'CHAT_ON_OTHER_NUMBER'
  | 'CANCELLED';

export interface RecipientView {
  id: string;
  phone: string;
  contactId: string | null;
  contactName: string | null;
  status: RecipientStatus;
  skipReason: SkipReason | null;
  senderId: string | null;
  senderNumber: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  error: string | null;
  templateId: string | null;
  attemptedAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  attempts: number;
  dispatchedAt: string | null;
}

export interface RecipientPage {
  items: RecipientView[];
  total: number;
  page: number;
}

export interface CampaignRequest {
  name: string;
  audience: { kind: 'FILTER'; filterId: string } | { kind: 'CSV'; phoneColumn: string; nameColumn: string | null };
  templateIds: string[];
  placeholders: CampaignPlaceholder[];
  senderIds: string[];
}

export interface CsvPreview {
  headers: string[];
  sample: string[][];
  rows: number;
  suggested: { phone: string | null };
}

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface CampaignSettings {
  timezone: string;
  defaultCountryCode: string;
  workingDays: DayOfWeek[];
  /** "HH:mm". */
  startTime: string;
  endTime: string;
  gapMinSeconds: number;
  gapMaxSeconds: number;
  skipGapMinSeconds: number;
  skipGapMaxSeconds: number;
  hourlyCap: number;
  warmupCaps: { fromDay: number; cap: number }[];
  matureCap: number;
  healthyCap: number;
  restDays: number;
  recontactDays: number;
  stopWords: string[];
  version: number;
}

export type CampaignAction = 'start' | 'pause' | 'resume' | 'terminate';

/** The recommended values, against which the settings form warns when a value is looser. */
export const RECOMMENDED_SETTINGS: Omit<CampaignSettings, 'version'> = {
  timezone: 'Asia/Kolkata',
  defaultCountryCode: '91',
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
  startTime: '10:00',
  endTime: '18:00',
  gapMinSeconds: 45,
  gapMaxSeconds: 180,
  skipGapMinSeconds: 15,
  skipGapMaxSeconds: 45,
  hourlyCap: 12,
  warmupCaps: [
    { fromDay: 1, cap: 5 },
    { fromDay: 4, cap: 10 },
    { fromDay: 8, cap: 20 },
    { fromDay: 15, cap: 35 },
    { fromDay: 22, cap: 50 },
  ],
  matureCap: 75,
  healthyCap: 100,
  restDays: 7,
  recontactDays: 7,
  stopWords: ['stop', 'unsubscribe', 'remove me', 'do not message', "don't message", 'no'],
};

export const CAMPAIGN_PAGE_SIZE = 50;

const base = (ws: string) => `/api/workspaces/${encodeURIComponent(ws)}/campaigns`;

function pageQuery(status: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('page', String(page));
  return params.toString();
}

export const listCampaigns = (token: string, ws: string, q: { status?: CampaignStatus; page: number }) =>
  apiFetch<CampaignPage>(`${base(ws)}?${pageQuery(q.status, q.page)}`, { token });

export const getCampaign = (token: string, ws: string, id: string) =>
  apiFetch<CampaignDetail>(`${base(ws)}/${encodeURIComponent(id)}`, { token });

/** Creates a draft; a CSV audience goes as multipart (the request as the {@code campaign} part, the CSV as {@code file}). */
export async function createCampaign(token: string, ws: string, req: CampaignRequest, file?: File): Promise<CampaignView> {
  if (!file) return apiFetch<CampaignView>(base(ws), { method: 'POST', token, body: req });
  const body = new FormData();
  body.append('campaign', new Blob([JSON.stringify(req)], { type: 'application/json' }));
  body.append('file', file);
  const res = await apiFetchFile(base(ws), { token, body });
  return (await res.json()) as CampaignView;
}

export const deleteCampaign = (token: string, ws: string, id: string) =>
  apiFetch<void>(`${base(ws)}/${encodeURIComponent(id)}`, { method: 'DELETE', token });

export const campaignAction = (token: string, ws: string, id: string, action: CampaignAction) =>
  apiFetch<CampaignView>(`${base(ws)}/${encodeURIComponent(id)}/${action}`, { method: 'POST', token });

export const listRecipients = (token: string, ws: string, id: string, q: { status?: RecipientStatus; page: number }) =>
  apiFetch<RecipientPage>(`${base(ws)}/${encodeURIComponent(id)}/recipients?${pageQuery(q.status, q.page)}`, { token });

export const sampleCsv = (token: string, ws: string, templateId: string) =>
  apiFetchBlob(`${base(ws)}/templates/${encodeURIComponent(templateId)}/sample-csv`, token);

export async function previewCsv(token: string, ws: string, file: File): Promise<CsvPreview> {
  const body = new FormData();
  body.append('file', file);
  const res = await apiFetchFile(`${base(ws)}/csv/preview`, { token, body });
  return (await res.json()) as CsvPreview;
}

export const listSenders = (token: string, ws: string) => apiFetch<SenderView[]>(`${base(ws)}/senders`, { token });

export const updateSender = (
  token: string,
  ws: string,
  phoneNumberId: string,
  body: { runsOn?: string | null; action?: SenderAction },
) => apiFetch<SenderView>(`${base(ws)}/senders/${encodeURIComponent(phoneNumberId)}`, { method: 'PUT', token, body });

export const getCampaignSettings = (token: string, ws: string) =>
  apiFetch<CampaignSettings>(`${base(ws)}/settings`, { token });

export const updateCampaignSettings = (token: string, ws: string, s: CampaignSettings) =>
  apiFetch<CampaignSettings>(`${base(ws)}/settings`, { method: 'PUT', token, body: s });
