import * as React from 'react';
import { reportByOwner } from '@app/api/crm';
import { BarChart } from '@app/Crm/reports/charts/BarChart';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { type CardProps, ReportTable, money, moneyCompact, pct } from './cardShared';

const TITLE = 'By owner';

/** Won amount per owner, largest first. */
export const ByOwnerCard: React.FunctionComponent<CardProps> = ({ ws, body, tick, period, currency }) => {
  const q = useReport(reportByOwner, ws, body, tick);
  const d = q.data;
  const cur = d?.currency || currency;
  const rows = d?.rows ?? [];
  return (
    <ReportCard
      id="by-owner"
      title={TITLE}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={rows.length === 0}
      emptyText="No deals in this period."
      otherCurrencyDeals={d?.otherCurrencyDeals}
      chart={
        <BarChart
          title={TITLE}
          period={period}
          rows={rows.map((r) => ({
            key: r.ownerId,
            label: r.label,
            value: r.wonAmount,
            hint: `${r.wonCount} won · ${r.lostCount} lost · win rate ${pct(r.winRate)}`,
          }))}
          format={(v) => moneyCompact(v, cur)}
        />
      }
      table={
        <ReportTable
          label={TITLE}
          columns={['Owner', 'Open', 'Open amount', 'Won', 'Won amount', 'Lost', 'Win rate']}
          rows={rows.map((r) => ({
            key: r.ownerId,
            cells: [
              r.label,
              r.openCount,
              money(r.openAmount, cur),
              r.wonCount,
              money(r.wonAmount, cur),
              r.lostCount,
              pct(r.winRate),
            ],
          }))}
        />
      }
    />
  );
};
