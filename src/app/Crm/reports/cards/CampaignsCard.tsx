import * as React from 'react';
import { type CampaignsReportRow, reportCampaigns } from '@app/api/crm';
import { SegmentedBar } from '@app/Crm/reports/charts/SegmentedBar';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { type CardProps, ReportTable, longDay } from './cardShared';

const TITLE = 'Campaigns';
/** A campaign reaches people, not deals: the server ignores the pipeline filter for this column. */
const ALL_PIPELINES = 'CRM contacts reached covers all pipelines.';

const Delivery: React.FunctionComponent<{ row: CampaignsReportRow }> = ({ row: r }) => (
  <div className="crm-reports__delivery">
    <SegmentedBar
      ariaLabel={`Delivery of ${r.name}`}
      total={Math.max(r.sent, r.recipients, 1)}
      parts={[
        { key: 'read', label: 'Read', value: r.read },
        { key: 'delivered', label: 'Delivered, unread', value: Math.max(r.delivered - r.read, 0) },
        { key: 'pending', label: 'Sent, not delivered', value: Math.max(r.sent - r.delivered - r.failed, 0) },
        { key: 'failed', label: 'Failed', value: r.failed },
      ]}
    />
    <span className="crm-reports__delivery-figures">
      {`${r.sent} sent · ${r.delivered} delivered · ${r.read} read · ${r.failed} failed`}
    </span>
  </div>
);

/** The campaigns started in the period, with how far each got and how many CRM contacts it reached. */
export const CampaignsCard: React.FunctionComponent<CardProps> = ({ ws, body, tick, period }) => {
  const q = useReport(reportCampaigns, ws, body, tick);
  const rows = q.data?.rows ?? [];
  const table = (
    <ReportTable
      label={TITLE}
      columns={['Campaign', 'Segment', 'Started', 'Numbers', 'Recipients', 'Delivery', 'CRM contacts reached']}
      rows={rows.map((r) => ({
        key: r.campaignId,
        cells: [
          r.name,
          r.segmentName ?? '—',
          longDay(r.startedAt),
          r.numbers.map((n) => n.label).join(', ') || '—',
          r.recipients,
          <Delivery key="delivery" row={r} />,
          r.crmContactsReached,
        ],
      }))}
    />
  );
  return (
    <ReportCard
      id="campaigns"
      title={TITLE}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={rows.length === 0}
      emptyText="No campaigns started in this period."
      note={(q.data?.truncated ? 'Showing the latest 200. ' : '') + ALL_PIPELINES}
      tableOnly
      chart={table}
      table={table}
    />
  );
};
