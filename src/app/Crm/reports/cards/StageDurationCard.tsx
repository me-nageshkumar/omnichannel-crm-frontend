import * as React from 'react';
import { reportStageDuration } from '@app/api/crm';
import { BarChart } from '@app/Crm/reports/charts/BarChart';
import { compact } from '@app/Crm/reports/charts/chartText';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { type CardProps, ReportTable, longDay } from './cardShared';

const TITLE = 'Stage duration';
const days = (v: number | null) => (v === null ? '—' : `${compact(v)} d`);

/** How long deals spend in each lane before moving on, in lane order. */
export const StageDurationCard: React.FunctionComponent<CardProps> = ({ ws, body, tick, period }) => {
  const q = useReport(reportStageDuration, ws, body, tick);
  const d = q.data;
  const stages = d?.stages ?? [];
  return (
    <ReportCard
      id="stage-duration"
      title={TITLE}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={stages.length === 0}
      emptyText="This pipeline has no stages."
      note={d ? (d.since ? `Based on moves since ${longDay(d.since)}` : 'No moves recorded yet.') : undefined}
      chart={
        <BarChart
          title={TITLE}
          period={period}
          keepOrder
          rows={stages.map((s) => ({
            key: s.stageId,
            label: s.name,
            value: s.averageDays ?? 0,
            hint: `median ${days(s.medianDays)} · ${s.movesOut} moves · ${s.openNow} open now, avg ${days(s.averageDaysOpenNow)}`,
          }))}
          format={(v) => `${compact(v)} d`}
        />
      }
      table={
        <ReportTable
          label={TITLE}
          columns={['Stage', 'Moves out', 'Average days', 'Median days', 'Open now', 'Avg days open now']}
          rows={stages.map((s) => ({
            key: s.stageId,
            cells: [s.name, s.movesOut, days(s.averageDays), days(s.medianDays), s.openNow, days(s.averageDaysOpenNow)],
          }))}
        />
      }
    />
  );
};
