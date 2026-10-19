import * as React from 'react';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  createPlatformUser,
  deactivatePlatformUser,
  listPlatformUsers,
  platformAssignableRoles,
  reactivatePlatformUser,
  resetPlatformUserPassword,
  updatePlatformUser,
} from '@app/api/platformUsers';
import { UserSummary, WithTemporaryPassword, roleLabel } from '@app/api/users';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { PersonModal, personOf } from '@app/admin/PersonModal';
import { ResetPasswordModal } from '@app/admin/ResetPasswordModal';
import { StatusLabel } from '@app/admin/StatusLabel';
import { TemporaryPasswordModal } from '@app/admin/TemporaryPasswordModal';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: UserSummary }
  | { kind: 'reset'; user: UserSummary }
  | { kind: 'toggle'; user: UserSummary }
  | { kind: 'password'; username: string; password: string };

/** Super Admin and delegated staff: the platform's own users (Account Managers, the device user). */
export const PlatformUsersPage: React.FunctionComponent = () => {
  const { token } = useSession();
  const users = useLoad(listPlatformUsers);
  const roles = useLoad(platformAssignableRoles);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const toggle = useAction();

  const put = (u: UserSummary) => users.setData((list) => upsert(list ?? [], u));
  const showPassword = (reply: WithTemporaryPassword) => {
    put(reply.user);
    setDialog({ kind: 'password', username: reply.user.username, password: reply.temporaryPassword });
  };

  const onToggle = async (u: UserSummary) => {
    const updated = await toggle.run(() =>
      u.active ? deactivatePlatformUser(token as string, u.id) : reactivatePlatformUser(token as string, u.id),
    );
    if (updated) {
      put(updated);
      setDialog(null);
    }
  };

  return (
    <PageShell
      title="Platform users"
      actions={
        <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
          Add user
        </Button>
      }
    >
      {users.error && <Alert variant="danger" isInline title={users.error} />}
      {users.loading && !users.data ? (
        <Spinner aria-label="Loading users" />
      ) : (
        <Table aria-label="Platform users" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Username</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(users.data ?? []).map((u) => (
              <Tr key={u.id}>
                <Td dataLabel="Name">{u.name}</Td>
                <Td dataLabel="Username">{u.username}</Td>
                <Td dataLabel="Role">{u.role ? roleLabel(u.role.name) : '—'}</Td>
                <Td dataLabel="Status">
                  <StatusLabel active={u.active} />
                </Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      { title: 'Edit', onClick: () => setDialog({ kind: 'edit', user: u }) },
                      { title: 'Reset password', onClick: () => setDialog({ kind: 'reset', user: u }) },
                      {
                        title: u.active ? 'Deactivate' : 'Reactivate',
                        onClick: () => {
                          toggle.reset();
                          setDialog({ kind: 'toggle', user: u });
                        },
                      },
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {dialog?.kind === 'create' && (
        <PersonModal
          title="Add platform user"
          mode="create"
          roles={roles.data ?? []}
          submitLabel="Create"
          submit={(p) => createPlatformUser(token as string, p)}
          onSaved={showPassword}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'edit' && (
        <PersonModal
          title={`Edit ${dialog.user.name}`}
          mode="edit"
          initial={personOf(dialog.user)}
          initialRoleId={dialog.user.role?.id ?? ''}
          roles={roles.data ?? []}
          submitLabel="Save"
          submit={(p) =>
            updatePlatformUser(token as string, dialog.user.id, {
              name: p.name,
              email: p.email,
              mobileNumber: p.mobileNumber,
              roleId: p.roleId,
            })
          }
          onSaved={(u) => {
            put(u);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'reset' && (
        <ResetPasswordModal
          name={dialog.user.name}
          reset={(pw) => resetPlatformUserPassword(token as string, dialog.user.id, pw)}
          onDone={(password) => setDialog({ kind: 'password', username: dialog.user.username, password })}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'toggle' && (
        <ConfirmModal
          title={`${dialog.user.active ? 'Deactivate' : 'Reactivate'} ${dialog.user.name}?`}
          confirmLabel={dialog.user.active ? 'Deactivate' : 'Reactivate'}
          variant={dialog.user.active ? 'danger' : 'primary'}
          busy={toggle.busy}
          error={toggle.error}
          onConfirm={() => onToggle(dialog.user)}
          onCancel={() => setDialog(null)}
        >
          {dialog.user.active
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
