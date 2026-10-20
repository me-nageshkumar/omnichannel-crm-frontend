import * as React from 'react';
import {
  Alert,
  MenuToggle,
  Pagination,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  CONNECTION_LABELS,
  PLATFORM_PAGE_SIZE,
  PhoneNumber,
  PhoneNumberStatus,
  STATUSES,
  deleteAnyNumber,
  listAllNumbers,
  setAnyNumberEnabled,
  shown,
} from '@app/api/phoneNumbers';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { PhoneNumberStatusLabel, relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';

type StatusFilter = 'ALL' | PhoneNumberStatus;

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'All',
  CONNECTED: 'Connected',
  WAITING_FOR_LOGIN: 'Waiting for WhatsApp login',
  DISCONNECTED: 'Disconnected',
  WRONG_NUMBER: 'Wrong number',
  NOT_CONNECTED_YET: 'Not connected yet',
  DISABLED: 'Disabled',
};

type Dialog = { kind: 'toggle'; number: PhoneNumber } | { kind: 'delete'; number: PhoneNumber };

/** Platform staff: every WhatsApp number on the platform, searchable, 50 per page. */
export const AllPhoneNumbersPage: React.FunctionComponent = () => {
  const { token } = useSession();
  const canManage = useAccess().has('phone-number:manage-all');
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<StatusFilter>('ALL');
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const confirm = useAction();
  const t = token as string;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const numbers = useLoad(
    (tk) => listAllNumbers(tk, { q, status: status === 'ALL' ? undefined : status, page }),
    [q, status, page],
  );

  const replace = (n: PhoneNumber) =>
    numbers.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === n.id ? n : x)) } : d));
  const removeRow = (id: string) =>
    numbers.setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== id), total: d.total - 1 } : d));

  const onToggle = async (n: PhoneNumber) => {
    const updated = await confirm.run(() => setAnyNumberEnabled(t, n.id, Boolean(n.disabled)));
    if (updated) {
      replace(updated);
      setDialog(null);
    }
  };
  const onDelete = async (n: PhoneNumber) => {
    const done = await confirm.run(async () => {
      await deleteAnyNumber(t, n.id);
      return true;
    });
    if (done) {
      removeRow(n.id);
      setDialog(null);
    }
  };
  const open = (d: Dialog) => () => {
    confirm.reset();
    setDialog(d);
  };

  return (
    <PageShell title="All phone numbers">
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              aria-label="Search phone numbers"
              placeholder="Search by number, company or brand"
              value={search}
              onChange={(_e, v) => setSearch(v)}
              onClear={() => setSearch('')}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Select
              isOpen={statusOpen}
              selected={status}
              onSelect={(_e, v) => {
                setStatus(v as StatusFilter);
                setStatusOpen(false);
                setPage(0);
              }}
              onOpenChange={setStatusOpen}
              toggle={(ref) => (
                <MenuToggle ref={ref} isExpanded={statusOpen} onClick={() => setStatusOpen(!statusOpen)}>
                  {`Status: ${STATUS_LABELS[status]}`}
                </MenuToggle>
              )}
            >
              <SelectList>
                {(['ALL', ...STATUSES] as StatusFilter[]).map((s) => (
                  <SelectOption key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ToolbarItem>
          <ToolbarItem variant="pagination">
            <Pagination
              itemCount={numbers.data?.total ?? 0}
              perPage={PLATFORM_PAGE_SIZE}
              perPageOptions={[{ title: String(PLATFORM_PAGE_SIZE), value: PLATFORM_PAGE_SIZE }]}
              page={page + 1}
              onSetPage={(_e, p) => setPage(p - 1)}
              isCompact
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {numbers.error && <Alert variant="danger" isInline title={numbers.error} />}
      {numbers.loading && !numbers.data ? (
        <Spinner aria-label="Loading phone numbers" />
      ) : (
        <Table aria-label="All phone numbers" variant="compact">
          <Thead>
            <Tr>
              <Th>Number</Th>
              <Th>Company</Th>
              <Th>Brand</Th>
              <Th>Label</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Last seen</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(numbers.data?.items ?? []).map((n) => (
              <Tr key={n.id}>
                <Td dataLabel="Number">{shown(n.number)}</Td>
                <Td dataLabel="Company">{n.customerName ?? '—'}</Td>
                <Td dataLabel="Brand">{n.workspaceName ?? '—'}</Td>
                <Td dataLabel="Label">{n.label ?? '—'}</Td>
                <Td dataLabel="Type">{CONNECTION_LABELS[n.connectionType] ?? n.connectionType}</Td>
                <Td dataLabel="Status">
                  <PhoneNumberStatusLabel number={n} />
                </Td>
                <Td dataLabel="Last seen">{n.lastSeenAt ? relative(n.lastSeenAt) : '—'}</Td>
                <Td isActionCell>
                  {canManage && (
                    <ActionsColumn
                      items={[
                        {
                          title: n.disabled ? 'Enable' : 'Disable',
                          onClick: open({ kind: 'toggle', number: n }),
                        },
                        { title: 'Delete', onClick: open({ kind: 'delete', number: n }) },
                      ]}
                    />
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {dialog?.kind === 'toggle' && (
        <ConfirmModal
          title={`${dialog.number.disabled ? 'Enable' : 'Disable'} ${shown(dialog.number.number)}?`}
          confirmLabel={dialog.number.disabled ? 'Enable' : 'Disable'}
          variant={dialog.number.disabled ? 'primary' : 'danger'}
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => onToggle(dialog.number)}
          onCancel={() => setDialog(null)}
        >
          {dialog.number.disabled
            ? 'Its browser can connect again.'
            : 'Its browser is disconnected. Only platform staff can enable it again.'}
        </ConfirmModal>
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={`Delete ${shown(dialog.number.number)}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => onDelete(dialog.number)}
          onCancel={() => setDialog(null)}
        >
          Its device is disconnected and its connect code stops working.
        </ConfirmModal>
      )}
    </PageShell>
  );
};
