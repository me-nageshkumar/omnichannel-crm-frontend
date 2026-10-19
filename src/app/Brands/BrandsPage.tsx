import * as React from 'react';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { Workspace, createWorkspace, listWorkspaces, renameWorkspace } from '@app/api/workspaces';
import { NameModal } from '@app/admin/NameModal';
import { PageShell } from '@app/admin/PageShell';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

type Dialog = { kind: 'create' } | { kind: 'rename'; brand: Workspace };

/** Customer Admin: the company's brands (workspaces). */
export const BrandsPage: React.FunctionComponent = () => {
  const { token, refreshUser } = useSession();
  const brands = useLoad(listWorkspaces);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);

  const saved = (brand: Workspace) => {
    brands.setData((list) => upsert(list ?? [], brand));
    setDialog(null);
    // the switcher and per-brand authorities come from /users/me
    refreshUser().catch(() => undefined);
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
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(brands.data ?? []).map((b) => (
              <Tr key={b.id}>
                <Td dataLabel="Name">{b.name}</Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[{ title: 'Rename', onClick: () => setDialog({ kind: 'rename', brand: b }) }]}
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
    </PageShell>
  );
};
