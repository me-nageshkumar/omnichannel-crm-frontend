import * as React from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  EmptyState,
  FormSelect,
  FormSelectOption,
  Pagination,
  SearchInput,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { SyncAltIcon } from '@patternfly/react-icons';
import { getSettings, listPipelines, searchContacts } from '@app/api/crm';
import type { Ref } from '@app/api/crm';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { ChannelChip } from '@app/Crm/common/ChannelChip';
import { formatMoney } from '@app/Crm/common/money';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
import { CrmContactDrawer } from '@app/Crm/Contacts/CrmContactDrawer';
import { CONTACT_COLUMNS, CONTACT_PAGE_SIZE, contactName } from '@app/Crm/Contacts/contactColumns';
import { useFieldDefinitions } from '@app/Crm/fields/useFieldDefinitions';
import { ExportButton } from '@app/Crm/csv/ExportButton';
import { ContactImportModal } from '@app/Crm/csv/ContactImportModal';
import { fieldColumns } from '@app/Crm/common/fields/fieldColumns';
import type { ContactSort } from '@app/Crm/Contacts/contactColumns';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';

export const EMPTY_TEXT = 'No CRM contacts yet. Capture one from the inbox or add one from Pipelines.';

/** The brand's CRM contacts: search, lifecycle, owner and pipeline filters, and the drawer of the open contact. */
export const CrmContactsPage: React.FunctionComponent = () => {
  const { workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const { status } = useCrmStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();

  const settings = useLoad((tk) => getSettings(tk, ws), [ws], { keepOnError: true });
  const pipelines = useLoad((tk) => listPipelines(tk, ws), [ws], { keepOnError: true });
  const access = status?.pipelineAccess ?? [];
  const accessible = (pipelines.data ?? []).filter((p) => p.active && (access === 'ALL' || access.includes(p.id)));
  const phones = status?.phones ?? [];
  const lifecycles = (settings.data?.lifecycleStatuses ?? [])
    .filter((l) => l.active)
    .sort((a, b) => a.position - b.position);

  const lifecycle = params.get('lifecycle') ?? '';
  const ownerId = params.get('owner') ?? '';
  const pipelineId = params.get('pipelineId') ?? '';
  const qParam = params.get('q') ?? '';
  const [search, setSearch] = React.useState(qParam);
  const [sort, setSort] = React.useState<ContactSort>({ field: 'lastActivityAt', dir: 'desc' });
  const [page, setPage] = React.useState(0);
  const [seenOwners, setSeenOwners] = React.useState<Ref[]>([]);

  const update = (change: (next: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        change(next);
        return next;
      },
      { replace: true },
    );
  const setOrDelete = (next: URLSearchParams, name: string, value: string) =>
    value ? next.set(name, value) : next.delete(name);
  const filter = (name: string, value: string) => {
    update((n) => setOrDelete(n, name, value));
    setPage(0);
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() === qParam) return;
      update((n) => setOrDelete(n, 'q', search.trim()));
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const canExport = useCrmCan('crm:export');
  const canImport = useCrmCan('crm:edit');
  const [importing, setImporting] = React.useState(false);
  const exportSearch = {
    q: qParam || undefined,
    ownerId: ownerId || undefined,
    lifecycleStatus: lifecycle || undefined,
    pipelineId: pipelineId || undefined,
    sort: `${sort.field},${sort.dir}`,
  };
  const list = useLoad(
    (tk) =>
      searchContacts(tk, ws, {
        q: qParam || undefined,
        ownerId: ownerId || undefined,
        lifecycleStatus: lifecycle || undefined,
        pipelineId: pipelineId || undefined,
        sort: `${sort.field},${sort.dir}`,
        page,
        size: CONTACT_PAGE_SIZE,
      }),
    [ws, qParam, ownerId, lifecycle, pipelineId, sort.field, sort.dir, page],
  );
  useRefetchOnFocus(() => list.reload());
  const contactFields = useFieldDefinitions('CONTACT');

  React.useEffect(() => {
    const owners = (list.data?.items ?? []).flatMap((c) => (c.owner ? [c.owner] : []));
    setSeenOwners((cur) => {
      const fresh = owners.filter(
        (o, i) => !cur.some((x) => x.id === o.id) && owners.findIndex((x) => x.id === o.id) === i,
      );
      return fresh.length > 0 ? [...cur, ...fresh] : cur;
    });
  }, [list.data]);
  const ownerChoices = seenOwners.filter((o) => o.id !== user?.id);

  const showChannel = phones.length > 1;
  const columns = CONTACT_COLUMNS.filter((c) => !c.multiNumberOnly || showChannel);
  const extraColumns = fieldColumns(contactFields.defs);
  const activeIndex = columns.findIndex((c) => c.field === sort.field);
  const filtering = !!qParam || !!ownerId || !!lifecycle || !!pipelineId;
  const lifecycleLabel = (key: string | null) =>
    key ? (settings.data?.lifecycleStatuses.find((l) => l.key === key)?.label ?? key) : '—';
  const currency = settings.data?.defaultCurrency;

  let body: React.ReactNode;
  if (list.error) body = <Alert variant="danger" isInline title={list.error} />;
  else if (!list.data) body = <Spinner aria-label="Loading contacts" />;
  else if (list.data.items.length === 0 && !filtering) body = <EmptyState headingLevel="h2" titleText={EMPTY_TEXT} />;
  else
    body = (
      <>
        <Table aria-label="CRM contacts" variant="compact">
          <Thead>
            <Tr>
              {columns.map((c, i) => (
                <Th
                  key={c.label}
                  sort={
                    c.field
                      ? {
                          columnIndex: i,
                          sortBy: { index: activeIndex, direction: sort.dir },
                          onSort: (_e, _i, direction) => {
                            setSort({ field: c.field as ContactSort['field'], dir: direction });
                            setPage(0);
                          },
                        }
                      : undefined
                  }
                >
                  {c.label}
                </Th>
              ))}
              {extraColumns.map((c) => (
                <Th key={`cf-${c.key}`}>{c.title}</Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {list.data.items.length === 0 ? (
              <Tr>
                <Td colSpan={columns.length + extraColumns.length}>No contacts match.</Td>
              </Tr>
            ) : (
              list.data.items.map((c) => (
                <Tr
                  key={c.id}
                  isClickable
                  onRowClick={() => navigate({ pathname: `/crm/contacts/${c.id}`, search: location.search })}
                >
                  <Td dataLabel="Name">
                    <Link
                      to={{ pathname: `/crm/contacts/${c.id}`, search: location.search }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contactName(c)}
                    </Link>
                  </Td>
                  <Td dataLabel="WhatsApp number">{c.phone ?? '—'}</Td>
                  {showChannel && (
                    <Td dataLabel="Channel">
                      {c.channel ? (
                        <ChannelChip
                          number={c.channel.number}
                          label={phones.find((p) => p.phoneNumberId === c.channel?.phoneNumberId)?.label}
                        />
                      ) : (
                        '—'
                      )}
                    </Td>
                  )}
                  <Td dataLabel="Lifecycle">{lifecycleLabel(c.lifecycleStatus)}</Td>
                  <Td dataLabel="Company">{c.company?.name ?? '—'}</Td>
                  <Td dataLabel="Owner">{c.owner?.name ?? '—'}</Td>
                  <Td dataLabel="Open deals">
                    {c.openDealCount === 0
                      ? '0'
                      : `${c.openDealCount} · ${formatMoney(c.openDealAmount, null, currency) || '—'}`}
                  </Td>
                  <Td dataLabel="Last activity">{c.lastActivityAt ? relative(c.lastActivityAt) : '—'}</Td>
                  {extraColumns.map((col) => (
                    <Td key={`cf-${col.key}`} dataLabel={col.title}>
                      {col.render(c)}
                    </Td>
                  ))}
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
        <Pagination
          itemCount={list.data.total}
          perPage={CONTACT_PAGE_SIZE}
          perPageOptions={[{ title: String(CONTACT_PAGE_SIZE), value: CONTACT_PAGE_SIZE }]}
          page={page + 1}
          onSetPage={(_e, p) => setPage(p - 1)}
          isCompact
        />
      </>
    );

  return (
    <CrmContactDrawer
      contactId={id}
      settings={settings.data}
      owners={ownerChoices}
      onChanged={() => list.reload()}
      onClose={() => navigate({ pathname: '/crm/contacts', search: location.search })}
    >
      <PageShell
        title="Contacts"
        actions={
          <>
            {canExport && <ExportButton entity="contacts" search={exportSearch} />}
            {canImport && (
              <Button variant="secondary" onClick={() => setImporting(true)}>
                Import CSV
              </Button>
            )}
            <Button variant="plain" aria-label="Refresh" icon={<SyncAltIcon />} onClick={() => list.reload()} />
          </>
        }
      >
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput
                aria-label="Search contacts"
                placeholder="Search contacts"
                value={search}
                onChange={(_e, v) => setSearch(v)}
                onClear={() => setSearch('')}
              />
            </ToolbarItem>
            <ToolbarItem>
              <FormSelect aria-label="Lifecycle" value={lifecycle} onChange={(_e, v) => filter('lifecycle', v)}>
                <FormSelectOption value="" label="Any lifecycle" />
                {lifecycles.map((l) => (
                  <FormSelectOption key={l.key} value={l.key} label={l.label} />
                ))}
              </FormSelect>
            </ToolbarItem>
            <ToolbarItem>
              <FormSelect aria-label="Owner" value={ownerId} onChange={(_e, v) => filter('owner', v)}>
                <FormSelectOption value="" label="Anyone" />
                {user && <FormSelectOption value={user.id} label="Me" />}
                {ownerChoices.map((o) => (
                  <FormSelectOption key={o.id} value={o.id} label={o.name} />
                ))}
              </FormSelect>
            </ToolbarItem>
            {accessible.length > 0 && (
              <ToolbarItem>
                <FormSelect aria-label="Pipeline" value={pipelineId} onChange={(_e, v) => filter('pipelineId', v)}>
                  <FormSelectOption value="" label="Any pipeline" />
                  {accessible.map((p) => (
                    <FormSelectOption key={p.id} value={p.id} label={p.name} />
                  ))}
                </FormSelect>
              </ToolbarItem>
            )}
          </ToolbarContent>
        </Toolbar>
        {body}
        {importing && (
          <ContactImportModal
            onClose={(imported) => {
              setImporting(false);
              if (imported) list.reload();
            }}
          />
        )}
      </PageShell>
    </CrmContactDrawer>
  );
};
