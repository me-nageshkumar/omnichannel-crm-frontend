import type { CrmSettings, CrmStatus, Pipeline } from '@app/api/crm';

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
