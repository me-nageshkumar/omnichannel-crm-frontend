import * as React from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  DatePicker,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelContent,
  EmptyState,
  FormSelect,
  FormSelectOption,
  Label,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { Button } from '@patternfly/react-core';
import type { Run, RunStatus } from '@app/api/chatbots';
import { getChatbot, getRun, listRuns, stopRun } from '@app/api/chatbots';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { HistoryPager } from '@app/Automations/HistoryPager';
import { RUN_STATUSES, runStatusColor, runStatusLabel, waitingLabel } from '@app/Chatbots/chatbotDisplay';
import { RunOverlayPanel } from '@app/Chatbots/editor/RunOverlayPanel';
import { shortTime } from '@app/Crm/segments/segmentModel';
import { useSession } from '@app/session/SessionContext';

const PAGE_SIZE = 25;

export const who = (run: Run): string => run.contact?.name || (run.contact?.phone ? `+${run.contact.phone}` : '—');

/** The day typed into a date picker as the instant it starts (from) or ends (to), or undefined when blank. */
const dayStart = (v: string): string | undefined =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`).toISOString() : undefined;
const dayEnd = (v: string): string | undefined =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T23:59:59.999`).toISOString() : undefined;

/** The runs of one chatbot (spec §8.3): filtered by status and dates, each opening the run panel. */
export const ChatbotRunsPage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [status, setStatus] = React.useState<RunStatus | ''>('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [open, setOpen] = React.useState<Run | null>(null);
  const [tick, setTick] = React.useState(0);
  const chatbot = useLoad((tk) => getChatbot(tk, ws, id), [ws, id]);
  const runs = useLoad(
    (tk) =>
      listRuns(tk, ws, id, {
        status: status || undefined,
        from: dayStart(from),
        to: dayEnd(to),
        page,
        size: PAGE_SIZE,
      }),
    [ws, id, status, from, to, page, tick],
  );

  const stop = async () => {
    if (!open || !token) return;
    await stopRun(token, ws, id, open.id);
    setOpen(await getRun(token, ws, id, open.id));
    setTick((t) => t + 1);
  };

  let body: React.ReactNode;
  if (runs.error) body = <Alert variant="danger" isInline title={runs.error} />;
  else if (!runs.data) body = <Spinner aria-label="Loading runs" />;
  else if (runs.data.items.length === 0 && page === 0 && !status && !from && !to)
    body = <EmptyState headingLevel="h2" titleText="This chatbot has not run yet." />;
  else
    body = (
      <>
        <Table aria-label="Runs" variant="compact">
          <Thead>
            <Tr>
              <Th>Contact</Th>
              <Th>Number</Th>
              <Th>Status</Th>
              <Th>Started</Th>
              <Th>Ended</Th>
              <Th>Where it ended</Th>
              <Th>Started by</Th>
            </Tr>
          </Thead>
          <Tbody>
            {runs.data.items.map((r) => (
              <Tr key={r.id} isClickable isRowSelected={open?.id === r.id} onRowClick={() => setOpen(r)}>
                <Td dataLabel="Contact">
                  <Button variant="link" isInline onClick={() => setOpen(r)}>
                    {who(r)}
                  </Button>
                </Td>
                <Td dataLabel="Number">{r.number?.label ?? '—'}</Td>
                <Td dataLabel="Status">
                  <Label isCompact color={runStatusColor(r.status)}>
                    {runStatusLabel(r.status)}
                  </Label>
                  {r.status === 'WAITING' && r.waiting && (
                    <span className="pf-v6-u-ml-xs"> {waitingLabel(r.waiting)}</span>
                  )}
                  {r.test && (
                    <Label isCompact className="pf-v6-u-ml-sm">
                      Test
                    </Label>
                  )}
                </Td>
                <Td dataLabel="Started">{shortTime(r.createdAt)}</Td>
                <Td dataLabel="Ended">{r.finishedAt ? shortTime(r.finishedAt) : '—'}</Td>
                <Td dataLabel="Where it ended">{r.currentNodeName ?? '—'}</Td>
                <Td dataLabel="Started by">{r.startedBy?.ruleName ?? (r.test ? 'Test' : '—')}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {runs.data.items.length === 0 && <p className="pf-v6-u-color-200 pf-v6-u-mt-md">No runs match.</p>}
        <HistoryPager page={page} total={runs.data.total} pageSize={PAGE_SIZE} onPage={setPage} />
      </>
    );

  const panel = open ? (
    <DrawerPanelContent widths={{ default: 'width_100', lg: 'width_33' }}>
      <RunOverlayPanel
        run={open}
        flow={chatbot.data?.flow ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }}
        canvasHref={`/chatbots/${id}?run=${open.id}`}
        onStop={() => void stop()}
        onClose={() => setOpen(null)}
      />
    </DrawerPanelContent>
  ) : undefined;

  return (
    <PageShell title={chatbot.data ? `${chatbot.data.name} · Runs` : 'Runs'}>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <FormSelect
              aria-label="Status"
              value={status}
              onChange={(_e, v) => {
                setStatus(v as RunStatus | '');
                setPage(0);
              }}
            >
              <FormSelectOption value="" label="All statuses" />
              {RUN_STATUSES.map((s) => (
                <FormSelectOption key={s} value={s} label={runStatusLabel(s)} />
              ))}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem>
            <DatePicker
              aria-label="From"
              placeholder="From"
              value={from}
              onChange={(_e, v) => {
                setFrom(v);
                setPage(0);
              }}
            />
          </ToolbarItem>
          <ToolbarItem>
            <DatePicker
              aria-label="To"
              placeholder="To"
              value={to}
              onChange={(_e, v) => {
                setTo(v);
                setPage(0);
              }}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      <Drawer isExpanded={panel !== undefined} isInline position="right">
        <DrawerContent panelContent={panel}>
          <DrawerContentBody>{body}</DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </PageShell>
  );
};
