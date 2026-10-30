import * as React from 'react';
import type { PipelineSummary } from '@app/api/crm';
import { BarChart } from '@app/Crm/reports/charts/BarChart';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import type { ReportQuery } from '@app/Crm/reports/useReport';
import { ReportTable, money, moneyCompact } from './cardShared';

const TITLE = 'Pipeline by stage';

/** Open amount per lane, in lane order. */
export const PipelineByStageCard: React.FunctionComponent<{
  summary: ReportQuery<PipelineSummary>;
  period: string;
  currency: string;
}> = ({ summary, period, currency }) => {
  const s = summary.data;
  const cur = s?.currency || currency;
  const stages = s?.stages ?? [];
  return (
    <ReportCard
      id="pipeline-by-stage"
      title={TITLE}
      period={period}
      loading={summary.loading}
      error={summary.error}
      onRetry={summary.reload}
      empty={stages.length === 0}
      emptyText="This pipeline has no stages."
      otherCurrencyDeals={s?.otherCurrencyDeals}
      chart={
        <BarChart
          title={TITLE}
          period={period}
          keepOrder
          rows={stages.map((st) => ({
            key: st.stageId,
            label: st.name,
            value: st.openAmount,
            hint: `${st.openCount} open · weighted ${money(st.weightedAmount, cur)}`,
          }))}
          format={(v) => moneyCompact(v, cur)}
        />
      }
      table={
        <ReportTable
          label={TITLE}
          columns={['Stage', 'Open', 'Open amount', 'Weighted']}
          rows={stages.map((st) => ({
            key: st.stageId,
            cells: [st.name, st.openCount, money(st.openAmount, cur), money(st.weightedAmount, cur)],
          }))}
        />
      }
    />
  );
};
