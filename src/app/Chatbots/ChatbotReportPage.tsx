import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  DatePicker,
  EmptyState,
  FormSelect,
  FormSelectOption,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { ChatbotReport, ReportProgress, ReportRunsQuery, ReportStep, RunStatus } from '@app/api/chatbots';
import { getChatbotOptions, getChatbotReport, listChatbots } from '@app/api/chatbots';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import {
  fieldsSummary,
  localDayRange,
  progressParts,
  rangeTooLong,
  runStatusLabel,
  validDay,
} from '@app/Chatbots/chatbotDisplay';
import { ReportRunsDrawer } from '@app/Chatbots/ReportRunsDrawer';
import { useSession } from '@app/session/SessionContext';

/** A local date as `YYYY-MM-DD`. */
const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today and the 29 days before it: the last 30 days. */
const defaultDays = (): { from: string; to: string } => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  return { from: isoDay(start), to: isoDay(today) };
};

/** What one count opens: the query for the runs behind it and the drawer's title. */
export interface RunsLink {
  query: ReportRunsQuery;
  title: string;
}

/** A count that opens the runs behind it when it is not zero. */
const Count: React.FunctionComponent<{
  text: string;
  value: number;
  link: RunsLink | null;
  onOpen(l: RunsLink): void;
  /** The button's name when the text alone ("120") does not say what is counted. */
  label?: string;
}> = ({ text, value, link, onOpen, label }) =>
  link && value > 0 ? (
    <Button variant="link" isInline aria-label={label} onClick={() => onOpen(link)}>
      {text}
    </Button>
  ) : (
    <span>{text}</span>
  );

const joined = (items: React.ReactNode[]) =>
  items.map((item, i) => (
    <React.Fragment key={i}>
      {i > 0 && ' · '}
      {item}
    </React.Fragment>
  ));

const endedTotal = (s: ReportStep) => Object.values(s.endedHere).reduce((a, n) => a + (n ?? 0), 0);

const endedTooltip = (s: ReportStep) =>
  Object.entries(s.endedHere)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([status, n]) => `${runStatusLabel(status as RunStatus)} ${n}`)
    .join(' · ');

/** Chatbots → Report (spec 2026-11-20 §6.5): where a chatbot's customers stop, every count opening its runs. */
export const ChatbotReportPage: React.FunctionComponent = () => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [params, setParams] = useSearchParams();
  const defaults = React.useMemo(defaultDays, []);
  const chatbots = useLoad((tk) => listChatbots(tk, ws), [ws]);
  const options = useLoad((tk) => getChatbotOptions(tk, ws), [ws]);
  const chatbotId = params.get('chatbot') || chatbots.data?.[0]?.id || '';
  const from = validDay(params.get('from') ?? '') ? (params.get('from') as string) : defaults.from;
  const to = validDay(params.get('to') ?? '') ? (params.get('to') as string) : defaults.to;
  // what is typed in each date box; the link follows only once it is a real day, so a half-typed date stays put
  const [fromText, setFromText] = React.useState(from);
  const [toText, setToText] = React.useState(to);
  const number = params.get('number') ?? '';
  const tooLong = rangeTooLong(from, to);
  const range = localDayRange(from, to);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [runs, setRuns] = React.useState<RunsLink | null>(null);

  const report = useLoad<ChatbotReport | null>(
    (tk) =>
      !chatbotId || tooLong
        ? Promise.resolve(null)
        : getChatbotReport(tk, ws, chatbotId, { ...range, phoneNumberId: number || undefined }),
    [ws, chatbotId, from, to, number, tooLong],
  );

  const set = (key: string, value: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const base: ReportRunsQuery = { ...range, phoneNumberId: number || undefined };
  const open = (l: RunsLink) => setRuns({ title: l.title, query: { ...base, ...l.query } });
  const progressOf = (nodeId: string): ReportProgress | undefined =>
    report.data?.progress.find((p) => p.nodeId === nodeId);

  const toggle = (nodeId: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });

  const stepRows = (s: ReportStep) => {
    const name = s.name ?? s.nodeId;
    const progress = progressOf(s.nodeId);
    const isOpen = expanded.has(s.nodeId);
    const ended = endedTotal(s);
    const rows = [
      <Tr key={s.nodeId}>
        <Td dataLabel="Step">
          {progress ? (
            <Button variant="link" isInline aria-expanded={isOpen} onClick={() => toggle(s.nodeId)}>
              {name}
            </Button>
          ) : (
            name
          )}
        </Td>
        <Td dataLabel="Reached">
          <Count
            text={String(s.reached)}
            value={s.reached}
            label={`Reached ${name}: ${s.reached} runs`}
            link={{ query: { nodeId: s.nodeId, reached: true }, title: `Reached ${name}` }}
            onOpen={open}
          />
        </Td>
        <Td dataLabel="Ended here">
          {ended > 0 ? (
            <Tooltip content={endedTooltip(s)}>
              <Count
                text={String(ended)}
                value={ended}
                label={`Ended at ${name}: ${ended} runs`}
                link={{ query: { nodeId: s.nodeId }, title: `Ended at ${name}` }}
                onOpen={open}
              />
            </Tooltip>
          ) : (
            '0'
          )}
        </Td>
      </Tr>,
    ];
    if (progress && isOpen) {
      rows.push(
        <Tr key={`${s.nodeId}-progress`}>
          <Td colSpan={3}>
            <div>
              {joined(
                progressParts(progress.byCount).map((p) => (
                  <Count
                    key={p.count}
                    text={p.text}
                    value={p.runs}
                    label={`${name}: ${p.text} runs`}
                    link={{ query: { nodeId: s.nodeId, given: p.count }, title: `${name}: ${p.text}` }}
                    onOpen={open}
                  />
                )),
              )}
            </div>
            <div className="pf-v6-u-color-200">{fieldsSummary(progress.fields)}</div>
          </Td>
        </Tr>,
      );
    }
    return rows;
  };

  let body: React.ReactNode;
  if (tooLong) body = <Alert variant="warning" isInline title="Choose at most 92 days" />;
  else if (chatbots.data && chatbots.data.length === 0)
    body = <EmptyState headingLevel="h2" titleText="No chatbots yet" />;
  else if (report.error) body = <Alert variant="danger" isInline title={report.error} />;
  else if (!report.data) body = <Spinner aria-label="Loading report" />;
  else if (report.data.totals.started === 0) body = <EmptyState headingLevel="h2" titleText="No runs in this period" />;
  else {
    const t = report.data.totals;
    const live = report.data.steps.filter((s) => !s.removed);
    const removed = report.data.steps.filter((s) => s.removed);
    const status = (s: RunStatus, label: string, n: number) => (
      <Count key={label} text={`${label} ${n}`} value={n} link={{ query: { status: s }, title: label }} onOpen={open} />
    );
    const chat = (c: ReportRunsQuery['chat'], label: string, n: number) => (
      <Count key={label} text={`${label} ${n}`} value={n} link={{ query: { chat: c }, title: label }} onOpen={open} />
    );
    body = (
      <>
        <section aria-label="Totals" className="pf-v6-u-mb-md">
          <p>
            {joined([
              <Count
                key="started"
                text={`Started ${t.started}`}
                value={t.started}
                link={{ query: {}, title: 'Started' }}
                onOpen={open}
              />,
              status('COMPLETED', 'Finished', t.completed),
              status('ENDED', 'Went silent', t.wentSilent),
              status('HANDED_OVER', 'Handed over', t.handedOver),
              status('STOPPED', 'Stopped', t.stopped),
              status('FAILED', 'Failed', t.failed),
              <Count
                key="running"
                text={`Running ${t.running}`}
                value={t.running}
                link={{ query: { active: true }, title: 'Running' }}
                onOpen={open}
              />,
            ])}
          </p>
          <p>
            {joined([
              chat('TO_AGENT', 'To an agent', t.chat.toAgent),
              chat('TO_QUEUE', 'Waiting in a queue', t.chat.toQueue),
              chat('CLOSED', 'Closed by the chatbot', t.chat.closed),
              chat('LEFT', 'Taken by someone else', t.chat.left),
              ...(t.chat.notRecorded > 0
                ? [chat('NOT_RECORDED', 'Not recorded (earlier runs)', t.chat.notRecorded)]
                : []),
            ])}
          </p>
        </section>
        <Table aria-label="Steps" variant="compact">
          <Thead>
            <Tr>
              <Th>Step</Th>
              <Th>Reached</Th>
              <Th>Ended here</Th>
            </Tr>
          </Thead>
          <Tbody>
            {live.flatMap(stepRows)}
            {removed.length > 0 && (
              <Tr key="removed-heading">
                <Td colSpan={3}>
                  <strong>Removed steps</strong>
                </Td>
              </Tr>
            )}
            {removed.flatMap(stepRows)}
          </Tbody>
        </Table>
      </>
    );
  }

  return (
    <PageShell title="Chatbot report">
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <FormSelect aria-label="Chatbot" value={chatbotId} onChange={(_e, v) => set('chatbot', v)}>
              {(chatbots.data ?? []).map((c) => (
                <FormSelectOption key={c.id} value={c.id} label={c.name} />
              ))}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem>
            <DatePicker
              aria-label="From"
              placeholder="From"
              value={fromText}
              onChange={(_e, v) => {
                setFromText(v);
                if (validDay(v)) set('from', v);
              }}
            />
          </ToolbarItem>
          <ToolbarItem>
            <DatePicker
              aria-label="To"
              placeholder="To"
              value={toText}
              onChange={(_e, v) => {
                setToText(v);
                if (validDay(v)) set('to', v);
              }}
            />
          </ToolbarItem>
          <ToolbarItem>
            <FormSelect aria-label="Number" value={number} onChange={(_e, v) => set('number', v)}>
              <FormSelectOption value="" label="All numbers" />
              {(options.data?.numbers ?? []).map((n) => (
                <FormSelectOption key={n.id} value={n.id} label={n.label ?? `+${n.number}`} />
              ))}
            </FormSelect>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {body}
      {runs && (
        <ReportRunsDrawer chatbotId={chatbotId} query={runs.query} title={runs.title} onClose={() => setRuns(null)} />
      )}
    </PageShell>
  );
};
