import type { Board, CrmContact, CrmSettings, CrmStatus, Deal, FieldDefinition, Pipeline } from '@app/api/crm';

/** A CRM status as the server sends it for a brand with the CRM switched on. */
export function crmStatus(overrides: Partial<CrmStatus> = {}): CrmStatus {
  return {
    enabled: true,
    limits: { maxPipelines: 3, maxCustomFields: 20 },
    phones: [],
    pipelineAccess: 'ALL',
    authorities: ['crm:view', 'crm:edit'],
    attachmentsEnabled: true,
    ...overrides,
  };
}

/** The CRM settings of a brand, as the server sends them. */
export function crmSettings(overrides: Partial<CrmSettings> = {}): CrmSettings {
  return {
    defaultCurrency: 'INR',
    defaultPipelineId: 'p1',
    dealRottingDays: 14,
    allowChannelMove: true,
    timelineShowsWhatsappMessages: true,
    lifecycleStatuses: [
      { key: 'lead', label: 'Lead', color: '#4394e5', position: 1000, active: true, isDefault: true },
    ],
    dealSources: [],
    taskTypes: [],
    lostReasons: [],
    industries: [],
    version: 4,
    ...overrides,
  };
}

/** A pipeline with three lanes: New and Proposal (open) and Won. */
export function samplePipeline(overrides: Partial<Pipeline> = {}): Pipeline {
  return {
    id: 'p1',
    name: 'Sales',
    isDefault: true,
    active: true,
    rottingDays: 7,
    version: 3,
    stages: [
      { id: 's1', name: 'New', color: '#4394e5', position: 1000, probability: 10, type: 'OPEN', wipLimit: null },
      { id: 's2', name: 'Proposal', color: '#dca614', position: 2000, probability: 50, type: 'OPEN', wipLimit: 5 },
      { id: 's3', name: 'Won', color: '#87bb62', position: 3000, probability: 100, type: 'WON', wipLimit: null },
    ],
    ...overrides,
  };
}

/** An open deal in the first lane of {@link samplePipeline}. */
export function sampleDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'd1',
    title: 'Acme order',
    pipelineId: 'p1',
    stageId: 's1',
    position: 1000,
    status: 'OPEN',
    amount: 1500,
    currency: 'INR',
    probability: 10,
    probabilityOverridden: false,
    expectedCloseDate: '2026-11-12',
    closedAt: null,
    lostReason: null,
    company: null,
    primaryContact: { id: 'c1', name: 'Priya Shah', phone: '919812345678' },
    crmContactIds: ['c1'],
    owner: { id: 'o1', name: 'Asha Rao' },
    source: null,
    labelIds: [],
    customFields: {},
    channel: { phoneNumberId: 'pn1', number: '919800000001' },
    stageEnteredAt: '2026-10-20T10:00:00Z',
    rotting: false,
    overdue: false,
    lastActivityAt: '2026-10-22T10:00:00Z',
    nextTaskDueAt: null,
    creationTime: '2026-10-01T10:00:00Z',
    version: 2,
    ...overrides,
  };
}

/**
 * The board of {@link samplePipeline}: New holds two deals, Proposal one (of six, one over its limit of five),
 * Won none.
 */
export function sampleBoard(overrides: Partial<Board> = {}): Board {
  const [s1, s2, s3] = samplePipeline().stages;
  return {
    pipelineId: 'p1',
    lanes: [
      {
        stage: s1,
        total: 2,
        sumAmount: 2500,
        deals: [
          sampleDeal(),
          sampleDeal({ id: 'd2', title: 'Globex renewal', amount: 1000, overdue: true, position: 2000 }),
        ],
      },
      {
        stage: s2,
        total: 6,
        sumAmount: 9000,
        deals: [
          sampleDeal({
            id: 'd3',
            title: 'Initech rollout',
            stageId: 's2',
            amount: 4000,
            rotting: true,
            position: 1000,
          }),
        ],
      },
      { stage: s3, total: 0, sumAmount: 0, deals: [] },
    ],
    ...overrides,
  };
}

/** A CRM contact as the search answers it. */
export function sampleCrmContact(overrides: Partial<CrmContact> = {}): CrmContact {
  return {
    id: 'c1',
    contactId: 'k1',
    channel: { phoneNumberId: 'pn1', number: '919800000001' },
    phone: '919812345678',
    name: 'Priya Shah',
    firstName: 'Priya',
    lastName: 'Shah',
    email: null,
    jobTitle: null,
    company: null,
    owner: null,
    lifecycleStatus: null,
    source: null,
    origin: null,
    customFields: {},
    openDealCount: 0,
    openDealAmount: 0,
    lastActivityAt: null,
    nextTaskDueAt: null,
    contactDeleted: false,
    channelHistory: [],
    creationTime: '2026-10-01T10:00:00Z',
    version: 1,
    ...overrides,
  };
}

/** A custom field definition: an active CONTACT text field unless overridden. */
export function sampleField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: 'f1',
    entityType: 'CONTACT',
    key: 'nickname',
    label: 'Nickname',
    type: 'TEXT',
    options: [],
    required: false,
    defaultValue: null,
    position: 1,
    showInList: false,
    showInCard: false,
    active: true,
    version: 0,
    ...overrides,
  };
}
