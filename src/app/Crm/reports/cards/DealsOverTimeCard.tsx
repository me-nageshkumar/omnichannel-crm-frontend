import * as React from 'react';
import { type ReportBucket, reportDealsOverTime } from '@app/api/crm';
import { LineChart } from '@app/Crm/reports/charts/LineChart';
import { compact, day, month, week } from '@app/Crm/reports/charts/chartText';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { type CardProps, ReportTable, money } from './cardShared';

const TITLE = 'Deals over time';
const X_FORMAT: Record<ReportBucket, (d: Date) => string> = { DAY: day, WEEK: week, MONTH: month };

/** Deals created, won and lost per day, week or month of the range. */
export const DealsOverTimeCard: React.FunctionComponent<CardProps> = ({ ws, body, tick, period, currency }) => {
  const q = useReport(reportDealsOverTime, ws, body, tick);
  const d = q.data;
  const cur = d?.currency || currency;
  const points = d?.points ?? [];
  const formatX = X_FORMAT[d?.bucket ?? 'DAY'];
  const series = (key: 'created' | 'won' | 'lost', label: string) => ({
    key,
    label,
    points: points.map((p) => ({ x: new Date(p.start), y: p[key] })),
  });
  return (
    <ReportCard
      id="deals-over-time"
      title={TITLE}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={points.every((p) => p.created + p.won + p.lost === 0)}
      emptyText="No deals in this period."
      otherCurrencyDeals={d?.otherCurrencyDeals}
      note={d ? `Deals by ${d.bucket.toLowerCase()}.` : undefined}
      chart={
        <LineChart
          title={TITLE}
          period={period}
          series={[series('created', 'Created'), series('won', 'Won'), series('lost', 'Lost')]}
          formatY={compact}
          formatX={formatX}
        />
      }
      table={
        <ReportTable
          label={TITLE}
          columns={['Period', 'Created', 'Won', 'Lost', 'Won amount']}
          rows={points.map((p) => ({
            key: p.start,
            cells: [formatX(new Date(p.start)), p.created, p.won, p.lost, money(p.wonAmount, cur)],
          }))}
        />
      }
    />
  );
};
