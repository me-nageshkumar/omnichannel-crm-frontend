import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
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
  CONTACT_PAGE_SIZE,
  ContactFilterSpec,
  ContactSort,
  createContact,
  listLabels,
  searchContacts,
} from '@app/api/contacts';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { AddContactModal } from '@app/Contacts/AddContactModal';
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
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState<ContactSort>('LAST_MESSAGE');
  const [sortOpen, setSortOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filter = React.useMemo<ContactFilterSpec>(() => (q ? { q } : {}), [q]);
  const contacts = useLoad((tk) => searchContacts(tk, ws, { filter, sort, page }), [ws, filter, sort, page]);
  const labels = useLoad((tk) => listLabels(tk, ws), [ws]);
  const labelById = new Map((labels.data ?? []).map((l) => [l.id, l]));

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
              onChange={(_e, v) => setSearch(v)}
              onClear={() => setSearch('')}
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
          <ToolbarItem variant="pagination">
            <Pagination
              itemCount={contacts.data?.total ?? 0}
              perPage={CONTACT_PAGE_SIZE}
              perPageOptions={[{ title: String(CONTACT_PAGE_SIZE), value: CONTACT_PAGE_SIZE }]}
              page={page + 1}
              onSetPage={(_e, p) => setPage(p - 1)}
              isCompact
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {contacts.error && <Alert variant="danger" isInline title={contacts.error} />}
      {contacts.loading && !contacts.data ? (
        <Spinner aria-label="Loading contacts" />
      ) : (
        <Table aria-label="Contacts" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Labels</Th>
              <Th>Last message</Th>
              <Th>Source</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(contacts.data?.items ?? []).length === 0 ? (
              <Tr>
                <Td colSpan={5}>No contacts match.</Td>
              </Tr>
            ) : (
              (contacts.data?.items ?? []).map((c) => (
                <Tr key={c.id}>
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
    </PageShell>
  );
};
