import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { moveChannel } from '@app/api/crm';
import type { CrmContact, CrmPhone } from '@app/api/crm';
import { ApiError } from '@app/api/client';
import { useAction } from '@app/admin/useAction';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';
import { Field } from '@app/Crm/deals/fields';
import { CHANNEL_TAKEN_MESSAGE } from '@app/Crm/Contacts/contactColumns';

/** Moves {@code contact} to another of the brand's {@code numbers} (never the one it is on), with an optional reason. */
export const MoveChannelModal: React.FunctionComponent<{
  contact: CrmContact;
  numbers: CrmPhone[];
  onMoved(contact: CrmContact): void;
  /** The server refused because the contact changed meanwhile; the caller fetches the fresh one. */
  onConflict?(): void;
  onClose(): void;
}> = ({ contact, numbers, onMoved, onConflict, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  // The version the dialog opened on; a refetch while it is open must not advance it.
  const [version] = React.useState(contact.version);
  const targets = numbers.filter((n) => n.phoneNumberId !== contact.channel?.phoneNumberId);
  const [target, setTarget] = React.useState(targets[0]?.phoneNumberId ?? '');
  const [reason, setReason] = React.useState('');
  const action = useAction();

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!target) return;
    const moved = await action.run(
      () =>
        moveChannel(token as string, ws, contact.id, {
          toPhoneNumberId: target,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          version,
        }),
      (e) => {
        if (e instanceof ApiError && e.status === 409 && e.code === 'CHANNEL_TAKEN') return CHANNEL_TAKEN_MESSAGE;
        if (e instanceof ApiError && e.status === 409 && e.code === 'VERSION_CONFLICT') {
          onConflict?.();
          return 'Someone else changed this contact. Close this and open it again.';
        }
        return messageFor(e);
      },
    );
    if (moved) onMoved(moved);
  };

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="crm-move-title">
      <ModalHeader title="Move channel" labelId="crm-move-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="crm-move-form" onSubmit={onSubmit}>
          <Field label="Move to" fieldId="crm-move-to">
            <FormSelect id="crm-move-to" value={target} onChange={(_e, v) => setTarget(v)}>
              {targets.map((n) => (
                <FormSelectOption
                  key={n.phoneNumberId}
                  value={n.phoneNumberId}
                  label={n.label ? `${n.label} (${n.number})` : n.number}
                />
              ))}
            </FormSelect>
          </Field>
          <Field label="Reason" fieldId="crm-move-reason">
            <TextInput id="crm-move-reason" value={reason} maxLength={200} onChange={(_e, v) => setReason(v)} />
          </Field>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="crm-move-form" isDisabled={action.busy || !target} isLoading={action.busy}>
          Move
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
