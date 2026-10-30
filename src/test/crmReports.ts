import type { CrmStatus } from '@app/api/crm';
import type { MockRoute } from './fetchMock';
import { BASE, boardRoutes } from './crmBoard';
import {
  sampleActivitySummary,
  sampleByNumber,
  sampleByOwner,
  sampleBySource,
  sampleCampaignsReport,
  sampleDealsOverTime,
  sampleGridReport,
  sampleLifecycleFunnel,
  samplePipelineSummary,
  sampleStageDuration,
} from './crm';

/** The report calls the Overview tab makes, in the order of its cards. */
export const OVERVIEW = [
  'pipeline-summary',
  'deals-over-time',
  'by-owner',
  'by-source',
  'by-number',
  'lifecycle-funnel',
  'activity-summary',
  'stage-duration',
  'campaigns',
] as const;
export const REPORTS = [...OVERVIEW, 'grid'] as const;
export type ReportName = (typeof REPORTS)[number];

export const reportPath = (name: ReportName) => `POST ${BASE}/reports/${name}`;

export const PHONES: CrmStatus['phones'] = [
  { phoneNumberId: 'n1', number: '+91 98765 00001', label: 'Sales line', canChat: true },
  { phoneNumberId: 'n2', number: '+91 98765 00002', label: null, canChat: true },
];

/** The brand's people as GET /users answers them (the manager herself, u4, is among them). */
export const USERS = [
  { id: 'u4', name: 'Meera Manager', username: 'meera', active: true },
  { id: 'u9', name: 'Ravi Kumar', username: 'ravi', active: true },
  { id: 'u10', name: 'Gone Person', username: 'gone', active: false },
];

/** Every route the Reports page may call, each report answering its sample. */
export function reportRoutes(
  extra: Record<string, MockRoute> = {},
  status: Partial<CrmStatus> = {},
): Record<string, MockRoute> {
  return boardRoutes(
    {
      'GET /api/workspaces/w1/users': { status: 200, body: USERS },
      [reportPath('pipeline-summary')]: { status: 200, body: samplePipelineSummary() },
      [reportPath('deals-over-time')]: { status: 200, body: sampleDealsOverTime() },
      [reportPath('by-owner')]: { status: 200, body: sampleByOwner() },
      [reportPath('by-source')]: { status: 200, body: sampleBySource() },
      [reportPath('by-number')]: { status: 200, body: sampleByNumber() },
      [reportPath('lifecycle-funnel')]: { status: 200, body: sampleLifecycleFunnel() },
      [reportPath('activity-summary')]: { status: 200, body: sampleActivitySummary() },
      [reportPath('stage-duration')]: { status: 200, body: sampleStageDuration() },
      [reportPath('campaigns')]: { status: 200, body: sampleCampaignsReport() },
      [reportPath('grid')]: { status: 200, body: sampleGridReport() },
      ...extra,
    },
    { authorities: ['crm:view'], phones: PHONES, ...status },
  );
}
