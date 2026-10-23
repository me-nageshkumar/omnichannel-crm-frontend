import type { CrmStatus } from '@app/api/crm';

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
