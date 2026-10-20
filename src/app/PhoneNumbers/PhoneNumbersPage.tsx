import * as React from 'react';
import { Alert, Button, Spinner } from '@patternfly/react-core';
import { ActionsColumn, IAction, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import {
  CONNECTION_LABELS,
  PhoneNumber,
  addNumber,
  deleteNumber,
  getConnectCode,
  listBrandNumbers,
  relabelNumber,
  revokeDevice,
  setNumberEnabled,
  shown,
} from '@app/api/phoneNumbers';
import { ConfirmModal } from '@app/admin/ConfirmModal';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { upsert, useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { ConnectCodeModal } from '@app/PhoneNumbers/ConnectCodeModal';
import { PhoneNumberModal } from '@app/PhoneNumbers/PhoneNumberModal';
import { PhoneNumberStatusLabel, relative } from '@app/PhoneNumbers/PhoneNumberStatusLabel';

/** How often the page refreshes connection status while open. */
export const POLL_MS = 10_000;

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; number: PhoneNumber }
  | { kind: 'code'; number: PhoneNumber }
  | { kind: 'revoke'; number: PhoneNumber }
  | { kind: 'toggle'; number: PhoneNumber }
  | { kind: 'delete'; number: PhoneNumber };

/** The current brand's WhatsApp numbers: onboard, connect a browser, enable/disable. */
export const PhoneNumbersPage: React.FunctionComponent = () => {
  const { token, workspace } = useSession();
  const workspaceId = workspace?.id ?? '';
  const canManage = useAccess().hasInWorkspace('phone-number:manage');
  const numbers = useLoad((t) => listBrandNumbers(t, workspaceId), [workspaceId]);
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const confirm = useAction();
  const t = token as string;

  const { reload } = numbers;
  React.useEffect(() => {
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  const put = (n: PhoneNumber) => numbers.setData((list) => upsert(list ?? [], n));
  const close = () => setDialog(null);
  const runConfirm = async (fn: () => Promise<PhoneNumber | true>, remove?: string) => {
    const done = await confirm.run(fn);
    if (!done) return;
    if (remove) numbers.setData((list) => (list ?? []).filter((x) => x.id !== remove));
    else if (done !== true) put(done);
    close();
  };

  const actionsFor = (n: PhoneNumber): IAction[] => {
    const open = (d: Dialog) => () => {
      confirm.reset();
      setDialog(d);
    };
    return [
      { title: 'Edit label', onClick: open({ kind: 'edit', number: n }) },
      { title: 'Get connect code', onClick: open({ kind: 'code', number: n }) },
      ...(n.hasDevice ? [{ title: 'Revoke device', onClick: open({ kind: 'revoke', number: n }) }] : []),
      { title: n.disabled ? 'Enable' : 'Disable', onClick: open({ kind: 'toggle', number: n }) },
      { title: 'Delete', onClick: open({ kind: 'delete', number: n }) },
    ];
  };

  return (
    <PageShell
      title="Phone numbers"
      actions={
        canManage && (
          <Button variant="primary" onClick={() => setDialog({ kind: 'add' })}>
            Add number
          </Button>
        )
      }
    >
      {numbers.error && <Alert variant="danger" isInline title={numbers.error} />}
      {numbers.loading && !numbers.data ? (
        <Spinner aria-label="Loading phone numbers" />
      ) : (
        <Table aria-label="Phone numbers" variant="compact">
          <Thead>
            <Tr>
              <Th>Number</Th>
              <Th>Label</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Last seen</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {(numbers.data ?? []).map((n) => (
              <Tr key={n.id}>
                <Td dataLabel="Number">{shown(n.number)}</Td>
                <Td dataLabel="Label">{n.label ?? '—'}</Td>
                <Td dataLabel="Type">{CONNECTION_LABELS[n.connectionType] ?? n.connectionType}</Td>
                <Td dataLabel="Status">
                  <PhoneNumberStatusLabel number={n} />
                </Td>
                <Td dataLabel="Last seen">{n.lastSeenAt ? relative(n.lastSeenAt) : '—'}</Td>
                <Td isActionCell>{canManage && <ActionsColumn items={actionsFor(n)} />}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {dialog?.kind === 'add' && (
        <PhoneNumberModal
          save={(number, label) => addNumber(t, workspaceId, number, label)}
          onSaved={(n) => {
            put(n);
            close();
          }}
          onCancel={close}
        />
      )}
      {dialog?.kind === 'edit' && (
        <PhoneNumberModal
          existing={dialog.number}
          save={(_number, label) => relabelNumber(t, workspaceId, dialog.number.id, label)}
          onSaved={(n) => {
            put(n);
            close();
          }}
          onCancel={close}
        />
      )}
      {dialog?.kind === 'code' && (
        <ConnectCodeModal
          number={dialog.number}
          fetchCode={() => getConnectCode(t, workspaceId, dialog.number.id)}
          onClose={() => {
            close();
            reload();
          }}
        />
      )}
      {dialog?.kind === 'revoke' && (
        <ConfirmModal
          title={`Revoke the device of ${shown(dialog.number.number)}?`}
          confirmLabel="Revoke"
          variant="danger"
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() => runConfirm(() => revokeDevice(t, workspaceId, dialog.number.id))}
          onCancel={close}
        >
          The connected browser is disconnected. It needs a new connect code to connect again.
        </ConfirmModal>
      )}
      {dialog?.kind === 'toggle' && (
        <ConfirmModal
          title={`${dialog.number.disabled ? 'Enable' : 'Disable'} ${shown(dialog.number.number)}?`}
          confirmLabel={dialog.number.disabled ? 'Enable' : 'Disable'}
          variant={dialog.number.disabled ? 'primary' : 'danger'}
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() =>
            runConfirm(() => setNumberEnabled(t, workspaceId, dialog.number.id, Boolean(dialog.number.disabled)))
          }
          onCancel={close}
        >
          {dialog.number.disabled
            ? 'Its browser can connect again with the key it already has.'
            : 'Its browser is disconnected and cannot reconnect until the number is enabled again.'}
        </ConfirmModal>
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmModal
          title={`Delete ${shown(dialog.number.number)}?`}
          confirmLabel="Delete"
          variant="danger"
          busy={confirm.busy}
          error={confirm.error}
          onConfirm={() =>
            runConfirm(async () => {
              await deleteNumber(t, workspaceId, dialog.number.id);
              return true;
            }, dialog.number.id)
          }
          onCancel={close}
        >
          Its device is disconnected and its connect code stops working.
        </ConfirmModal>
      )}
    </PageShell>
  );
};
