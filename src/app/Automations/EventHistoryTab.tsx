import * as React from 'react';
import {
  Alert,
  Button,
  DatePicker,
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
import { listEvents, listRules } from '@app/api/automations';
import type { EventKind, EventRecord } from '@app/api/automations';
import { useLoad } from '@app/admin/useLoad';
import { dayEnd, dayStart, isValidDay } from '@app/HistoryImports/importForm';
import { shortTime } from '@app/Crm/segments/segmentModel';
import { useSession } from '@app/session/SessionContext';
import { whoText } from '@app/Automations/AutomationRunsPage';
import { HistoryPager } from '@app/Automations/HistoryPager';
import { RunSteps } from '@app/Automations/RunSteps';
import { EVENTS } from '@app/Automations/automationModel';
import { eventLabel, outcomeColor, outcomeLabel, runStatusLabel } from '@app/Automations/automationDisplay';

type Contact = NonNullable<EventRecord['contact']>;

/** The events the brand's rules saw, with the rules that matched each. */
export const EventHistoryTab: React.FunctionComponent = () => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [kind, setKind] = React.useState('');
  const [ruleId, setRuleId] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [contact, setContact] = React.useState<Contact | null>(null);
  const [page, setPage] = React.useState(0);
  const [open, setOpen] = React.useState<string[]>([]);
  const rules = useLoad((tk) => listRules(tk, ws), [ws]);
  const fromIso = isValidDay(from) ? dayStart(from) : undefined;
  const toIso = isValidDay(to) ? dayEnd(to) : undefined;
  const events = useLoad(
    (tk) =>
      listEvents(tk, ws, {
        kind: (kind || undefined) as EventKind | undefined,
        ruleId: ruleId || undefined,
        contactId: contact?.id,
        from: fromIso,
        to: toIso,
        page,
      }),
    [ws, kind, ruleId, contact?.id, fromIso, toIso, page],
  );
  const filter = (apply: () => void) => {
    apply();
    setPage(0);
  };
  const toggle = (id: string) => setOpen((o) => (o.indexOf(id) >= 0 ? o.filter((x) => x !== id) : [...o, id]));

  let body: React.ReactNode;
  if (events.error) body = <Alert variant="danger" isInline title={events.error} />;
  else if (!events.data) body = <Spinner aria-label="Loading events" />;
  else if (events.data.items.length === 0 && page === 0)
    body = <EmptyState headingLevel="h2" titleText="No events match." />;
  else
    body = (
      <>
        <Table aria-label="Events" variant="compact">
          <Thead>
            <Tr>
              <Th screenReaderText="Expand" />
              <Th>When</Th>
              <Th>Event</Th>
              <Th>Who</Th>
              <Th>Rules</Th>
              <Th>Outcome</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          {events.data.items.map((e, i) => {
            const expanded = open.indexOf(e.id) >= 0;
            return (
              <Tbody key={e.id} isExpanded={expanded}>
                <Tr>
                  <Td expand={{ rowIndex: i, isExpanded: expanded, onToggle: () => toggle(e.id) }} />
                  <Td dataLabel="When">{shortTime(e.createdAt)}</Td>
                  <Td dataLabel="Event">
                    {e.summary}
                    {e.test && (
                      <Label isCompact className="pf-v6-u-ml-sm">
                        Test
                      </Label>
                    )}
                  </Td>
                  <Td dataLabel="Who">{whoText(e)}</Td>
                  <Td dataLabel="Rules">
                    {e.runs.length === 0
                      ? 'No rule matched.'
                      : e.runs.map((r) => (
                          <div key={r.id}>
                            {r.ruleName} · {runStatusLabel(r.status)}
                          </div>
                        ))}
                  </Td>
                  <Td dataLabel="Outcome">
                    <Label isCompact color={outcomeColor(e.outcome)}>
                      {outcomeLabel(e.outcome)}
                    </Label>
                    {e.outcome === 'FAILED' && e.error && <div>{e.error}</div>}
                  </Td>
                  <Td isActionCell>
                    {e.contact && (
                      <Button variant="link" isInline onClick={() => filter(() => setContact(e.contact))}>
                        Only this contact
                      </Button>
                    )}
                  </Td>
                </Tr>
                <Tr isExpanded={expanded}>
                  <Td colSpan={7}>
                    {expanded &&
                      e.runs.map((r) => (
                        <div key={r.id}>
                          <strong>{r.ruleName}</strong>
                          <RunSteps steps={r.steps} />
                        </div>
                      ))}
                  </Td>
                </Tr>
              </Tbody>
            );
          })}
        </Table>
        <HistoryPager page={page} total={events.data.total} onPage={setPage} />
      </>
    );

  return (
    <div className="pf-v6-u-pt-md">
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <FormSelect aria-label="Event kind" value={kind} onChange={(_e, v) => filter(() => setKind(v))}>
              <FormSelectOption value="" label="All events" />
              {EVENTS.map((ev) => (
                <FormSelectOption key={ev.kind} value={ev.kind} label={eventLabel(ev.kind)} />
              ))}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem>
            <FormSelect aria-label="Rule" value={ruleId} onChange={(_e, v) => filter(() => setRuleId(v))}>
              <FormSelectOption value="" label="All rules" />
              {(rules.data ?? []).map((r) => (
                <FormSelectOption key={r.id} value={r.id} label={r.name} />
              ))}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem>
            <DatePicker
              aria-label="From"
              placeholder="yyyy-mm-dd"
              value={from}
              onChange={(_e, v) => filter(() => setFrom(v))}
            />
          </ToolbarItem>
          <ToolbarItem>
            <DatePicker
              aria-label="To"
              placeholder="yyyy-mm-dd"
              value={to}
              onChange={(_e, v) => filter(() => setTo(v))}
            />
          </ToolbarItem>
          {contact && (
            <ToolbarItem>
              <Label onClose={() => filter(() => setContact(null))} closeBtnAriaLabel="Remove contact filter">
                {contact.name || (contact.phone ? `+${contact.phone}` : 'Contact')}
              </Label>
            </ToolbarItem>
          )}
        </ToolbarContent>
      </Toolbar>
      {body}
    </div>
  );
};
