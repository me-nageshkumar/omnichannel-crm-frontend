import * as React from 'react';
import {
  Alert,
  Content,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Label,
  Progress,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { HistoryImportStatus, HistoryImportView, isFetching } from '@app/api/historyImports';
import { listInboxNumbers } from '@app/api/inbox';
import { messageFor } from '@app/api/messages';
import { shown } from '@app/api/phoneNumbers';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { HistoryImportChats } from '@app/HistoryImports/HistoryImportChats';
import { HistoryImportControls } from '@app/HistoryImports/HistoryImportControls';
import {
  HISTORY_STATUSES,
  countsText,
  importErrorText,
  rangeText,
  scopeText,
  statusColor,
  statusLabel,
  waitingText,
} from '@app/HistoryImports/historyImportDisplay';
import { useHistoryImports } from '@app/HistoryImports/useHistoryImports';

const COLUMNS = 9;

const ProgressCell: React.FunctionComponent<{ v: HistoryImportView }> = ({ v }) => {
  if (v.progressPercent !== null) {
    return (
      <Progress
        size="sm"
        measureLocation="outside"
        value={v.progressPercent}
        aria-label={`Progress of the import for ${shown(v.phoneNumber.number)}`}
      />
    );
  }
  return <>{isFetching(v.status) ? 'Listing chats…' : '—'}</>;
};

/** The brand's chat history imports, with their progress, their chats and a way to pause, play or stop them. */
export const HistoryImportsPage: React.FunctionComponent = () => {
  const { workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [phoneNumberId, setPhoneNumberId] = React.useState('');
  const [status, setStatus] = React.useState<HistoryImportStatus | ''>('');
  const numbers = useLoad((tk) => listInboxNumbers(tk, ws), [ws]);
  const imports = useHistoryImports({ phoneNumberId: phoneNumberId || undefined, status: status || undefined });
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(new Set());
  // Rows expanded at least once keep their chats mounted, so the chats load only on the first expand.
  const [opened, setOpened] = React.useState<ReadonlySet<string>>(new Set());
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
    setOpened((s) => (s.has(id) ? s : new Set(s).add(id)));
  };

  const run = async (id: string, action: (id: string) => Promise<void>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await action(id);
    } catch (e) {
      setActionError(messageFor(e));
    } finally {
      setBusyId(null);
    }
  };

  const items = imports.page?.items ?? [];

  return (
    <PageShell title="History imports">
      {imports.error && <Alert variant="danger" isInline title={imports.error} />}
      {actionError && <Alert variant="danger" isInline title={actionError} />}
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <FormSelect aria-label="Number" value={phoneNumberId} onChange={(_e, value) => setPhoneNumberId(value)}>
              <FormSelectOption value="" label="All numbers" />
              {(numbers.data ?? []).map((n) => (
                <FormSelectOption
                  key={n.id}
                  value={n.id}
                  label={n.label ? `${n.label} (${shown(n.number)})` : shown(n.number)}
                />
              ))}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem>
            <FormSelect
              aria-label="Status"
              value={status}
              onChange={(_e, value) => setStatus(value as HistoryImportStatus | '')}
            >
              <FormSelectOption value="" label="All statuses" />
              {HISTORY_STATUSES.map((s) => (
                <FormSelectOption key={s} value={s} label={statusLabel(s)} />
              ))}
            </FormSelect>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {!imports.page && !imports.error ? (
        <Spinner aria-label="Loading history imports" />
      ) : (
        <Table aria-label="History imports" variant="compact">
          <Thead>
            <Tr>
              <Th screenReaderText="Details" />
              <Th>Number</Th>
              <Th>Scope</Th>
              <Th>Range</Th>
              <Th>Status</Th>
              <Th>Progress</Th>
              <Th>Messages</Th>
              <Th>Started</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          {items.length === 0 ? (
            <Tbody>
              <Tr>
                <Td colSpan={COLUMNS}>No history imports yet.</Td>
              </Tr>
            </Tbody>
          ) : (
            items.map((v, rowIndex) => {
              const isExpanded = expanded.has(v.id);
              const note =
                v.status === 'FAILED' && v.error
                  ? importErrorText(v.error)
                  : isFetching(v.status)
                    ? waitingText(v.waiting)
                    : null;
              const c = v.counts;
              return (
                <Tbody key={v.id} isExpanded={isExpanded}>
                  <Tr>
                    <Td expand={{ rowIndex, isExpanded, onToggle: () => toggle(v.id) }} />
                    <Td dataLabel="Number">
                      {shown(v.phoneNumber.number)}
                      {v.phoneNumber.label && (
                        <Content component="small" style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>
                          {v.phoneNumber.label}
                        </Content>
                      )}
                    </Td>
                    <Td dataLabel="Scope">{scopeText(v)}</Td>
                    <Td dataLabel="Range">{rangeText(v)}</Td>
                    <Td dataLabel="Status">
                      <Label color={statusColor(v.status)}>{statusLabel(v.status)}</Label>
                      {note && (
                        <HelperText>
                          <HelperTextItem>{note}</HelperTextItem>
                        </HelperText>
                      )}
                    </Td>
                    <Td dataLabel="Progress">
                      <ProgressCell v={v} />
                    </Td>
                    <Td dataLabel="Messages">{countsText(v.counts)}</Td>
                    <Td dataLabel="Started">{relative(v.creationTime)}</Td>
                    <Td isActionCell>
                      <HistoryImportControls
                        status={v.status}
                        busy={busyId === v.id}
                        subject={shown(v.phoneNumber.number)}
                        onPause={() => void run(v.id, imports.pause)}
                        onPlay={() => void run(v.id, imports.resume)}
                        onStop={() => void run(v.id, imports.cancel)}
                      />
                    </Td>
                  </Tr>
                  <Tr isExpanded={isExpanded}>
                    <Td colSpan={COLUMNS}>
                      <ExpandableRowContent>
                        {opened.has(v.id) && (
                          <HistoryImportChats id={v.id} version={c.chatsDone + c.chatsSkipped + c.chatsFailed} />
                        )}
                      </ExpandableRowContent>
                    </Td>
                  </Tr>
                </Tbody>
              );
            })
          )}
        </Table>
      )}
    </PageShell>
  );
};
