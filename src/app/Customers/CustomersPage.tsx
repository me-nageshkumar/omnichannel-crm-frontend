import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Pagination,
  SearchInput,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { CUSTOMER_PAGE_SIZE, listCustomers } from '@app/api/customers';
import { PageShell } from '@app/admin/PageShell';
import { EnabledLabel } from '@app/admin/EnabledLabel';
import { TemporaryPasswordModal } from '@app/admin/TemporaryPasswordModal';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { CreateCustomerModal } from '@app/Customers/CreateCustomerModal';

type Filter = 'enabled' | 'disabled' | 'all';

const ACTIVE_PARAM: Record<Filter, boolean | undefined> = { enabled: true, disabled: false, all: undefined };

/** Platform staff: every customer, searchable, 50 per page. */
export const CustomersPage: React.FunctionComponent = () => {
  const access = useAccess();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');
  const [page, setPage] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState<{ id: string; username: string; password: string } | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const customers = useLoad(
    (token) => listCustomers(token, { q, active: ACTIVE_PARAM[filter], page }),
    [q, filter, page],
  );

  const pagination = (
    <Pagination
      itemCount={customers.data?.total ?? 0}
      perPage={CUSTOMER_PAGE_SIZE}
      perPageOptions={[{ title: String(CUSTOMER_PAGE_SIZE), value: CUSTOMER_PAGE_SIZE }]}
      page={page + 1}
      onSetPage={(_e, p) => setPage(p - 1)}
      isCompact
    />
  );

  return (
    <PageShell
      title="Customers"
      actions={
        access.has('customer:create') && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Add customer
          </Button>
        )
      }
    >
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              aria-label="Search customers"
              placeholder="Search by name"
              value={search}
              onChange={(_e, v) => setSearch(v)}
              onClear={() => setSearch('')}
            />
          </ToolbarItem>
          <ToolbarItem>
            <ToggleGroup aria-label="Status filter">
              {(['enabled', 'disabled', 'all'] as Filter[]).map((f) => (
                <ToggleGroupItem
                  key={f}
                  text={f.charAt(0).toUpperCase() + f.slice(1)}
                  isSelected={filter === f}
                  onChange={() => {
                    setFilter(f);
                    setPage(0);
                  }}
                />
              ))}
            </ToggleGroup>
          </ToolbarItem>
          <ToolbarItem variant="pagination">{pagination}</ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {customers.error && <Alert variant="danger" isInline title={customers.error} />}
      {customers.loading && !customers.data ? (
        <Spinner aria-label="Loading customers" />
      ) : (
        <Table aria-label="Customers" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(customers.data?.items ?? []).map((c) => (
              <Tr key={c.id}>
                <Td dataLabel="Name">
                  <Link to={`/customers/${c.id}`}>{c.name}</Link>
                </Td>
                <Td dataLabel="Status">
                  <EnabledLabel disabled={c.disabled} active={c.active} />
                </Td>
                <Td dataLabel="Created">{new Date(c.creationTime).toLocaleDateString()}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {creating && (
        <CreateCustomerModal
          onCreated={(customer, owner) => {
            setCreating(false);
            setCreated({ id: customer.id, username: owner.user.username, password: owner.temporaryPassword });
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {created && (
        <TemporaryPasswordModal
          username={created.username}
          password={created.password}
          onClose={() => {
            const id = created.id;
            setCreated(null);
            navigate(`/customers/${id}`);
          }}
        />
      )}
    </PageShell>
  );
};
