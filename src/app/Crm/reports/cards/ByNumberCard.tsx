import * as React from 'react';
import { reportByNumber } from '@app/api/crm';
import { BarChart } from '@app/Crm/reports/charts/BarChart';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { type CardProps, ReportTable, money, moneyCompact } from './cardShared';

const TITLE = 'By number';

/** Won amount per WhatsApp number, largest first. */
export const ByNumberCard: React.FunctionComponent<CardProps> = ({ ws, body, tick, period, currency }) => {
  const q = useReport(reportByNumber, ws, body, tick);
  const d = q.data;
  const cur = d?.currency || currency;
  const rows = d?.rows ?? [];
  return (
    <ReportCard
      id="by-number"
      title={TITLE}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={rows.length === 0}
      emptyText="No deals from a number in this period."
      otherCurrencyDeals={d?.otherCurrencyDeals}
      chart={
        <BarChart
          title={TITLE}
          period={period}
          rows={rows.map((r) => ({
            key: r.phoneNumberId,
            label: r.label,
            value: r.wonAmount,
            hint: `${r.created} created · ${r.won} won · ${money(r.openAmount, cur)} open`,
          }))}
          format={(v) => moneyCompact(v, cur)}
        />
      }
      table={
        <ReportTable
          label={TITLE}
          columns={['Number', 'Created', 'Won', 'Won amount', 'Open amount']}
          rows={rows.map((r) => ({
            key: r.phoneNumberId,
            cells: [r.label, r.created, r.won, money(r.wonAmount, cur), money(r.openAmount, cur)],
          }))}
        />
      }
    />
  );
};
