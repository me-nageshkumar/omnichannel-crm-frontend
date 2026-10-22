import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  ExpandableSection,
  Label,
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
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  BulkAction,
  CONTACT_PAGE_SIZE,
  ContactFilterSpec,
  ContactPage,
  ContactSort,
  Selection,
  bulkContacts,
  countContacts,
  createContact,
  createFilter,
  deleteFilter,
  exportContacts,
  importContacts,
  isAdvanced,
  listAttributes,
  listFilters,
  listLabels,
  saveFile,
  searchContacts,
} from '@app/api/contacts';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { NameModal } from '@app/admin/NameModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { messageFor } from '@app/api/messages';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { AddContactModal } from '@app/Contacts/AddContactModal';
import { BULK_BUTTON, BulkModal } from '@app/Contacts/BulkModal';
import { ImportContactsModal } from '@app/Contacts/ImportContactsModal';
import { FilterPanel } from '@app/Contacts/FilterPanel';
import { SavedFilterBar } from '@app/Contacts/SavedFilterBar';
import { cleanSpec } from '@app/Contacts/filterSpec';
import { LabelChip } from '@app/Contacts/LabelChip';
import { SOURCE_TEXT, displayName, phoneText } from '@app/Contacts/contactDisplay';

const SORTS: Record<ContactSort, string> = { LAST_MESSAGE: 'Last message', NAME: 'Name', CREATED: 'Created' };

/** The current brand's contacts: search, sort, page; add by hand. */
export const ContactsPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const access = useAccess();
  const canEdit = access.hasInWorkspace('contact:edit');
  const canBulk = access.hasInWorkspace('contact:bulk');
  const canDelete = access.hasInWorkspace('contact:delete');
  const canImport = access.hasInWorkspace('contact:import');
  const canExport = access.hasInWorkspace('contact:export');
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [panel, setPanel] = React.useState<ContactFilterSpec>({});
  const [panelEpoch, setPanelEpoch] = React.useState(0);
  const navigate = useNavigate();
  const handedOver = (useLocation().state as { filterId?: string } | null)?.filterId ?? null;
  const [savedId, setSavedId] = React.useState<string | null>(handedOver);
  const [sort, setSort] = React.useState<ContactSort>('LAST_MESSAGE');
  const [sortOpen, setSortOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deletingFilter, setDeletingFilter] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [allMatching, setAllMatching] = React.useState(false);
  const [bulk, setBulk] = React.useState<BulkAction | null>(null);
  const [bulkNote, setBulkNote] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const removal = useAction();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filter = React.useMemo<ContactFilterSpec>(() => cleanSpec({ ...panel, q }), [panel, q]);
  const saved = useLoad((tk) => listFilters(tk, ws), [ws]);
  // An id that the loaded list does not know (e.g. a stale hand-over) counts as no pick at all.
  const activeId = savedId && !(saved.data && !saved.data.some((f) => f.id === savedId)) ? savedId : null;
  const picked = saved.data?.find((f) => f.id === activeId);
  const advanced = !!picked && isAdvanced(picked);
  // The one place that decides what "the contacts in view" means, for search, export and "all matching".
  const scope = ():
    | { filterId: string }
    | { filterId: string; filter: ContactFilterSpec }
    | { filter: ContactFilterSpec } => {
    if (!activeId) return { filter };
    return advanced && Object.keys(filter).length > 0 ? { filterId: activeId, filter } : { filterId: activeId };
  };
  const scopeKey = JSON.stringify(scope());
  // A handed-over id is only trusted once the saved filters have arrived, so the first search never uses a bogus one.
  const waitingForList = !!savedId && savedId === handedOver && saved.loading && !saved.data;
  const contacts = useLoad(
    (tk) =>
      waitingForList ? new Promise<ContactPage>(() => undefined) : searchContacts(tk, ws, { ...scope(), sort, page }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ws, scopeKey, waitingForList, sort, page],
  );
  const labels = useLoad((tk) => listLabels(tk, ws), [ws]);
  const attributes = useLoad((tk) => listAttributes(tk, ws), [ws]);
  const labelById = new Map((labels.data ?? []).map((l) => [l.id, l]));
  const items = contacts.data?.items ?? [];
  const total = contacts.data?.total ?? 0;

  // A bulk action must never reach rows the user can no longer see.
  const viewKey = JSON.stringify([ws, savedId, filter, sort, page]);
  React.useEffect(() => {
    setSelected([]);
    setAllMatching(false);
  }, [viewKey]);

  const clearPick = () => {
    if (!advanced) setSavedId(null);
  };
  const changeFilter = (next: ContactFilterSpec) => {
    clearPick();
    setPanel(next);
    setPage(0);
  };
  const applySaved = (id: string | null) => {
    setSavedId(id);
    setPage(0);
    const pick = saved.data?.find((f) => f.id === id);
    if (pick && isAdvanced(pick)) {
      setPanel({});
      setSearch('');
      setQ('');
      setPanelEpoch((e) => e + 1);
      return;
    }
    const spec = pick?.filter;
    if (spec) {
      const { q: sq, ...rest } = spec;
      setPanel(rest);
      setSearch(sq ?? '');
      setQ(sq ?? '');
      setPanelEpoch((e) => e + 1);
    }
  };
  // The handed-over filter is applied once the list is known: a simple one fills the panel, an unknown id is dropped.
  const handoverDone = React.useRef(false);
  React.useEffect(() => {
    if (!saved.data || handoverDone.current) return;
    handoverDone.current = true;
    if (!savedId) return;
    const pick = saved.data.find((f) => f.id === savedId);
    if (!pick) setSavedId(null);
    else if (!isAdvanced(pick)) applySaved(savedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.data]);
  const selection = (): Selection => {
    if (allMatching) return scope();
    return { ids: selected };
  };
  const toggleRow = (id: string, on: boolean) => {
    setAllMatching(false);
    setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  };
  const selectedCount = allMatching ? total : selected.length;
  const onDeleteFilter = async () => {
    const done = await removal.run(async () => {
      await deleteFilter(token as string, ws, savedId as string);
      return true;
    });
    if (done) {
      saved.setData((l) => (l ?? []).filter((f) => f.id !== savedId));
      setSavedId(null);
      setDeletingFilter(false);
    }
  };
  const onExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const { blob, fileName } = await exportContacts(t, ws, scope());
      saveFile(blob, fileName);
    } catch (e) {
      setExportError(messageFor(e));
    } finally {
      setExporting(false);
    }
  };
  const bulkActions: BulkAction[] = [
    'ADD_LABELS',
    'REMOVE_LABELS',
    'SET_ATTRIBUTE',
    'CLEAR_ATTRIBUTE',
    ...(canDelete ? (['DELETE'] as BulkAction[]) : []),
  ];

  return (
    <PageShell
      title="Contacts"
      actions={
        <>
          {canImport && (
            <Button variant="secondary" onClick={() => setImporting(true)}>
              Import
            </Button>
          )}{' '}
          {canExport && (
            <Button variant="secondary" onClick={onExport} isDisabled={exporting} isLoading={exporting}>
              Export
            </Button>
          )}{' '}
          {canEdit && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add contact
            </Button>
          )}
        </>
      }
    >
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              aria-label="Search contacts"
              placeholder="Search by name or number"
              value={search}
              onChange={(_e, v) => {
                clearPick();
                setSearch(v);
              }}
              onClear={() => {
                clearPick();
                setSearch('');
              }}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Select
              isOpen={sortOpen}
              selected={sort}
              onSelect={(_e, v) => {
                setSort(v as ContactSort);
                setSortOpen(false);
                setPage(0);
              }}
              onOpenChange={setSortOpen}
              toggle={(ref) => (
                <MenuToggle ref={ref} isExpanded={sortOpen} onClick={() => setSortOpen(!sortOpen)}>
                  {`Sort: ${SORTS[sort]}`}
                </MenuToggle>
              )}
            >
              <SelectList>
                {(Object.keys(SORTS) as ContactSort[]).map((s) => (
                  <SelectOption key={s} value={s}>
                    {SORTS[s]}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ToolbarItem>
          <ToolbarItem>
            <SavedFilterBar
              filters={saved.data ?? []}
              selectedId={savedId}
              canManage={canBulk}
              canSaveCurrent={!advanced && Object.keys(filter).length > 0}
              onSelect={applySaved}
              onSave={() => setSaving(true)}
              onDelete={() => {
                removal.reset();
                setDeletingFilter(true);
              }}
            />
          </ToolbarItem>
          {canBulk && (
            <ToolbarItem>
              <Button variant="secondary" onClick={() => navigate('/contacts/filters')}>
                Filter builder
              </Button>
            </ToolbarItem>
          )}
          <ToolbarItem variant="pagination">
            <Pagination
              itemCount={total}
              perPage={CONTACT_PAGE_SIZE}
              perPageOptions={[{ title: String(CONTACT_PAGE_SIZE), value: CONTACT_PAGE_SIZE }]}
              page={page + 1}
              onSetPage={(_e, p) => setPage(p - 1)}
              isCompact
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      <ExpandableSection toggleText="Filters">
        <FilterPanel
          key={panelEpoch}
          spec={panel}
          labels={labels.data ?? []}
          attributes={attributes.data ?? []}
          onChange={changeFilter}
        />
      </ExpandableSection>
      {bulkNote && (
        <Alert
          variant="success"
          isInline
          title={bulkNote}
          actionClose={<AlertActionCloseButton onClose={() => setBulkNote(null)} />}
        />
      )}
      {canBulk && selectedCount > 0 && (
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              {allMatching ? `All ${total.toLocaleString('en-US')} matching selected` : `${selected.length} selected`}
            </ToolbarItem>
            {!allMatching && selected.length === items.length && total > items.length && (
              <ToolbarItem>
                <Button variant="link" isInline onClick={() => setAllMatching(true)}>
                  {`Select all ${total.toLocaleString('en-US')} matching`}
                </Button>
              </ToolbarItem>
            )}
            {bulkActions.map((a) => (
              <ToolbarItem key={a}>
                <Button variant={a === 'DELETE' ? 'danger' : 'secondary'} onClick={() => setBulk(a)}>
                  {BULK_BUTTON[a]}
                </Button>
              </ToolbarItem>
            ))}
            <ToolbarItem>
              <Button
                variant="link"
                onClick={() => {
                  setSelected([]);
                  setAllMatching(false);
                }}
              >
                Clear selection
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      )}
      {exportError && <Alert variant="danger" isInline title={exportError} />}
      {contacts.error && <Alert variant="danger" isInline title={contacts.error} />}
      {contacts.loading && !contacts.data ? (
        <Spinner aria-label="Loading contacts" />
      ) : (
        <Table aria-label="Contacts" variant="compact">
          <Thead>
            <Tr>
              {canBulk && (
                <Th
                  aria-label="Select"
                  select={{
                    onSelect: (_e, on) => {
                      setAllMatching(false);
                      setSelected(on ? items.map((c) => c.id) : []);
                    },
                    isSelected: items.length > 0 && selected.length === items.length,
                  }}
                />
              )}
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Labels</Th>
              <Th>Last message</Th>
              <Th>Source</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 ? (
              <Tr>
                <Td colSpan={6}>No contacts match.</Td>
              </Tr>
            ) : (
              items.map((c, rowIndex) => (
                <Tr key={c.id}>
                  {canBulk && (
                    <Td
                      select={{
                        rowIndex,
                        onSelect: (_e, on) => toggleRow(c.id, on),
                        isSelected: selected.includes(c.id),
                      }}
                    />
                  )}
                  <Td dataLabel="Name">
                    <Link to={`/contacts/${c.id}`}>{displayName(c)}</Link>
                    {c.doNotContact && (
                      <>
                        {' '}
                        <Label color="red" isCompact>
                          Do not contact
                        </Label>
                      </>
                    )}
                  </Td>
                  <Td dataLabel="Phone">{c.name || c.phone ? phoneText(c) : '—'}</Td>
                  <Td dataLabel="Labels">
                    {c.labels.map((id) => labelById.get(id)).map((l) => l && <LabelChip key={l.id} label={l} />)}
                  </Td>
                  <Td dataLabel="Last message">{c.lastMessageAt ? relative(c.lastMessageAt) : '—'}</Td>
                  <Td dataLabel="Source">{SOURCE_TEXT[c.source]}</Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      )}

      {adding && (
        <AddContactModal
          save={(name, phone) => createContact(t, ws, { name, phone })}
          onSaved={() => {
            setAdding(false);
            contacts.reload();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {importing && (
        <ImportContactsModal
          upload={(file) => importContacts(t, ws, file)}
          onImported={() => {
            contacts.reload();
            labels.reload();
          }}
          onClose={() => setImporting(false)}
        />
      )}
      {saving && (
        <NameModal
          title="Save filter"
          label="Filter name"
          submitLabel="Save"
          save={(name) => createFilter(t, ws, { name, filter })}
          onSaved={(f) => {
            saved.setData((l) => upsert(l ?? [], f));
            setSavedId(f.id);
            setSaving(false);
          }}
          onCancel={() => setSaving(false)}
        />
      )}
      {deletingFilter && (
        <ConfirmModal
          title="Delete this saved filter?"
          confirmLabel="Delete"
          variant="danger"
          busy={removal.busy}
          error={removal.error}
          onConfirm={onDeleteFilter}
          onCancel={() => setDeletingFilter(false)}
        >
          Contacts are not affected. Everyone in the brand loses the filter.
        </ConfirmModal>
      )}
      {bulk && (
        <BulkModal
          action={bulk}
          selection={selection()}
          labels={labels.data ?? []}
          attributes={attributes.data ?? []}
          count={(sel) => countContacts(t, ws, sel)}
          run={(request) => bulkContacts(t, ws, request)}
          onDone={(result) => {
            setBulk(null);
            setSelected([]);
            setAllMatching(false);
            setBulkNote(`Updated ${result.changed} of ${result.matched} contacts.`);
            contacts.reload();
            labels.reload();
          }}
          onCancel={() => setBulk(null)}
        />
      )}
    </PageShell>
  );
};
