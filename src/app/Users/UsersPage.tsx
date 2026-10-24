import * as React from 'react';
import { Alert, Button, Label, Spinner } from '@patternfly/react-core';
import { ActionsColumn, IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { UserSummary, roleLabel } from '@app/api/users';
import {
  WorkspaceUser,
  listWorkspaceUsers,
  removeWorkspaceUser,
  resetWorkspaceUserPassword,
  setBrandAccessEnabled,
  setCompanyUserEnabled,
  updateWorkspaceUser,
  workspaceAssignableRoles,
} from '@app/api/workspaceUsers';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { PersonModal, personOf } from '@app/admin/PersonModal';
import { ResetPasswordModal } from '@app/admin/ResetPasswordModal';
import { EnabledLabel } from '@app/admin/EnabledLabel';
import { TemporaryPasswordModal } from '@app/admin/TemporaryPasswordModal';
import { UserPipelinesModal } from '@app/Crm/access/UserPipelinesModal';
import { useCrmCan, useCrmStatus } from '@app/Crm/status/CrmStatusContext';
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
  | { kind: 'toggleBrand'; user: WorkspaceUser }
  | { kind: 'crmPipelines'; user: WorkspaceUser }
  | { kind: 'password'; username: string; password: string };

const roleHere = (u: UserSummary, workspaceId: string) =>
  u.workspaceRoles.find((r) => r.workspaceId === workspaceId)?.role ?? null;

/** The people with access to the current brand. */
export const UsersPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const access = useAccess();
  const workspaceId = workspace?.id ?? '';
  const canManage = access.hasInWorkspace('user:manage');
  const canDisable = access.has('company-user:manage');
  const canDisableHere = access.hasInWorkspace('user:enable');
  const users = useLoad((t) => listWorkspaceUsers(t, workspaceId), [workspaceId]);
  const roles = useLoad(
    (t) => (canManage ? workspaceAssignableRoles(t, workspaceId) : Promise.resolve([])),
    [workspaceId, canManage],
  );
  const crmEnabled = useCrmStatus().status?.enabled === true;
  const canAssignPipelines = useCrmCan('crm:settings') && crmEnabled;
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
    const updated = await confirm.run(() => setCompanyUserEnabled(t, u.id, !u.active));
    if (updated) {
      put(updated);
      setDialog(null);
    }
  };

  const onToggleBrand = async (u: WorkspaceUser) => {
    const updated = await confirm.run(() => setBrandAccessEnabled(t, workspaceId, u.id, Boolean(u.brandDisabled)));
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
    if (canDisableHere && !u.allBrands) {
      items.push({
        title: u.brandDisabled ? 'Enable in this brand' : 'Disable in this brand',
        onClick: open({ kind: 'toggleBrand', user: u }),
      });
    }
    if (canAssignPipelines) items.push({ title: 'CRM pipelines…', onClick: open({ kind: 'crmPipelines', user: u }) });
    if (canDisable) items.push({ title: u.active ? 'Disable' : 'Enable', onClick: open({ kind: 'toggle', user: u }) });
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
                    <EnabledLabel disabled={u.disabled} active={u.active} />{' '}
                    {u.brandDisabled && <EnabledLabel disabled={u.brandDisabled} text="Disabled in this brand" />}
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
          title={`${dialog.user.active ? 'Disable' : 'Enable'} ${dialog.user.name}?`}
          confirmLabel={dialog.user.active ? 'Disable' : 'Enable'}
          variant={dialog.user.active ? 'danger' : 'primary'}
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => onToggle(dialog.user)}
          onCancel={() => setDialog(null)}
        >
          {dialog.user.active
            ? 'They will be logged out of every brand and unable to log in until enabled again.'
            : 'They will be able to log in again.'}
        </ConfirmModal>
      )}
      {dialog?.kind === 'toggleBrand' && (
        <ConfirmModal
          title={`${dialog.user.brandDisabled ? 'Enable' : 'Disable'} ${dialog.user.name} in ${workspace?.name}?`}
          confirmLabel={dialog.user.brandDisabled ? 'Enable' : 'Disable'}
          variant={dialog.user.brandDisabled ? 'primary' : 'danger'}
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => onToggleBrand(dialog.user)}
          onCancel={() => setDialog(null)}
        >
          {dialog.user.brandDisabled
            ? `${dialog.user.name} can use ${workspace?.name} again.`
            : `${dialog.user.name} loses access to ${workspace?.name} until enabled. Their other brands are not affected.`}
        </ConfirmModal>
      )}
      {dialog?.kind === 'crmPipelines' && <UserPipelinesModal user={dialog.user} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'password' && (
        <TemporaryPasswordModal username={dialog.username} password={dialog.password} onClose={() => setDialog(null)} />
      )}
    </PageShell>
  );
};
