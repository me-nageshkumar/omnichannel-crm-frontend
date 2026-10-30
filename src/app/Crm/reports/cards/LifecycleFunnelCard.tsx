import * as React from 'react';
import { reportLifecycleFunnel } from '@app/api/crm';
import { BarChart } from '@app/Crm/reports/charts/BarChart';
import { compact } from '@app/Crm/reports/charts/chartText';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { type CardProps, ReportTable } from './cardShared';

const TITLE = 'Lifecycle funnel';

/** Contacts per lifecycle status now, in picklist order. */
export const LifecycleFunnelCard: React.FunctionComponent<CardProps> = ({ ws, body, tick }) => {
  const q = useReport(reportLifecycleFunnel, ws, body, tick);
  const rows = (q.data?.rows ?? []).map((r) => ({ ...r, label: r.active ? r.label : `${r.label} (inactive)` }));
  return (
    <ReportCard
      id="lifecycle-funnel"
      title={TITLE}
      period="Now"
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={(q.data?.total ?? 0) === 0}
      emptyText="No contacts yet."
      note="Snapshot of contacts now; the date range does not apply."
      chart={
        <BarChart
          title={TITLE}
          period="now"
          keepOrder
          rows={rows.map((r) => ({ key: r.key, label: r.label, value: r.count }))}
          format={compact}
        />
      }
      table={
        <ReportTable
          label={TITLE}
          columns={['Status', 'Contacts']}
          rows={rows.map((r) => ({ key: r.key, cells: [r.label, r.count] }))}
        />
      }
    />
  );
};
