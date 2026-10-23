import type { CrmStatus } from '@app/api/crm';
import type { MockRoute } from './fetchMock';
import { crmSettings, crmStatus, sampleBoard, sampleDeal, samplePipeline } from './crm';
import { WORKSPACE_MANAGER, meAs } from './session';

export const BASE = '/api/workspaces/w1/crm';
export const SALES = samplePipeline();
export const SUPPORT = samplePipeline({ id: 'p2', name: 'Support', isDefault: false, rottingDays: null, version: 1 });

/** The routes the Pipelines page loads: status, settings, pipelines, board and a deal search. */
export function boardRoutes(
  extra: Record<string, MockRoute> = {},
  status: Partial<CrmStatus> = {},
): Record<string, MockRoute> {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${BASE}/status`]: { status: 200, body: crmStatus(status) },
    [`GET ${BASE}/settings`]: { status: 200, body: crmSettings({ dealSources: [] }) },
    [`GET ${BASE}/pipelines`]: { status: 200, body: [SALES, SUPPORT] },
    [`GET ${BASE}/deals/board`]: { status: 200, body: sampleBoard() },
    [`POST ${BASE}/deals/search`]: { status: 200, body: { items: [sampleDeal()], total: 1, page: 0 } },
    ...extra,
  };
}

/** The query string of the n-th GET to {@code path}, as an object. */
export function queryOf(fetchFn: { mock: { calls: unknown[][] } }, path: string, n = -1): URLSearchParams {
  const hits = fetchFn.mock.calls
    .map(([input]) => String(input))
    .filter((u) => new URL(u, 'http://localhost').pathname === path);
  const url = hits[n < 0 ? hits.length + n : n] ?? '';
  return new URL(url, 'http://localhost').searchParams;
}
