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
import { getSettings, searchCompanies } from '@app/api/crm';
import { useFieldDefinitions } from '@app/Crm/fields/useFieldDefinitions';
import { fieldColumns } from '@app/Crm/common/fields/fieldColumns';
import type { Ref } from '@app/api/crm';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { formatMoney } from '@app/Crm/common/money';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { useCrmCan } from '@app/Crm/status/CrmStatusContext';
import { ExportButton } from '@app/Crm/csv/ExportButton';
import { CompanyImportModal } from '@app/Crm/csv/CompanyImportModal';
import { CompanyDrawer } from '@app/Crm/Companies/CompanyDrawer';
import { CompanyFormModal } from '@app/Crm/Companies/CompanyFormModal';

export const EMPTY_TEXT = 'No companies yet. Add one here or from a contact or deal.';
const PAGE_SIZE = 50;

type SortField = 'name' | 'creationTime' | 'lastActivityAt';
const COLUMNS: { label: string; field?: SortField }[] = [
  { label: 'Name', field: 'name' },
  { label: 'Industry' },
  { label: 'Contacts' },
  { label: 'Open deal amount' },
  { label: 'Owner' },
];

/** The brand's companies: search, industry and owner filters, and the drawer of the open company. */
export const CompaniesPage: React.FunctionComponent = () => {
  const { workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const canEdit = useCrmCan('crm:edit');
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();

  const settings = useLoad((tk) => getSettings(tk, ws), [ws], { keepOnError: true });
  const industries = (settings.data?.industries ?? []).filter((i) => i.active).sort((a, b) => a.position - b.position);

  const industry = params.get('industry') ?? '';
  const ownerId = params.get('owner') ?? '';
  const qParam = params.get('q') ?? '';
  const [search, setSearch] = React.useState(qParam);
  const [sort, setSort] = React.useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' });
  const [page, setPage] = React.useState(0);
  const [seenOwners, setSeenOwners] = React.useState<Ref[]>([]);
  const [creating, setCreating] = React.useState(false);

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
  const [importing, setImporting] = React.useState(false);
  const exportSearch = {
    q: qParam || undefined,
    ownerId: ownerId || undefined,
    industry: industry || undefined,
    sort: `${sort.field},${sort.dir}`,
  };
  const list = useLoad(
    (tk) =>
      searchCompanies(tk, ws, {
        q: qParam || undefined,
        ownerId: ownerId || undefined,
        industry: industry || undefined,
        sort: `${sort.field},${sort.dir}`,
        page,
        size: PAGE_SIZE,
      }),
    [ws, qParam, ownerId, industry, sort.field, sort.dir, page],
  );
  useRefetchOnFocus(() => list.reload());

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

  const activeIndex = COLUMNS.findIndex((c) => c.field === sort.field);
  const filtering = !!qParam || !!ownerId || !!industry;
  const industryLabel = (key: string | null) =>
    key ? (settings.data?.industries.find((i) => i.key === key)?.label ?? key) : '—';
  const currency = settings.data?.defaultCurrency;

  const extraColumns = fieldColumns(useFieldDefinitions('COMPANY').defs);
  let body: React.ReactNode;
  if (list.error) body = <Alert variant="danger" isInline title={list.error} />;
  else if (!list.data) body = <Spinner aria-label="Loading companies" />;
  else if (list.data.items.length === 0 && !filtering) body = <EmptyState headingLevel="h2" titleText={EMPTY_TEXT} />;
  else
    body = (
      <>
        <Table aria-label="Companies" variant="compact">
          <Thead>
            <Tr>
              {COLUMNS.map((c, i) => (
                <Th
                  key={c.label}
                  sort={
                    c.field
                      ? {
                          columnIndex: i,
                          sortBy: { index: activeIndex, direction: sort.dir },
                          onSort: (_e, _i, direction) => {
                            setSort({ field: c.field as SortField, dir: direction });
                            setPage(0);
                          },
                        }
                      : undefined
                  }
                >
                  {c.label}
                </Th>
              ))}
              {extraColumns.map((col) => (
                <Th key={`cf-${col.key}`}>{col.title}</Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {list.data.items.length === 0 ? (
              <Tr>
                <Td colSpan={COLUMNS.length + extraColumns.length}>No companies match.</Td>
              </Tr>
            ) : (
              list.data.items.map((c) => (
                <Tr
                  key={c.id}
                  isClickable
                  onRowClick={() => navigate({ pathname: `/crm/companies/${c.id}`, search: location.search })}
                >
                  <Td dataLabel="Name">
                    <Link
                      to={{ pathname: `/crm/companies/${c.id}`, search: location.search }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.name}
                    </Link>
                  </Td>
                  <Td dataLabel="Industry">{industryLabel(c.industry)}</Td>
                  <Td dataLabel="Contacts">{c.contactCount}</Td>
                  <Td dataLabel="Open deal amount">{formatMoney(c.openDealAmount, null, currency) || '0'}</Td>
                  <Td dataLabel="Owner">{c.owner?.name ?? '—'}</Td>
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
          perPage={PAGE_SIZE}
          perPageOptions={[{ title: String(PAGE_SIZE), value: PAGE_SIZE }]}
          page={page + 1}
          onSetPage={(_e, p) => setPage(p - 1)}
          isCompact
        />
      </>
    );

  return (
    <CompanyDrawer
      companyId={id}
      settings={settings.data}
      owners={ownerChoices}
      onChanged={() => list.reload()}
      onClose={() => navigate({ pathname: '/crm/companies', search: location.search })}
    >
      <PageShell
        title="Companies"
        actions={
          <>
            {canEdit && <Button onClick={() => setCreating(true)}>New company</Button>}
            {canExport && <ExportButton entity="companies" search={exportSearch} />}
            {canEdit && (
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
                aria-label="Search companies"
                placeholder="Search companies"
                value={search}
                onChange={(_e, v) => setSearch(v)}
                onClear={() => setSearch('')}
              />
            </ToolbarItem>
            <ToolbarItem>
              <FormSelect aria-label="Industry" value={industry} onChange={(_e, v) => filter('industry', v)}>
                <FormSelectOption value="" label="Any industry" />
                {industries.map((i) => (
                  <FormSelectOption key={i.key} value={i.key} label={i.label} />
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
          </ToolbarContent>
        </Toolbar>
        {body}
        {importing && (
          <CompanyImportModal
            onClose={(imported) => {
              setImporting(false);
              if (imported) list.reload();
            }}
          />
        )}
      </PageShell>
      {creating && (
        <CompanyFormModal
          settings={settings.data}
          owners={ownerChoices}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            list.reload();
            navigate({ pathname: `/crm/companies/${saved.id}`, search: location.search });
          }}
        />
      )}
    </CompanyDrawer>
  );
};
