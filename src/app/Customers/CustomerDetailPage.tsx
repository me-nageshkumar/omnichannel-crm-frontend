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
  List,
  ListItem,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  CustomerDetail,
  addOwner,
  getCustomer,
  renameCustomer,
  resetOwnerPassword,
  setCustomerActive,
  setOwnerActive,
} from '@app/api/customers';
import { UserSummary, WithTemporaryPassword } from '@app/api/users';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { NameModal } from '@app/admin/NameModal';
import { PageShell } from '@app/admin/PageShell';
import { PersonModal } from '@app/admin/PersonModal';
import { ResetPasswordModal } from '@app/admin/ResetPasswordModal';
import { StatusLabel } from '@app/admin/StatusLabel';
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
  | { kind: 'toggleOwner'; owner: UserSummary }
  | { kind: 'password'; username: string; password: string };

/** One customer: its brands and owners, and the platform-side actions on them. */
export const CustomerDetailPage: React.FunctionComponent = () => {
  const { id = '' } = useParams();
  const { token } = useSession();
  const canManage = useAccess().has('customer:manage');
  const detail = useLoad((t) => getCustomer(t, id), [id]);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const toggle = useAction();

  const update = (fn: (d: CustomerDetail) => CustomerDetail) => detail.setData((d) => (d ? fn(d) : d));
  const putOwner = (owner: UserSummary) => update((d) => ({ ...d, admins: upsert(d.admins, owner) }));
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
    const updated = await toggle.run(() => setCustomerActive(t, customer.id, !customer.active));
    if (updated) {
      update((d) => ({ ...d, customer: updated }));
      setDialog(null);
    }
  };
  const onToggleOwner = async (owner: UserSummary) => {
    const updated = await toggle.run(() => setOwnerActive(t, customer.id, owner.id, !owner.active));
    if (updated) {
      putOwner(updated);
      setDialog(null);
    }
  };

  return (
    <PageShell
      title={customer.name}
      actions={
        canManage && (
          <Flex>
            <FlexItem>
              <StatusLabel active={customer.active} />
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
                {customer.active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </FlexItem>
          </Flex>
        )
      }
    >
      <Stack hasGutter>
        {!canManage && (
          <StackItem>
            <StatusLabel active={customer.active} />
          </StackItem>
        )}
        <StackItem>
          <Card>
            <CardTitle>Brands</CardTitle>
            <CardBody>
              <List isPlain>
                {workspaces.map((w) => (
                  <ListItem key={w.id}>{w.name}</ListItem>
                ))}
              </List>
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
                        <StatusLabel active={o.active} />
                      </Td>
                      <Td isActionCell>
                        {canManage && (
                          <ActionsColumn
                            items={[
                              { title: 'Reset password', onClick: () => setDialog({ kind: 'resetOwner', owner: o }) },
                              {
                                title: o.active ? 'Deactivate' : 'Reactivate',
                                onClick: () => {
                                  toggle.reset();
                                  setDialog({ kind: 'toggleOwner', owner: o });
                                },
                              },
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
          title={`${customer.active ? 'Deactivate' : 'Reactivate'} ${customer.name}?`}
          confirmLabel={customer.active ? 'Deactivate' : 'Reactivate'}
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
          onDone={showPassword}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'toggleOwner' && (
        <ConfirmModal
          title={`${dialog.owner.active ? 'Deactivate' : 'Reactivate'} ${dialog.owner.name}?`}
          confirmLabel={dialog.owner.active ? 'Deactivate' : 'Reactivate'}
          variant={dialog.owner.active ? 'danger' : 'primary'}
          busy={toggle.busy}
          error={toggle.error}
          onConfirm={() => onToggleOwner(dialog.owner)}
          onCancel={() => setDialog(null)}
        >
          {dialog.owner.active
            ? 'They will be logged out and unable to log in until reactivated.'
            : 'They will be able to log in again.'}
        </ConfirmModal>
      )}
      {dialog?.kind === 'password' && (
        <TemporaryPasswordModal username={dialog.username} password={dialog.password} onClose={() => setDialog(null)} />
      )}
    </PageShell>
  );
};
