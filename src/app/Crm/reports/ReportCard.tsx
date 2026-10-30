import * as React from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';

type View = 'chart' | 'table';

const storageKey = (id: string) => `crm.reports.view.${id}`;
function readView(id: string): View {
  try {
    return localStorage.getItem(storageKey(id)) === 'table' ? 'table' : 'chart';
  } catch {
    return 'chart';
  }
}
function writeView(id: string, view: View): void {
  try {
    localStorage.setItem(storageKey(id), view);
  } catch {
    // Remembering the view is a convenience only.
  }
}

export interface ReportCardProps {
  /** Stable per card; keys the remembered view. */
  id: string;
  title: string;
  /** The days the figures cover, e.g. "1 Aug – 29 Oct 2026". */
  period?: string;
  /** True while there is nothing to show yet; a reload with figures on screen keeps them. */
  loading: boolean;
  error: string | null;
  onRetry(): void;
  empty: boolean;
  emptyText?: string;
  /** Deals left out of the money because they are in another currency. */
  otherCurrencyDeals?: number;
  chart: React.ReactNode;
  /** The accessible form of the same figures; always available. */
  table: React.ReactNode;
  /** For figures that are a table and nothing else: no toggle. */
  tableOnly?: boolean;
  note?: string;
}

/** One report: its title and period, a Chart/Table toggle remembered per card, and its loading, error and empty states. */
export const ReportCard: React.FunctionComponent<ReportCardProps> = ({
  id,
  title,
  period,
  loading,
  error,
  onRetry,
  empty,
  emptyText = 'Nothing in this period.',
  otherCurrencyDeals = 0,
  chart,
  table,
  tableOnly = false,
  note,
}) => {
  const [view, setView] = React.useState<View>(() => readView(id));
  const pick = (next: View) => {
    setView(next);
    writeView(id, next);
  };
  const shown = tableOnly ? 'table' : view;

  let body: React.ReactNode;
  if (error) {
    body = (
      <Alert
        variant="danger"
        isInline
        title={error}
        actionLinks={
          <Button variant="link" isInline onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  } else if (loading) {
    body = <Spinner size="lg" aria-label={`Loading ${title}`} />;
  } else if (empty) {
    body = (
      <EmptyState variant="xs">
        <EmptyStateBody>{emptyText}</EmptyStateBody>
      </EmptyState>
    );
  } else {
    body = shown === 'chart' ? chart : table;
  }

  const other =
    otherCurrencyDeals > 0
      ? otherCurrencyDeals === 1
        ? '+ 1 deal in another currency'
        : `+ ${otherCurrencyDeals} deals in other currencies`
      : null;

  return (
    <Card className="crm-report-card" isFullHeight>
      <CardHeader
        actions={
          tableOnly
            ? undefined
            : {
                actions: (
                  <ToggleGroup aria-label={`View of ${title}`} isCompact>
                    <ToggleGroupItem text="Chart" isSelected={shown === 'chart'} onChange={() => pick('chart')} />
                    <ToggleGroupItem text="Table" isSelected={shown === 'table'} onChange={() => pick('table')} />
                  </ToggleGroup>
                ),
                hasNoOffset: true,
              }
        }
      >
        <CardTitle>
          {title}
          {period && <span className="crm-report-card__period">{period}</span>}
        </CardTitle>
      </CardHeader>
      <CardBody>{body}</CardBody>
      {(note || other) && (
        <CardFooter className="crm-report-card__footer">
          {note && <div>{note}</div>}
          {other && <div>{other}</div>}
        </CardFooter>
      )}
    </Card>
  );
};
