import * as React from 'react';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import type { PipelineSummary } from '@app/api/crm';
import { StatTile } from '@app/Crm/reports/charts/StatTile';
import type { ReportQuery } from '@app/Crm/reports/useReport';
import { dealsWord, money, pct } from './cardShared';

/** The four headline figures of the pipeline summary. */
export const KpiRow: React.FunctionComponent<{ summary: ReportQuery<PipelineSummary>; currency: string }> = ({
  summary,
  currency,
}) => {
  if (summary.error) {
    return (
      <Alert
        variant="danger"
        isInline
        title={summary.error}
        className="pf-v6-u-mb-md"
        actionLinks={
          <Button variant="link" isInline onClick={summary.reload}>
            Retry
          </Button>
        }
      />
    );
  }
  const s = summary.data;
  if (!s) {
    return (
      <div className="crm-reports__tiles">
        <Spinner size="md" aria-label="Loading summary" />
      </div>
    );
  }
  const cur = s.currency || currency;
  return (
    <div className="crm-reports__tiles">
      <StatTile label="Open pipeline" value={money(s.openAmount, cur)} sub={dealsWord(s.openCount)} />
      <StatTile label="Won in period" value={money(s.won.amount, cur)} sub={dealsWord(s.won.count)} />
      <StatTile label="Win rate" value={pct(s.winRate)} sub={`${s.won.count} won · ${s.lost.count} lost`} />
      <StatTile
        label="Average won deal"
        value={s.averageWonAmount === null ? '—' : money(s.averageWonAmount, cur)}
        sub={s.averageWonAmount === null ? 'No deals won yet' : undefined}
      />
    </div>
  );
};
