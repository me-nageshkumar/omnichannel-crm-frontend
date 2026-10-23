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
  Radio,
} from '@patternfly/react-core';
import { closeDeal } from '@app/api/crm';
import type { Deal, Picklist } from '@app/api/crm';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { Field } from '@app/Crm/deals/fields';
import { isCode } from '@app/Crm/Settings/ConflictAlert';

/** Closes an open deal as won, or as lost with one of the active lost reasons. */
export const CloseDealModal: React.FunctionComponent<{
  deal: Deal;
  lostReasons: Picklist;
  onClosed(deal: Deal): void;
  onClose(): void;
}> = ({ deal, lostReasons, onClosed, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const reasons = lostReasons.filter((r) => r.active).sort((a, b) => a.position - b.position);
  const [outcome, setOutcome] = React.useState<'WON' | 'LOST'>('WON');
  const [reason, setReason] = React.useState('');
  const [conflict, setConflict] = React.useState(false);
  const action = useAction(['outcome', 'lostReason']);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setConflict(false);
    const closed = await action.run(
      () =>
        closeDeal(token as string, ws, deal.id, {
          outcome,
          ...(outcome === 'LOST' && reason ? { lostReason: reason } : {}),
        }),
      (e) => {
        if (isCode(e, 'VERSION_CONFLICT')) {
          setConflict(true);
          return '';
        }
        return (e as { serverMessage?: string }).serverMessage ?? 'Could not close the deal. Try again.';
      },
    );
    if (closed) onClosed(closed);
  };

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="crm-close-title">
      <ModalHeader title="Close deal" labelId="crm-close-title" />
      <ModalBody>
        {conflict && (
          <Alert
            variant="warning"
            isInline
            isPlain
            title="Someone else changed this deal. Close this window and open the deal again to see their changes."
          />
        )}
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="crm-close-form" onSubmit={submit}>
          <Radio id="crm-close-won" name="outcome" label="Won" isChecked={outcome === 'WON'} onChange={() => setOutcome('WON')} />
          <Radio id="crm-close-lost" name="outcome" label="Lost" isChecked={outcome === 'LOST'} onChange={() => setOutcome('LOST')} />
          {outcome === 'LOST' && reasons.length > 0 && (
            <Field label="Lost reason" fieldId="crm-close-reason" error={action.fieldErrors.lostReason}>
              <FormSelect id="crm-close-reason" value={reason} onChange={(_e, v) => setReason(v)}>
                <FormSelectOption value="" label="No reason" />
                {reasons.map((r) => (
                  <FormSelectOption key={r.key} value={r.key} label={r.label} />
                ))}
              </FormSelect>
            </Field>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={() => submit()} isLoading={action.busy} isDisabled={action.busy}>
          Close deal
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
