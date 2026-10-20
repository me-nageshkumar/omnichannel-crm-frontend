import * as React from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Flex,
  FlexItem,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  CustomerDetail,
  addOwner,
  getCustomer,
  listCustomerUsers,
  renameCustomer,
  resetOwnerPassword,
  setCustomerEnabled,
  setCustomerUserEnabled,
  setCustomerWorkspaceEnabled,
} from '@app/api/customers';
import { UserSummary, WithTemporaryPassword, roleLabel } from '@app/api/users';
import type { Workspace } from '@app/api/workspaces';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { NameModal } from '@app/admin/NameModal';
import { PageShell } from '@app/admin/PageShell';
import { PersonModal } from '@app/admin/PersonModal';
import { ResetPasswordModal } from '@app/admin/ResetPasswordModal';
import { EnabledLabel } from '@app/admin/EnabledLabel';
import { TemporaryPasswordModal } from '@app/admin/TemporaryPasswordModal';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';

type Dialog =
  | { kind: 'rename' }
  | { kind: 'toggle' }
  | { kind: 'addOwner' }
  | { kind: 'resetOwner'; owner: UserSummary }
  | { kind: 'toggleUser'; user: UserSummary }
  | { kind: 'toggleBrand'; brand: Workspace }
  | { kind: 'password'; username: string; password: string };

/** "Brand A: Agent, Brand B: Team lead", or the company-wide role. */
function rolesText(u: UserSummary): string {
  if (u.role) return `${roleLabel(u.role.name)} (all brands)`;
  return u.workspaceRoles.map((wr) => `${wr.workspaceName}: ${roleLabel(wr.role.name)}`).join(', ');
}

/** One customer: its brands, owners and users, and the platform-side actions on them. */
export const CustomerDetailPage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const { token } = useSession();
  const canManage = useAccess().has('customer:manage');
  const detail = useLoad((t) => getCustomer(t, id), [id]);
  const users = useLoad((t) => listCustomerUsers(t, id), [id]);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const toggle = useAction();

  const update = (fn: (d: CustomerDetail) => CustomerDetail) => detail.setData((d) => (d ? fn(d) : d));
  const putOwner = (owner: UserSummary) => update((d) => ({ ...d, admins: upsert(d.admins, owner) }));
  /** A user may be in both lists: owners are users too. */
  const putUser = (u: UserSummary) => {
    users.setData((list) => upsert(list ?? [], u));
    update((d) => (d.admins.some((a) => a.id === u.id) ? { ...d, admins: upsert(d.admins, u) } : d));
  };
  const showPassword = (reply: WithTemporaryPassword) => {
    putOwner(reply.user);
    setDialog({ kind: 'password', username: reply.user.username, password: reply.temporaryPassword });
  };

  if (detail.error) {
    return (
      <PageShell title="Customer">
        <Alert variant="danger" isInline title={detail.error} />
      </PageShell>
    );
  }
  if (!detail.data) {
    return (
      <PageShell title="Customer">
        <Spinner aria-label="Loading customer" />
      </PageShell>
    );
  }
  const { customer, workspaces, admins } = detail.data;
  const t = token as string;

  const onToggleCustomer = async () => {
    const updated = await toggle.run(() => setCustomerEnabled(t, customer.id, !customer.active));
    if (updated) {
      update((d) => ({ ...d, customer: updated }));
      setDialog(null);
    }
  };
  const onToggleUser = async (u: UserSummary) => {
    const updated = await toggle.run(() => setCustomerUserEnabled(t, customer.id, u.id, !u.active));
    if (updated) {
      putUser(updated);
      setDialog(null);
    }
  };
  const onToggleBrand = async (brand: Workspace) => {
    const updated = await toggle.run(() =>
      setCustomerWorkspaceEnabled(t, customer.id, brand.id, Boolean(brand.disabled)),
    );
    if (updated) {
      update((d) => ({ ...d, workspaces: upsert(d.workspaces, updated) }));
      setDialog(null);
    }
  };
  const toggleItem = (title: string, open: () => void) => ({
    title,
    onClick: () => {
      toggle.reset();
      open();
    },
  });

  return (
    <PageShell
      title={customer.name}
      actions={
        canManage && (
          <Flex>
            <FlexItem>
              <EnabledLabel disabled={customer.disabled} />
            </FlexItem>
            <FlexItem>
              <Button variant="secondary" onClick={() => setDialog({ kind: 'rename' })}>
                Edit name
              </Button>
            </FlexItem>
            <FlexItem>
              <Button
                variant={customer.active ? 'danger' : 'primary'}
                onClick={() => {
                  toggle.reset();
                  setDialog({ kind: 'toggle' });
                }}
              >
                {customer.active ? 'Disable' : 'Enable'}
              </Button>
            </FlexItem>
          </Flex>
        )
      }
    >
      <Stack hasGutter>
        {!canManage && (
          <StackItem>
            <EnabledLabel disabled={customer.disabled} />
          </StackItem>
        )}
        <StackItem>
          <Card>
            <CardTitle>Brands</CardTitle>
            <CardBody>
              <Table aria-label="Brands" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Status</Th>
                    <Th screenReaderText="Actions" />
                  </Tr>
                </Thead>
                <Tbody>
                  {workspaces.map((w) => (
                    <Tr key={w.id}>
                      <Td dataLabel="Name">{w.name}</Td>
                      <Td dataLabel="Status">
                        <EnabledLabel disabled={w.disabled} />
                      </Td>
                      <Td isActionCell>
                        {canManage && (
                          <ActionsColumn
                            items={[
                              toggleItem(w.disabled ? 'Enable' : 'Disable', () =>
                                setDialog({ kind: 'toggleBrand', brand: w }),
                              ),
                            ]}
                          />
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        </StackItem>
        <StackItem>
          <Card>
            <CardHeader
              actions={{
                actions: canManage && (
                  <Button variant="secondary" onClick={() => setDialog({ kind: 'addOwner' })}>
                    Add owner
                  </Button>
                ),
              }}
            >
              <CardTitle>Owners</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Owners" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Username</Th>
                    <Th>Status</Th>
                    <Th screenReaderText="Actions" />
                  </Tr>
                </Thead>
                <Tbody>
                  {admins.map((o) => (
                    <Tr key={o.id}>
                      <Td dataLabel="Name">{o.name}</Td>
                      <Td dataLabel="Username">{o.username}</Td>
                      <Td dataLabel="Status">
                        <EnabledLabel disabled={o.disabled} />
                      </Td>
                      <Td isActionCell>
                        {canManage && (
                          <ActionsColumn
                            items={[
                              { title: 'Reset password', onClick: () => setDialog({ kind: 'resetOwner', owner: o }) },
                              toggleItem(o.active ? 'Disable' : 'Enable', () =>
                                setDialog({ kind: 'toggleUser', user: o }),
                              ),
                            ]}
                          />
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        </StackItem>
        <StackItem>
          <Card>
            <CardTitle>Users</CardTitle>
            <CardBody>
              {users.error && <Alert variant="danger" isInline title={users.error} />}
              {users.loading && !users.data ? (
                <Spinner aria-label="Loading users" />
              ) : (
                <Table aria-label="Users" variant="compact">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Username</Th>
                      <Th>Roles</Th>
                      <Th>Status</Th>
                      <Th screenReaderText="Actions" />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {(users.data ?? []).map((u) => (
                      <Tr key={u.id}>
                        <Td dataLabel="Name">{u.name}</Td>
                        <Td dataLabel="Username">{u.username}</Td>
                        <Td dataLabel="Roles">{rolesText(u)}</Td>
                        <Td dataLabel="Status">
                          <EnabledLabel disabled={u.disabled} />
                        </Td>
                        <Td isActionCell>
                          {canManage && (
                            <ActionsColumn
                              items={[
                                toggleItem(u.active ? 'Disable' : 'Enable', () =>
                                  setDialog({ kind: 'toggleUser', user: u }),
                                ),
                              ]}
                            />
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </StackItem>
      </Stack>

      {dialog?.kind === 'rename' && (
        <NameModal
          title="Edit name"
          label="Company name"
          current={customer.name}
          submitLabel="Save"
          save={(name) => renameCustomer(t, customer.id, name)}
          onSaved={(updated) => {
            update((d) => ({ ...d, customer: updated }));
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'toggle' && (
        <ConfirmModal
          title={`${customer.active ? 'Disable' : 'Enable'} ${customer.name}?`}
          confirmLabel={customer.active ? 'Disable' : 'Enable'}
          variant={customer.active ? 'danger' : 'primary'}
          busy={toggle.busy}
          error={toggle.error}
          onConfirm={onToggleCustomer}
          onCancel={() => setDialog(null)}
        >
          {customer.active
            ? `All of ${customer.name}'s users will be logged out and unable to log in.`
            : `${customer.name}'s users will be able to log in again.`}
        </ConfirmModal>
      )}
      {dialog?.kind === 'addOwner' && (
        <PersonModal
          title="Add owner"
          mode="create"
          submitLabel="Add"
          submit={(p) =>
            addOwner(t, customer.id, {
              name: p.name,
              username: p.username,
              email: p.email,
              mobileNumber: p.mobileNumber,
              temporaryPassword: p.temporaryPassword,
            })
          }
          onSaved={showPassword}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'resetOwner' && (
        <ResetPasswordModal
          name={dialog.owner.name}
          reset={(pw) => resetOwnerPassword(t, customer.id, dialog.owner.id, pw)}
          onDone={(password) => setDialog({ kind: 'password', username: dialog.owner.username, password })}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'toggleBrand' && (
        <ConfirmModal
          title={`${dialog.brand.disabled ? 'Enable' : 'Disable'} ${dialog.brand.name}?`}
          confirmLabel={dialog.brand.disabled ? 'Enable' : 'Disable'}
          variant={dialog.brand.disabled ? 'primary' : 'danger'}
          busy={toggle.busy}
          error={toggle.error}
          onConfirm={() => onToggleBrand(dialog.brand)}
          onCancel={() => setDialog(null)}
        >
          {dialog.brand.disabled
            ? 'Its people can use it again and its WhatsApp numbers can reconnect.'
            : 'Its people lose access to it and its WhatsApp numbers disconnect. Only platform staff can enable it again.'}
        </ConfirmModal>
      )}
      {dialog?.kind === 'toggleUser' && (
        <ConfirmModal
          title={`${dialog.user.active ? 'Disable' : 'Enable'} ${dialog.user.name}?`}
          confirmLabel={dialog.user.active ? 'Disable' : 'Enable'}
          variant={dialog.user.active ? 'danger' : 'primary'}
          busy={toggle.busy}
          error={toggle.error}
          onConfirm={() => onToggleUser(dialog.user)}
          onCancel={() => setDialog(null)}
        >
          {dialog.user.active
            ? 'They will be logged out and unable to log in until enabled again.'
            : 'They will be able to log in again.'}
        </ConfirmModal>
      )}
      {dialog?.kind === 'password' && (
        <TemporaryPasswordModal username={dialog.username} password={dialog.password} onClose={() => setDialog(null)} />
      )}
    </PageShell>
  );
};
