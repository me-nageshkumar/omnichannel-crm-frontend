import * as React from 'react';
import { reportActivitySummary } from '@app/api/crm';
import { ReportCard } from '@app/Crm/reports/ReportCard';
import { useReport } from '@app/Crm/reports/useReport';
import { type CardProps, ReportTable } from './cardShared';

const TITLE = 'Activity by person';

/** What each person did in the period. */
export const ActivityCard: React.FunctionComponent<CardProps> = ({ ws, body, tick, period }) => {
  const q = useReport(reportActivitySummary, ws, body, tick);
  const rows = q.data?.rows ?? [];
  const table = (
    <ReportTable
      label={TITLE}
      columns={['Person', 'Tasks done', 'Notes', 'Moves', 'Won', 'Lost', 'Calls', 'Meetings', 'Emails']}
      rows={rows.map((r) => ({
        key: r.actorId,
        cells: [
          r.label,
          r.tasksCompleted,
          r.notesAdded,
          r.stageMoves,
          r.dealsWon,
          r.dealsLost,
          r.calls,
          r.meetings,
          r.emails,
        ],
      }))}
    />
  );
  return (
    <ReportCard
      id="activity"
      title={TITLE}
      period={period}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={rows.length === 0}
      emptyText="No activity in this period."
      tableOnly
      chart={table}
      table={table}
    />
  );
};
