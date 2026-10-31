import type { CrmStatus } from '@app/api/crm';
import type { MockRoute } from './fetchMock';
import { BASE, boardRoutes } from './crmBoard';
import { sampleSegment, sampleSegmentFields, sampleSegmentPreview } from './crm';
import { PHONES } from './crmReports';

export const SEGMENTS_BASE = `${BASE}/segments`;

/** Two saved segments: one never sent, one sent by a campaign. */
export const SEGMENTS = [
  sampleSegment(),
  sampleSegment({
    id: 's2',
    name: 'Quiet contacts',
    description: null,
    cachedCounts: null,
    lastSentAt: '2026-10-29T08:00:00Z',
    lastCampaignId: 'k1',
    lastCampaignName: 'Diwali offer',
    version: 3,
  }),
];

/** Every route the Segments pages may call; the status grants crm:segments unless {@code status} says otherwise. */
export function segmentRoutes(
  extra: Record<string, MockRoute> = {},
  status: Partial<CrmStatus> = {},
): Record<string, MockRoute> {
  return boardRoutes(
    {
      [`GET ${SEGMENTS_BASE}`]: { status: 200, body: SEGMENTS },
      [`GET ${SEGMENTS_BASE}/fields`]: { status: 200, body: sampleSegmentFields() },
      [`GET ${SEGMENTS_BASE}/s1`]: { status: 200, body: SEGMENTS[0] },
      [`GET ${SEGMENTS_BASE}/s2`]: { status: 200, body: SEGMENTS[1] },
      [`POST ${SEGMENTS_BASE}/preview`]: { status: 200, body: sampleSegmentPreview() },
      [`POST ${SEGMENTS_BASE}/s1/preview`]: { status: 200, body: sampleSegmentPreview() },
      [`GET /api/workspaces/w1/users`]: { status: 200, body: [] },
      [`GET /api/workspaces/w1/contact-labels`]: { status: 200, body: [] },
      ...extra,
    },
    { phones: PHONES, authorities: ['crm:view', 'crm:edit', 'crm:segments'], ...status },
  );
}
