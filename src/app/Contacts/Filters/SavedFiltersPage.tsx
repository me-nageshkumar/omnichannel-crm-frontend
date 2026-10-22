import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { SavedFilter, countContacts, deleteFilter, isAdvanced, listFilters } from '@app/api/contacts';
import { messageFor } from '@app/api/messages';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { countText } from '@app/Contacts/filterSpec';
import { relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

/** One row's count: running, answered, or failed. A row not in the map has not been counted. */
type RowCount = { state: 'counting' } | { state: 'done'; text: string } | { state: 'error'; text: string };

/** The brand's saved filters, simple and advanced, with counts on request. */
export const SavedFiltersPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const t = token as string;
  const ws = workspace?.id ?? '';
  const navigate = useNavigate();
  const canBulk = useAccess().hasInWorkspace('contact:bulk');
  const filters = useLoad((tk) => listFilters(tk, ws), [ws]);
  const remove = useAction();
  const [counts, setCounts] = React.useState<Record<string, RowCount>>({});
  const [deleting, setDeleting] = React.useState<SavedFilter | null>(null);
  const [removed, setRemoved] = React.useState<string[]>([]);
  const items = (filters.data ?? []).filter((f) => !removed.includes(f.id));

  const count = async (id: string) => {
    setCounts((prev) => ({ ...prev, [id]: { state: 'counting' } }));
    try {
      const { count: n } = await countContacts(t, ws, { filterId: id });
      setCounts((prev) => ({ ...prev, [id]: { state: 'done', text: countText(n) } }));
    } catch (e) {
      setCounts((prev) => ({ ...prev, [id]: { state: 'error', text: messageFor(e) } }));
    }
  };

  const edit = (f: SavedFilter) =>
    isAdvanced(f) ? navigate(`/contacts/filters/${f.id}`) : navigate('/contacts', { state: { filterId: f.id } });

  const confirmDelete = async () => {
    if (!deleting) return;
    const done = await remove.run(() => deleteFilter(t, ws, deleting.id).then(() => true));
    if (done) {
      setRemoved((prev) => [...prev, deleting.id]);
      setDeleting(null);
    }
  };

  const countCell = (f: SavedFilter) => {
    const c = counts[f.id];
    if (!c) {
      return (
        <Button variant="secondary" size="sm" onClick={() => void count(f.id)}>
          Count
        </Button>
      );
    }
    return c.state === 'counting' ? <Spinner size="md" aria-label="Counting contacts" /> : c.text;
  };

  return (
    <PageShell
      title="Saved filters"
      actions={
        <>
          {canBulk && (
            <Button variant="primary" style={{ marginRight: 8 }} onClick={() => navigate('/contacts/filters/new')}>
              New filter
            </Button>
          )}
          <Button component={(p) => <Link {...p} to="/contacts" />} variant="link">
            Back to contacts
          </Button>
        </>
      }
    >
      {filters.error && <Alert variant="danger" isInline title={filters.error} />}
      {filters.loading && !filters.data ? (
        <Spinner aria-label="Loading saved filters" />
      ) : (
        <Table aria-label="Saved filters" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Kind</Th>
              <Th>Contacts</Th>
              <Th>Updated</Th>
              {canBulk && <Th screenReaderText="Actions" />}
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 ? (
              <Tr>
                <Td colSpan={canBulk ? 5 : 4}>No saved filters yet.</Td>
              </Tr>
            ) : (
              items.map((f) => (
                <Tr key={f.id}>
                  <Td dataLabel="Name">{f.name}</Td>
                  <Td dataLabel="Kind">{isAdvanced(f) ? 'Advanced' : 'Simple'}</Td>
                  <Td dataLabel="Contacts">{countCell(f)}</Td>
                  <Td dataLabel="Updated">{relative(f.lastUpdateTime ?? f.creationTime)}</Td>
                  {canBulk && (
                    <Td isActionCell>
                      <ActionsColumn
                        items={[
                          { title: 'Edit', onClick: () => edit(f) },
                          {
                            title: 'Delete',
                            onClick: () => {
                              remove.reset();
                              setDeleting(f);
                            },
                          },
                        ]}
                      />
                    </Td>
                  )}
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      )}
      {deleting && (
        <ConfirmModal
          title="Delete this saved filter?"
          confirmLabel="Delete"
          variant="danger"
          busy={remove.busy}
          error={remove.error}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        >
          Contacts are not affected. Everyone in the brand loses the filter.
        </ConfirmModal>
      )}
    </PageShell>
  );
};
