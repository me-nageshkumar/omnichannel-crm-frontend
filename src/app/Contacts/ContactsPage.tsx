import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  ExpandableSection,
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
  ContactSort,
  Selection,
  bulkContacts,
  countContacts,
  createContact,
  createFilter,
  deleteFilter,
  listAttributes,
  listFilters,
  listLabels,
  searchContacts,
} from '@app/api/contacts';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { NameModal } from '@app/admin/NameModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { AddContactModal } from '@app/Contacts/AddContactModal';
import { BULK_BUTTON, BulkModal } from '@app/Contacts/BulkModal';
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
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [panel, setPanel] = React.useState<ContactFilterSpec>({});
  const [panelEpoch, setPanelEpoch] = React.useState(0);
  const [savedId, setSavedId] = React.useState<string | null>(null);
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
  const removal = useAction();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filter = React.useMemo<ContactFilterSpec>(() => cleanSpec({ ...panel, q }), [panel, q]);
  const contacts = useLoad(
    (tk) => searchContacts(tk, ws, { ...(savedId ? { filterId: savedId } : { filter }), sort, page }),
    [ws, savedId, filter, sort, page],
  );
  const labels = useLoad((tk) => listLabels(tk, ws), [ws]);
  const attributes = useLoad((tk) => listAttributes(tk, ws), [ws]);
  const saved = useLoad((tk) => listFilters(tk, ws), [ws]);
  const labelById = new Map((labels.data ?? []).map((l) => [l.id, l]));
  const items = contacts.data?.items ?? [];
  const total = contacts.data?.total ?? 0;

  // A bulk action must never reach rows the user can no longer see.
  const viewKey = JSON.stringify([ws, savedId, filter, sort, page]);
  React.useEffect(() => {
    setSelected([]);
    setAllMatching(false);
  }, [viewKey]);

  const changeFilter = (next: ContactFilterSpec) => {
    setSavedId(null);
    setPanel(next);
    setPage(0);
  };
  const applySaved = (id: string | null) => {
    setSavedId(id);
    setPage(0);
    const spec = saved.data?.find((f) => f.id === id)?.filter;
    if (spec) {
      const { q: sq, ...rest } = spec;
      setPanel(rest);
      setSearch(sq ?? '');
      setQ(sq ?? '');
      setPanelEpoch((e) => e + 1);
    }
  };
  const selection = (): Selection => {
    if (allMatching) return savedId ? { filterId: savedId } : { filter };
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
        canEdit && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add contact
          </Button>
        )
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
                setSavedId(null);
                setSearch(v);
              }}
              onClear={() => {
                setSavedId(null);
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
              canSaveCurrent={Object.keys(filter).length > 0}
              onSelect={applySaved}
              onSave={() => setSaving(true)}
              onDelete={() => {
                removal.reset();
                setDeletingFilter(true);
              }}
            />
          </ToolbarItem>
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
      {saving && (
        <NameModal
          title="Save filter"
          label="Filter name"
          submitLabel="Save"
          save={(name) => createFilter(t, ws, name, filter)}
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
