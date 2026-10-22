import type {
  CampaignDetail,
  CampaignSettings,
  CampaignView,
  RecipientView,
  SenderView,
} from '@app/api/campaigns';
import { RECOMMENDED_SETTINGS } from '@app/api/campaigns';

export function campaign(over: Partial<CampaignView> = {}): CampaignView {
  return {
    id: 'c1',
    name: 'Diwali offer',
    status: 'DRAFT',
    pausedBy: null,
    pauseReason: null,
    audience: {
      kind: 'FILTER',
      filterId: 'f1',
      filterName: 'Delhi leads',
      csvFileName: null,
      csvHeaders: null,
      csvRows: null,
      phoneColumn: null,
      nameColumn: null,
      filterSpec: null,
    },
    templateIds: ['t1'],
    templateNames: ['Diwali greeting'],
    placeholders: [],
    senderIds: ['p1'],
    counts: { total: 0, pending: 0, sent: 0, delivered: 0, read: 0, replied: 0, skipped: 0, failed: 0 },
    creationTime: '2026-10-21T05:30:00Z',
    startedAt: null,
    finishedAt: null,
    version: 0,
    createdBy: 'Asha',
    lastUpdateTime: '2026-10-21T05:30:00Z',
    estimate: null,
    senders: null,
    ...over,
  };
}

export function sender(over: Partial<SenderView> = {}): SenderView {
  return {
    phoneNumberId: 'p1',
    number: '919800000001',
    label: 'Sales 1',
    phoneStatus: 'CONNECTED',
    state: 'ACTIVE',
    ageDay: 30,
    capToday: 75,
    usedToday: 0,
    hourlyUsed: 0,
    restUntil: null,
    pausedUntil: null,
    pauseReason: null,
    lowReplyRate: false,
    halfPaceUntil: null,
    runsOn: null,
    ready: true,
    logoutAt: null,
    lastSendAt: null,
    nextSendAt: null,
    warmupStartedAt: null,
    ...over,
  };
}

export function campaignDetail(over: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    ...campaign(),
    estimate: { remaining: 0, perDay: 75, days: null, finishBy: null },
    senders: [sender()],
    ...over,
  };
}

export function recipient(over: Partial<RecipientView> = {}): RecipientView {
  return {
    id: 'r1',
    phone: '919800000002',
    contactId: null,
    contactName: null,
    status: 'PENDING',
    skipReason: null,
    senderId: null,
    senderNumber: null,
    sentAt: null,
    repliedAt: null,
    error: null,
    templateId: null,
    attemptedAt: null,
    deliveredAt: null,
    readAt: null,
    attempts: 0,
    dispatchedAt: null,
    ...over,
  };
}

/** The recommended settings, at version 0. */
export function campaignSettings(over: Partial<CampaignSettings> = {}): CampaignSettings {
  return { ...RECOMMENDED_SETTINGS, version: 0, ...over };
}

/** A JSON Blob part of a FormData; jsdom's Blob has no {@code text()}. */
export function partJson(form: FormData, name: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(JSON.parse(String(reader.result)));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(form.get(name) as Blob);
  });
}
