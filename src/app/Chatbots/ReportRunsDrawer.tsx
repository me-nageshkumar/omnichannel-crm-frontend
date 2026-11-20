import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Label, Modal, ModalBody, ModalHeader, Spinner } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { ReportRunRow, ReportRunsQuery } from '@app/api/chatbots';
import { listReportRuns } from '@app/api/chatbots';
import { useLoad } from '@app/admin/useLoad';
import { HistoryPager } from '@app/Automations/HistoryPager';
import { runStatusColor, runStatusLabel } from '@app/Chatbots/chatbotDisplay';
import { shortTime } from '@app/Crm/segments/segmentModel';
import { useSession } from '@app/session/SessionContext';

const PAGE_SIZE = 25;

/** "· Asha", "· waiting in Counsellors", "· closed", "· taken by someone else": where the run's chat went. */
export function rowEndingText(r: ReportRunRow): string {
  if (!r.ending) return '';
  switch (r.ending.chat) {
    case 'HANDED_OVER':
    case 'ROUTED':
      if (r.agentName) return ` · ${r.agentName}`;
      return r.teamName ? ` · waiting in ${r.teamName}` : ' · waiting in a queue';
    case 'CLOSED':
      return ' · closed';
    case 'LEFT':
      return ' · taken by someone else';
    default:
      return '';
  }
}

const collected = (p: Record<string, unknown> | null): string =>
  p
    ? Object.keys(p)
        .filter((k) => p[k] !== null && p[k] !== undefined && p[k] !== '')
        .join(', ')
    : '';

/** The runs behind one report number (spec 2026-11-20 §6.5), 25 a page, each with its chat, lead and run. */
export const ReportRunsDrawer: React.FunctionComponent<{
  chatbotId: string;
  query: ReportRunsQuery;
  title: string;
  onClose(): void;
}> = ({ chatbotId, query, title, onClose }) => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [page, setPage] = React.useState(0);
  const runs = useLoad(
    (tk) => listReportRuns(tk, ws, chatbotId, { ...query, page, size: PAGE_SIZE }),
    [ws, chatbotId, query, page],
  );

  let body: React.ReactNode;
  if (runs.error) body = <Alert variant="danger" isInline title={runs.error} />;
  else if (!runs.data) body = <Spinner aria-label="Loading runs" />;
  else if (runs.data.items.length === 0) body = <p className="pf-v6-u-color-200">No runs.</p>;
  else
    body = (
      <>
        <Table aria-label="Runs behind the number" variant="compact">
          <Thead>
            <Tr>
              <Th>Contact</Th>
              <Th>Number</Th>
              <Th>Started</Th>
              <Th>Ended</Th>
              <Th>How it ended</Th>
              <Th>Collected</Th>
              <Th>Lead owner</Th>
              <Th screenReaderText="Links" />
            </Tr>
          </Thead>
          <Tbody>
            {runs.data.items.map((r) => (
              <Tr key={r.runId}>
                <Td dataLabel="Contact">
                  {r.contactName || '—'}
                  {r.phone && <div className="pf-v6-u-color-200">+{r.phone}</div>}
                </Td>
                <Td dataLabel="Number">{r.numberLabel ?? '—'}</Td>
                <Td dataLabel="Started">{shortTime(r.startedAt)}</Td>
                <Td dataLabel="Ended">{r.finishedAt ? shortTime(r.finishedAt) : '—'}</Td>
                <Td dataLabel="How it ended">
                  <Label isCompact color={runStatusColor(r.status)}>
                    {runStatusLabel(r.status)}
                  </Label>
                  {rowEndingText(r)}
                </Td>
                <Td dataLabel="Collected">{collected(r.progress)}</Td>
                <Td dataLabel="Lead owner">
                  {r.dealId && (r.leadOwnerName ?? <span className="pf-v6-u-warning-color-100">No owner</span>)}
                </Td>
                <Td dataLabel="Links">
                  {r.chatId && <Link to={`/inbox/chats/${encodeURIComponent(r.chatId)}`}>Chat</Link>}
                  {r.dealId && (
                    <>
                      {' · '}
                      <Link
                        to={`/crm/deals/${encodeURIComponent(r.dealId)}${
                          r.dealPipelineId ? `?pipelineId=${encodeURIComponent(r.dealPipelineId)}` : ''
                        }`}
                      >
                        Lead
                      </Link>
                    </>
                  )}
                  {' · '}
                  <Link to={`/chatbots/${encodeURIComponent(chatbotId)}?run=${encodeURIComponent(r.runId)}`}>Run</Link>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        <HistoryPager page={page} total={runs.data.total} pageSize={PAGE_SIZE} onPage={setPage} />
      </>
    );

  return (
    <Modal isOpen variant="large" onClose={onClose} aria-labelledby="report-runs-title">
      <ModalHeader title={title} labelId="report-runs-title" />
      <ModalBody>{body}</ModalBody>
    </Modal>
  );
};
