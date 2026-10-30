import type {
  ActivitySummary,
  Board,
  ByNumber,
  ByOwner,
  BySource,
  CampaignsReport,
  CrmContact,
  CrmSettings,
  CrmStatus,
  Deal,
  DealsOverTime,
  FieldDefinition,
  GridReport,
  LifecycleFunnel,
  Pipeline,
  PipelineSummary,
  ReportFilter,
  StageDuration,
  Task,
} from '@app/api/crm';

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

/** An open task on deal d1 assigned to the signed-in manager (u4), due in one hour unless overridden. */
export function sampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Call back',
    description: null,
    type: null,
    priority: 'NORMAL',
    dueAt: new Date(Date.now() + 3600_000).toISOString(),
    reminderAt: null,
    status: 'OPEN',
    completedAt: null,
    completedBy: null,
    assignee: { id: 'u4', name: 'Meera Manager' },
    target: { type: 'DEAL', id: 'd1', name: 'Acme order' },
    overdue: false,
    version: 0,
    ...overrides,
  };
}

/** The filter the console sends for the default range (last 90 days in Asia/Kolkata) of the default pipeline. */
export function sampleReportFilterBody(overrides: Partial<ReportFilter> = {}): ReportFilter {
  return {
    from: '2026-08-01T18:30:00.000Z',
    to: '2026-10-30T18:30:00.000Z',
    tz: 'Asia/Kolkata',
    pipelineId: 'p1',
    ...overrides,
  };
}

export function samplePipelineSummary(overrides: Partial<PipelineSummary> = {}): PipelineSummary {
  return {
    pipelineId: 'p1',
    pipelineName: 'Sales',
    currency: 'INR',
    stages: [
      { stageId: 's1', name: 'New', type: 'OPEN', openCount: 4, openAmount: 120000, weightedAmount: 12000 },
      { stageId: 's2', name: 'Proposal', type: 'OPEN', openCount: 2, openAmount: 80000, weightedAmount: 40000 },
      { stageId: 's3', name: 'Won', type: 'WON', openCount: 0, openAmount: 0, weightedAmount: 0 },
    ],
    openCount: 6,
    openAmount: 200000,
    won: { count: 3, amount: 150000 },
    lost: { count: 1, amount: 20000 },
    winRate: 0.75,
    averageWonAmount: 50000,
    otherCurrencyDeals: 0,
    ...overrides,
  };
}

export function sampleDealsOverTime(overrides: Partial<DealsOverTime> = {}): DealsOverTime {
  return {
    bucket: 'WEEK',
    currency: 'INR',
    points: [
      { start: '2026-10-04T18:30:00Z', created: 3, won: 1, lost: 0, wonAmount: 40000 },
      { start: '2026-10-11T18:30:00Z', created: 5, won: 1, lost: 1, wonAmount: 60000 },
      { start: '2026-10-18T18:30:00Z', created: 2, won: 1, lost: 0, wonAmount: 50000 },
    ],
    otherCurrencyDeals: 0,
    ...overrides,
  };
}

export function sampleByOwner(overrides: Partial<ByOwner> = {}): ByOwner {
  return {
    currency: 'INR',
    rows: [
      {
        ownerId: 'u4',
        label: 'Meera Manager',
        openCount: 3,
        openAmount: 100000,
        wonCount: 2,
        wonAmount: 90000,
        lostCount: 1,
        winRate: 0.667,
      },
      {
        ownerId: 'u9',
        label: 'Ravi Kumar',
        openCount: 3,
        openAmount: 100000,
        wonCount: 1,
        wonAmount: 60000,
        lostCount: 0,
        winRate: 1,
      },
    ],
    otherCurrencyDeals: 0,
    ...overrides,
  };
}

export function sampleBySource(overrides: Partial<BySource> = {}): BySource {
  return {
    currency: 'INR',
    deals: [
      { source: 'INBOUND_CHAT', label: 'Inbound chat', created: 5, won: 2, wonAmount: 90000 },
      { source: 'MANUAL', label: 'Manual', created: 3, won: 1, wonAmount: 60000 },
    ],
    contacts: [
      { originKind: 'INBOUND_CHAT', created: 12 },
      { originKind: 'MANUAL', created: 3 },
    ],
    otherCurrencyDeals: 0,
    ...overrides,
  };
}

export function sampleByNumber(overrides: Partial<ByNumber> = {}): ByNumber {
  return {
    currency: 'INR',
    rows: [
      { phoneNumberId: 'n1', label: 'Sales line', created: 6, won: 3, wonAmount: 150000, openAmount: 200000 },
      { phoneNumberId: 'n2', label: '+91 98765 00002', created: 2, won: 0, wonAmount: 0, openAmount: 0 },
    ],
    otherCurrencyDeals: 0,
    ...overrides,
  };
}

export function sampleLifecycleFunnel(overrides: Partial<LifecycleFunnel> = {}): LifecycleFunnel {
  return {
    rows: [
      { key: 'lead', label: 'Lead', active: true, count: 20 },
      { key: 'customer', label: 'Customer', active: true, count: 5 },
    ],
    total: 25,
    ...overrides,
  };
}

export function sampleActivitySummary(overrides: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    rows: [
      {
        actorId: 'u4',
        label: 'Meera Manager',
        tasksCompleted: 4,
        notesAdded: 2,
        stageMoves: 6,
        dealsWon: 2,
        dealsLost: 1,
        calls: 3,
        meetings: 1,
        emails: 0,
      },
    ],
    ...overrides,
  };
}

export function sampleStageDuration(overrides: Partial<StageDuration> = {}): StageDuration {
  return {
    pipelineId: 'p1',
    pipelineName: 'Sales',
    since: '2026-08-01T00:00:00Z',
    stages: [
      { stageId: 's1', name: 'New', movesOut: 5, averageDays: 2.5, medianDays: 2, openNow: 4, averageDaysOpenNow: 6.1 },
      {
        stageId: 's2',
        name: 'Proposal',
        movesOut: 3,
        averageDays: 7.2,
        medianDays: 6,
        openNow: 2,
        averageDaysOpenNow: 3,
      },
    ],
    ...overrides,
  };
}

export function sampleCampaignsReport(overrides: Partial<CampaignsReport> = {}): CampaignsReport {
  return {
    rows: [
      {
        campaignId: 'c1',
        name: 'Diwali sale',
        status: 'COMPLETED',
        startedAt: '2026-10-20T04:30:00Z',
        numbers: [{ phoneNumberId: 'n1', label: 'Sales line' }],
        recipients: 200,
        sent: 198,
        delivered: 190,
        read: 120,
        replied: 15,
        failed: 2,
        crmContactsReached: 40,
      },
    ],
    truncated: false,
    ...overrides,
  };
}

export function sampleGridReport(overrides: Partial<GridReport> = {}): GridReport {
  return {
    entityType: 'DEAL',
    groupBy: 'stage',
    metric: 'COUNT',
    field: null,
    dateBucket: null,
    currency: 'INR',
    rows: [
      { key: 's1', label: 'New', value: 4, count: 4 },
      { key: 's2', label: 'Proposal', value: 2, count: 2 },
    ],
    truncated: false,
    otherCurrencyDeals: 0,
    ...overrides,
  };
}
