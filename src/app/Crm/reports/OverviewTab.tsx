import * as React from 'react';
import type { ReportFilter } from '@app/api/crm';
import {
  reportActivitySummary,
  reportByNumber,
  reportByOwner,
  reportBySource,
  reportCampaigns,
  reportDealsOverTime,
  reportLifecycleFunnel,
  reportPipelineSummary,
  reportStageDuration,
} from '@app/api/crm';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';

export interface OverviewProps {
  ws: string;
  body: ReportFilter;
  tick: number;
  period: string;
  currency: string;
}

/* Until the real cards land, every report shows its raw answer. */
const RawCard = <T,>({
  id,
  title,
  period,
  ws,
  body,
  tick,
  call,
}: {
  id: string;
  title: string;
  period: string;
  ws: string;
  body: ReportFilter;
  tick: number;
  call: (token: string, ws: string, body: ReportFilter) => Promise<T>;
}) => {
  const q = useReport(call, ws, body, tick);
  const raw = <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(q.data, null, 1)}</pre>;
  return (
    <ReportCard
      id={id}
      title={title}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={false}
      chart={raw}
      table={raw}
    />
  );
};

/** The Overview tab: the KPI tiles and the nine cards of the brand's CRM for the filter. */
export const OverviewTab: React.FunctionComponent<OverviewProps> = ({ ws, body, tick, period }) => {
  const common = { ws, body, tick, period };
  return (
    <div className="crm-reports__grid">
      <RawCard id="pipeline-summary" title="Pipeline summary" call={reportPipelineSummary} {...common} />
      <RawCard id="deals-over-time" title="Deals over time" call={reportDealsOverTime} {...common} />
      <RawCard id="by-owner" title="By owner" call={reportByOwner} {...common} />
      <RawCard id="by-source" title="By source" call={reportBySource} {...common} />
      <RawCard id="by-number" title="By number" call={reportByNumber} {...common} />
      <RawCard id="lifecycle-funnel" title="Lifecycle funnel" call={reportLifecycleFunnel} {...common} />
      <RawCard id="activity-summary" title="Activity summary" call={reportActivitySummary} {...common} />
      <RawCard id="stage-duration" title="Stage duration" call={reportStageDuration} {...common} />
      <RawCard id="campaigns" title="Campaigns" call={reportCampaigns} {...common} />
    </div>
  );
};
