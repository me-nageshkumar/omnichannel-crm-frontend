import * as React from 'react';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { Workspace, createWorkspace, listWorkspaces, renameWorkspace, setWorkspaceEnabled } from '@app/api/workspaces';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { EnabledLabel } from '@app/admin/EnabledLabel';
import { useAction } from '@app/admin/useAction';
import { useAccess } from '@app/session/useAccess';
import { NameModal } from '@app/admin/NameModal';
import { PageShell } from '@app/admin/PageShell';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

type Dialog = { kind: 'create' } | { kind: 'rename'; brand: Workspace } | { kind: 'toggle'; brand: Workspace };

/** Customer Admin: the company's brands (workspaces). */
export const BrandsPage: React.FunctionComponent = () => {
  const { token, refreshUser } = useSession();
  const brands = useLoad(listWorkspaces);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const canEnable = useAccess().has('workspace:enable');
  const toggle = useAction();

  const saved = (brand: Workspace) => {
    brands.setData((list) => upsert(list ?? [], brand));
    setDialog(null);
    // the switcher and per-brand authorities come from /users/me
    refreshUser().catch(() => undefined);
  };

  const onToggle = async (brand: Workspace) => {
    const updated = await toggle.run(() => setWorkspaceEnabled(token as string, brand.id, Boolean(brand.disabled)));
    if (updated) saved(updated);
  };

  return (
    <PageShell
      title="Brands"
      actions={
        <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
          Add brand
        </Button>
      }
    >
      {brands.error && <Alert variant="danger" isInline title={brands.error} />}
      {brands.loading && !brands.data ? (
        <Spinner aria-label="Loading brands" />
      ) : (
        <Table aria-label="Brands" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(brands.data ?? []).map((b) => (
              <Tr key={b.id}>
                <Td dataLabel="Name">{b.name}</Td>
                <Td dataLabel="Status">
                  <EnabledLabel disabled={b.disabled} />
                </Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      { title: 'Rename', onClick: () => setDialog({ kind: 'rename', brand: b }) },
                      ...(canEnable
                        ? [
                            {
                              title: b.disabled ? 'Enable' : 'Disable',
                              onClick: () => {
                                toggle.reset();
                                setDialog({ kind: 'toggle', brand: b });
                              },
                            },
                          ]
                        : []),
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {dialog?.kind === 'create' && (
        <NameModal
          title="Add brand"
          submitLabel="Create"
          save={(name) => createWorkspace(token as string, name)}
          onSaved={saved}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'rename' && (
        <NameModal
          title={`Rename ${dialog.brand.name}`}
          current={dialog.brand.name}
          submitLabel="Save"
          save={(name) => renameWorkspace(token as string, dialog.brand.id, name)}
          onSaved={saved}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'toggle' && (
        <ConfirmModal
          title={`${dialog.brand.disabled ? 'Enable' : 'Disable'} ${dialog.brand.name}?`}
          confirmLabel={dialog.brand.disabled ? 'Enable' : 'Disable'}
          variant={dialog.brand.disabled ? 'primary' : 'danger'}
          busy={toggle.busy}
          error={toggle.error}
          onConfirm={() => onToggle(dialog.brand)}
          onCancel={() => setDialog(null)}
        >
          {dialog.brand.disabled
            ? 'Its people can use it again and its WhatsApp numbers can reconnect.'
            : 'Its people lose access to it and its WhatsApp numbers disconnect until it is enabled again.'}
        </ConfirmModal>
      )}
    </PageShell>
  );
};
