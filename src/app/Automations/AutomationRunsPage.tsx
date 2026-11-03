import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Alert, EmptyState, Label, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { getRule, listRuns } from '@app/api/automations';
import type { Run } from '@app/api/automations';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { shortTime } from '@app/Crm/segments/segmentModel';
import { useSession } from '@app/session/SessionContext';
import { HistoryPager } from '@app/Automations/HistoryPager';
import { RunSteps } from '@app/Automations/RunSteps';
import { runStatusLabel } from '@app/Automations/automationDisplay';

export const whoText = (run: Pick<Run, 'contact' | 'deal'>): string => {
  const c = run.contact;
  if (c && (c.name || c.phone)) return c.name || `+${c.phone}`;
  return run.deal?.title ?? '—';
};

/** The runs of one rule, newest first, each expandable to its steps. */
export const AutomationRunsPage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [page, setPage] = React.useState(0);
  const [open, setOpen] = React.useState<string[]>([]);
  const rule = useLoad((tk) => getRule(tk, ws, id), [ws, id]);
  const runs = useLoad((tk) => listRuns(tk, ws, id, page), [ws, id, page]);
  const toggle = (rid: string) => setOpen((o) => (o.indexOf(rid) >= 0 ? o.filter((x) => x !== rid) : [...o, rid]));

  let body: React.ReactNode;
  if (runs.error) body = <Alert variant="danger" isInline title={runs.error} />;
  else if (!runs.data) body = <Spinner aria-label="Loading runs" />;
  else if (runs.data.items.length === 0 && page === 0)
    body = <EmptyState headingLevel="h2" titleText="This rule has not run yet." />;
  else
    body = (
      <>
        <Table aria-label="Runs" variant="compact">
          <Thead>
            <Tr>
              <Th screenReaderText="Expand" />
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Event</Th>
              <Th>Outcome</Th>
            </Tr>
          </Thead>
          {runs.data.items.map((r, i) => {
            const expanded = open.indexOf(r.id) >= 0;
            return (
              <Tbody key={r.id} isExpanded={expanded}>
                <Tr>
                  <Td expand={{ rowIndex: i, isExpanded: expanded, onToggle: () => toggle(r.id) }} />
                  <Td dataLabel="When">{shortTime(r.startedAt)}</Td>
                  <Td dataLabel="Who">{whoText(r)}</Td>
                  <Td dataLabel="Event">{r.summary}</Td>
                  <Td dataLabel="Outcome">
                    {runStatusLabel(r.status)}
                    {r.test && (
                      <Label isCompact className="pf-v6-u-ml-sm">
                        Test
                      </Label>
                    )}
                  </Td>
                </Tr>
                <Tr isExpanded={expanded}>
                  <Td colSpan={5}>{expanded && <RunSteps steps={r.steps} />}</Td>
                </Tr>
              </Tbody>
            );
          })}
        </Table>
        <HistoryPager page={page} total={runs.data.total} onPage={setPage} />
      </>
    );

  return <PageShell title={rule.data ? `Runs of “${rule.data.name}”` : 'Runs'}>{body}</PageShell>;
};
