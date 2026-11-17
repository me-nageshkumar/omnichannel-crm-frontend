import * as React from 'react';
import {
  Alert,
  Button,
  Label,
  List,
  ListItem,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { ActionsColumn, type IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { type FeatureGroup, deleteGroup, groupHistory, listGroups, listUngrouped } from '@app/api/billing';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useAccess } from '@app/session/useAccess';
import { useSession } from '@app/session/SessionContext';
import { BillingHistoryModal } from '@app/Billing/platform/BillingHistoryModal';
import { FeatureGroupModal } from '@app/Billing/platform/FeatureGroupModal';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; group: FeatureGroup }
  | { kind: 'history'; group: FeatureGroup }
  | { kind: 'delete'; group: FeatureGroup };

const byOrder = (a: FeatureGroup, b: FeatureGroup) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code);

/** Why a delete was refused, naming the plans in the way when the server gave them. */
function deleteError(e: unknown): string {
  if (e instanceof ApiError && e.code === 'GROUP_IN_USE') {
    return e.extra?.plans ? `Used by plans: ${e.extra.plans}` : 'A customer holds this group; it cannot be deleted.';
  }
  return messageFor(e);
}

/** The feature groups plans are made of. */
export const FeatureGroupsTab: React.FunctionComponent = () => {
  const { token } = useSession();
  const canManage = useAccess().has('plan:manage');
  const groups = useLoad(listGroups);
  const ungrouped = useLoad(listUngrouped);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const remove = useAction();

  const all = (groups.data ?? []).slice().sort(byOrder);
  const nameOf = (code: string) => all.find((g) => g.code === code)?.name ?? code;

  const saved = (g: FeatureGroup) => {
    groups.setData((list) => [...(list ?? []).filter((x) => x.code !== g.code), g]);
    ungrouped.reload();
    setDialog(null);
  };

  const onDelete = async (g: FeatureGroup) => {
    const done = await remove.run(async () => {
      await deleteGroup(token as string, g.code);
      return true;
    }, deleteError);
    if (done) {
      groups.setData((list) => (list ?? []).filter((x) => x.code !== g.code));
      ungrouped.reload();
      setDialog(null);
    }
  };

  const actionsOf = (g: FeatureGroup): IAction[] => {
    const history: IAction = { title: 'History', onClick: () => setDialog({ kind: 'history', group: g }) };
    if (!canManage) return [history];
    const actions: IAction[] = [{ title: 'Edit', onClick: () => setDialog({ kind: 'edit', group: g }) }, history];
    if (!g.builtIn) {
      actions.push({
        title: 'Delete',
        onClick: () => {
          remove.reset();
          setDialog({ kind: 'delete', group: g });
        },
      });
    }
    return actions;
  };

  const loose = ungrouped.data ?? [];

  return (
    <>
      {groups.error && <Alert variant="danger" isInline title={groups.error} />}
      {loose.length > 0 && (
        <Alert
          variant="warning"
          isInline
          title={`${loose.length} ${loose.length === 1 ? 'permission is' : 'permissions are'} in no group, so no customer on a plan can use ${loose.length === 1 ? 'it' : 'them'}`}
        >
          <List isPlain>
            {loose.map((a) => (
              <ListItem key={a.code}>
                <code>{a.code}</code> {a.description}
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
      {canManage && (
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
                Add feature group
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      )}
      {groups.loading && !groups.data ? (
        <Spinner aria-label="Loading feature groups" />
      ) : (
        <Table aria-label="Feature groups" variant="compact">
          <Thead>
            <Tr>
              <Th width={20}>Name</Th>
              <Th width={15}>Code</Th>
              <Th width={10}>Category</Th>
              <Th width={10}>Permissions</Th>
              <Th width={15}>Requires</Th>
              <Th>Plans</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {all.map((g) => (
              <Tr key={g.code}>
                <Td dataLabel="Name">{g.name}</Td>
                <Td dataLabel="Code">
                  <code>{g.code}</code>
                </Td>
                <Td dataLabel="Category">
                  <Label isCompact color={g.category === 'DEFAULT' ? 'grey' : 'blue'}>
                    {g.category === 'DEFAULT' ? 'Default' : 'Paid'}
                  </Label>
                </Td>
                <Td dataLabel="Permissions">{g.authorities.length}</Td>
                <Td dataLabel="Requires">{g.requires.map(nameOf).join(', ')}</Td>
                <Td dataLabel="Plans">{g.planCodes.join(', ')}</Td>
                <Td isActionCell>
                  <ActionsColumn items={actionsOf(g)} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      {dialog?.kind === 'create' && (
        <FeatureGroupModal group={null} groups={all} onSaved={saved} onCancel={() => setDialog(null)} />
      )}
      {dialog?.kind === 'edit' && (
        <FeatureGroupModal group={dialog.group} groups={all} onSaved={saved} onCancel={() => setDialog(null)} />
      )}
      {dialog?.kind === 'history' && (
        <BillingHistoryModal
          title={`History of ${dialog.group.name}`}
          load={(t) => groupHistory(t, dialog.group.code)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={`Delete ${dialog.group.name}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={remove.busy}
          error={remove.error}
          onConfirm={() => void onDelete(dialog.group)}
          onCancel={() => setDialog(null)}
        >
          Its permissions will be in no group, so no customer on a plan will be able to use them.
        </ConfirmModal>
      )}
    </>
  );
};
