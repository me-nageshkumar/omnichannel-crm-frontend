import * as React from 'react';
import { Alert, Button, Spinner, Title } from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  ContactAttribute,
  ContactLabel,
  createAttribute,
  createLabel,
  deleteAttribute,
  deleteLabel,
  listAttributes,
  listLabels,
  updateAttribute,
  updateLabel,
} from '@app/api/contacts';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { FieldModal } from '@app/Contacts/FieldModal';
import { LabelChip } from '@app/Contacts/LabelChip';

type Dialog =
  | { kind: 'label'; existing?: ContactLabel }
  | { kind: 'attribute'; existing?: ContactAttribute }
  | { kind: 'delete-label'; item: ContactLabel }
  | { kind: 'delete-attribute'; item: ContactAttribute };

const contactsText = (n: number) => `${n} contact${n === 1 ? '' : 's'}`;

/** Labels and attributes of the current brand's contacts. */
export const ContactFieldsPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const labels = useLoad((tk) => listLabels(tk, ws), [ws]);
  const attributes = useLoad((tk) => listAttributes(tk, ws), [ws]);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const confirm = useAction();
  const close = () => setDialog(null);
  const open = (d: Dialog) => () => {
    confirm.reset();
    setDialog(d);
  };

  const onDelete = async (kind: 'label' | 'attribute', id: string) => {
    const done = await confirm.run(async () => {
      await (kind === 'label' ? deleteLabel(t, ws, id) : deleteAttribute(t, ws, id));
      return true;
    });
    if (!done) return;
    if (kind === 'label') labels.setData((l) => (l ?? []).filter((x) => x.id !== id));
    else attributes.setData((l) => (l ?? []).filter((x) => x.id !== id));
    close();
  };

  return (
    <PageShell
      title="Contact fields"
      actions={
        <>
          <Button variant="primary" onClick={() => setDialog({ kind: 'label' })}>
            Add label
          </Button>{' '}
          <Button variant="secondary" onClick={() => setDialog({ kind: 'attribute' })}>
            Add attribute
          </Button>
        </>
      }
    >
      <Title headingLevel="h2" size="md">
        Labels
      </Title>
      {labels.error && <Alert variant="danger" isInline title={labels.error} />}
      {labels.loading && !labels.data ? (
        <Spinner aria-label="Loading labels" />
      ) : (
        <Table aria-label="Labels" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th>Contacts</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(labels.data ?? []).map((l) => (
              <Tr key={l.id}>
                <Td dataLabel="Name">
                  <LabelChip label={l} />
                </Td>
                <Td dataLabel="Description">{l.description ?? '—'}</Td>
                <Td dataLabel="Contacts">{l.contactCount}</Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      { title: 'Edit', onClick: open({ kind: 'label', existing: l }) },
                      { title: 'Delete', onClick: open({ kind: 'delete-label', item: l }) },
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Title headingLevel="h2" size="md" style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
        Attributes
      </Title>
      {attributes.error && <Alert variant="danger" isInline title={attributes.error} />}
      {attributes.loading && !attributes.data ? (
        <Spinner aria-label="Loading attributes" />
      ) : (
        <Table aria-label="Attributes" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th>Contacts</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(attributes.data ?? []).map((a) => (
              <Tr key={a.id}>
                <Td dataLabel="Name">{a.name}</Td>
                <Td dataLabel="Description">{a.description ?? '—'}</Td>
                <Td dataLabel="Contacts">{a.contactCount}</Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      { title: 'Edit', onClick: open({ kind: 'attribute', existing: a }) },
                      { title: 'Delete', onClick: open({ kind: 'delete-attribute', item: a }) },
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {dialog?.kind === 'label' && (
        <FieldModal
          noun="label"
          withColor
          existing={dialog.existing}
          save={(v) => {
            const body = { name: v.name, color: v.color ?? 'blue', description: v.description };
            return dialog.existing ? updateLabel(t, ws, dialog.existing.id, body) : createLabel(t, ws, body);
          }}
          onSaved={(saved) => {
            labels.setData((l) => upsert(l ?? [], saved));
            close();
          }}
          onCancel={close}
        />
      )}
      {dialog?.kind === 'attribute' && (
        <FieldModal
          noun="attribute"
          existing={dialog.existing}
          save={(v) => {
            const body = { name: v.name, description: v.description };
            return dialog.existing ? updateAttribute(t, ws, dialog.existing.id, body) : createAttribute(t, ws, body);
          }}
          onSaved={(saved) => {
            attributes.setData((l) => upsert(l ?? [], saved));
            close();
          }}
          onCancel={close}
        />
      )}
      {(dialog?.kind === 'delete-label' || dialog?.kind === 'delete-attribute') && (
        <ConfirmModal
          title={`Delete ${dialog.item.name}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => onDelete(dialog.kind === 'delete-label' ? 'label' : 'attribute', dialog.item.id)}
          onCancel={close}
        >
          It is removed from {contactsText(dialog.item.contactCount)}.
        </ConfirmModal>
      )}
    </PageShell>
  );
};
