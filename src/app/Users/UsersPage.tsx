import * as React from 'react';
import { Alert, Button, Label, Spinner } from '@patternfly/react-core';
import { ActionsColumn, IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { UserSummary, roleLabel } from '@app/api/users';
import {
  WorkspaceUser,
  listWorkspaceUsers,
  removeWorkspaceUser,
  resetWorkspaceUserPassword,
  setCompanyUserActive,
  updateWorkspaceUser,
  workspaceAssignableRoles,
} from '@app/api/workspaceUsers';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { PersonModal, personOf } from '@app/admin/PersonModal';
import { ResetPasswordModal } from '@app/admin/ResetPasswordModal';
import { StatusLabel } from '@app/admin/StatusLabel';
import { TemporaryPasswordModal } from '@app/admin/TemporaryPasswordModal';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { AddUserModal } from '@app/Users/AddUserModal';

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; user: WorkspaceUser }
  | { kind: 'reset'; user: WorkspaceUser }
  | { kind: 'remove'; user: WorkspaceUser }
  | { kind: 'toggle'; user: WorkspaceUser }
  | { kind: 'password'; username: string; password: string };

const roleHere = (u: UserSummary, workspaceId: string) =>
  u.workspaceRoles.find((r) => r.workspaceId === workspaceId)?.role ?? null;

/** The people with access to the current brand. */
export const UsersPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const access = useAccess();
  const workspaceId = workspace?.id ?? '';
  const canManage = access.hasInWorkspace('user:manage');
  const canDeactivate = access.has('company-user:manage');
  const users = useLoad((t) => listWorkspaceUsers(t, workspaceId), [workspaceId]);
  const roles = useLoad(
    (t) => (canManage ? workspaceAssignableRoles(t, workspaceId) : Promise.resolve([])),
    [workspaceId, canManage],
  );
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const confirm = useAction();
  const t = token as string;

  /** Merges a server echo, keeping the list-only flags. */
  const put = (
    u: UserSummary,
    flags: Pick<WorkspaceUser, 'allBrands' | 'manageable'> = { allBrands: false, manageable: true },
  ) =>
    users.setData((list) => {
      const current = list ?? [];
      const old = current.find((x) => x.id === u.id);
      const next = { ...(old ?? flags), ...u } as WorkspaceUser;
      return old ? current.map((x) => (x.id === u.id ? next : x)) : [...current, next];
    });
  const onRemove = async (u: WorkspaceUser) => {
    const done = await confirm.run(async () => {
      await removeWorkspaceUser(t, workspaceId, u.id);
      return true;
    });
    if (done) {
      users.setData((list) => (list ?? []).filter((x) => x.id !== u.id));
      setDialog(null);
    }
  };
  const onToggle = async (u: WorkspaceUser) => {
    const updated = await confirm.run(() => setCompanyUserActive(t, u.id, !u.active));
    if (updated) {
      put(updated);
      setDialog(null);
    }
  };

  const actionsFor = (u: WorkspaceUser): IAction[] => {
    const open = (d: Dialog) => () => {
      confirm.reset();
      setDialog(d);
    };
    const items: IAction[] = [];
    if (canManage) {
      items.push(
        { title: 'Edit', onClick: open({ kind: 'edit', user: u }) },
        { title: 'Reset password', onClick: open({ kind: 'reset', user: u }) },
      );
      if (!u.allBrands) items.push({ title: 'Remove from brand', onClick: open({ kind: 'remove', user: u }) });
    }
    if (canDeactivate)
      items.push({ title: u.active ? 'Deactivate' : 'Reactivate', onClick: open({ kind: 'toggle', user: u }) });
    return items;
  };

  return (
    <PageShell
      title="Users"
      actions={
        canManage && (
          <Button variant="primary" onClick={() => setDialog({ kind: 'add' })}>
            Add user
          </Button>
        )
      }
    >
      {users.error && <Alert variant="danger" isInline title={users.error} />}
      {users.loading && !users.data ? (
        <Spinner aria-label="Loading users" />
      ) : (
        <Table aria-label="Users" variant="compact">
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
            {(users.data ?? []).map((u) => {
              const role = roleHere(u, workspaceId);
              const actions = u.manageable ? actionsFor(u) : [];
              return (
                <Tr key={u.id}>
                  <Td dataLabel="Name">{u.name}</Td>
                  <Td dataLabel="Username">{u.username}</Td>
                  <Td dataLabel="Role">
                    {u.allBrands ? (
                      <Label isCompact color="purple">
                        All brands
                      </Label>
                    ) : role ? (
                      roleLabel(role.name)
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td dataLabel="Status">
                    <StatusLabel active={u.active} />
                  </Td>
                  <Td isActionCell>{actions.length > 0 && <ActionsColumn items={actions} />}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}

      {dialog?.kind === 'add' && (
        <AddUserModal
          workspaceId={workspaceId}
          present={users.data ?? []}
          roles={roles.data ?? []}
          onAdded={(added) => {
            put(added.user);
            if (added.temporaryPassword) {
              setDialog({ kind: 'password', username: added.user.username, password: added.temporaryPassword });
            } else {
              setDialog(null);
            }
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'edit' && (
        <PersonModal
          title={`Edit ${dialog.user.name}`}
          mode="edit"
          initial={personOf(dialog.user)}
          initialRoleId={roleHere(dialog.user, workspaceId)?.id ?? ''}
          roles={dialog.user.allBrands ? undefined : (roles.data ?? [])}
          submitLabel="Save"
          submit={(p) =>
            updateWorkspaceUser(t, workspaceId, dialog.user.id, {
              name: p.name,
              email: p.email,
              mobileNumber: p.mobileNumber,
              // all-brands people have no role here to change
              roleId: dialog.user.allBrands ? null : p.roleId,
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
          reset={(pw) => resetWorkspaceUserPassword(t, workspaceId, dialog.user.id, pw)}
          onDone={(password) => setDialog({ kind: 'password', username: dialog.user.username, password })}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <ConfirmModal
          title={`Remove ${dialog.user.name} from ${workspace?.name ?? 'this brand'}?`}
          confirmLabel="Remove"
          variant="danger"
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => onRemove(dialog.user)}
          onCancel={() => setDialog(null)}
        >
          They lose their role in this brand and leave its teams. Their other brands are not affected.
        </ConfirmModal>
      )}
      {dialog?.kind === 'toggle' && (
        <ConfirmModal
          title={`${dialog.user.active ? 'Deactivate' : 'Reactivate'} ${dialog.user.name}?`}
          confirmLabel={dialog.user.active ? 'Deactivate' : 'Reactivate'}
          variant={dialog.user.active ? 'danger' : 'primary'}
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => onToggle(dialog.user)}
          onCancel={() => setDialog(null)}
        >
          {dialog.user.active
            ? 'They will be logged out of every brand and unable to log in until reactivated.'
            : 'They will be able to log in again.'}
        </ConfirmModal>
      )}
      {dialog?.kind === 'password' && (
        <TemporaryPasswordModal username={dialog.username} password={dialog.password} onClose={() => setDialog(null)} />
      )}
    </PageShell>
  );
};
