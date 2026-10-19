import * as React from 'react';
import { Alert, Button, Label, Spinner, Stack, StackItem, Title } from '@patternfly/react-core';
import { ActionsColumn, IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  LEVEL_LABELS,
  ROLE_LEVELS,
  Role,
  SUPER_ADMIN_ROLE,
  deleteRole,
  listAuthorities,
  listRoles,
} from '@app/api/roles';
import { roleLabel } from '@app/api/users';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { RoleEditor } from '@app/Roles/RoleEditor';
import { RoleHistoryModal } from '@app/Roles/RoleHistoryModal';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; role: Role }
  | { kind: 'history'; role: Role }
  | { kind: 'delete'; role: Role };

/** Super Admin: which authorities each role holds, plus custom roles. */
export const RolesPage: React.FunctionComponent = () => {
  const { token } = useSession();
  const roles = useLoad(listRoles);
  const authorities = useLoad(listAuthorities);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const remove = useAction();

  const actionsFor = (role: Role): IAction[] => {
    const items: IAction[] = [
      { title: 'Edit', onClick: () => setDialog({ kind: 'edit', role }) },
      { title: 'History', onClick: () => setDialog({ kind: 'history', role }) },
    ];
    if (!role.builtIn && role.userCount === 0) {
      items.push({
        title: 'Delete',
        onClick: () => {
          remove.reset();
          setDialog({ kind: 'delete', role });
        },
      });
    }
    return items;
  };

  const onDelete = async (role: Role) => {
    const done = await remove.run(async () => {
      await deleteRole(token as string, role.id);
      return true;
    });
    if (done) {
      roles.setData((list) => (list ?? []).filter((r) => r.id !== role.id));
      setDialog(null);
    }
  };

  const byLevel = (level: string) =>
    (roles.data ?? []).filter((r) => r.level === level).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell
      title="Roles"
      actions={
        <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
          Add role
        </Button>
      }
    >
      {roles.error && <Alert variant="danger" isInline title={roles.error} />}
      {authorities.error && <Alert variant="danger" isInline title={authorities.error} />}
      {roles.loading && !roles.data ? (
        <Spinner aria-label="Loading roles" />
      ) : (
        <Stack hasGutter>
          {ROLE_LEVELS.map((level) => (
            <StackItem key={level}>
              <Title headingLevel="h2" size="md">
                {`${LEVEL_LABELS[level]} roles`}
              </Title>
              <Table aria-label={`${LEVEL_LABELS[level]} roles`} variant="compact">
                <Thead>
                  <Tr>
                    <Th width={25}>Name</Th>
                    <Th>Description</Th>
                    <Th width={15}>Authorities</Th>
                    <Th width={10}>Users</Th>
                    <Th screenReaderText="Actions" />
                  </Tr>
                </Thead>
                <Tbody>
                  {byLevel(level).map((r) => {
                    const superAdmin = r.name === SUPER_ADMIN_ROLE;
                    return (
                      <Tr key={r.id}>
                        <Td dataLabel="Name">
                          {roleLabel(r.name)}{' '}
                          {r.builtIn && (
                            <Label isCompact color="blue">
                              Built-in
                            </Label>
                          )}
                        </Td>
                        <Td dataLabel="Description">{r.description}</Td>
                        <Td dataLabel="Authorities">{superAdmin ? 'All authorities' : r.authorities.length}</Td>
                        <Td dataLabel="Users">{r.userCount}</Td>
                        <Td isActionCell>{!superAdmin && <ActionsColumn items={actionsFor(r)} />}</Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </StackItem>
          ))}
        </Stack>
      )}

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <RoleEditor
          role={dialog.kind === 'edit' ? dialog.role : null}
          authorities={authorities.data}
          onSaved={(saved) => {
            roles.setData((list) => upsert(list ?? [], saved));
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'history' && <RoleHistoryModal role={dialog.role} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={`Delete ${roleLabel(dialog.role.name)}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={remove.busy}
          error={remove.error}
          onConfirm={() => onDelete(dialog.role)}
          onCancel={() => setDialog(null)}
        >
          The role is removed. Nobody holds it, so no one loses access.
        </ConfirmModal>
      )}
    </PageShell>
  );
};
