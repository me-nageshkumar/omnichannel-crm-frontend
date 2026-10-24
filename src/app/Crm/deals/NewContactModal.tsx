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
import { createContact } from '@app/api/crm';
import type { CaptureResult, CrmPhone } from '@app/api/crm';
import { NUMBER_PATTERN, normaliseNumber } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { Field } from '@app/Crm/deals/fields';

const FIELDS = ['phone', 'phoneNumberId', 'firstName', 'lastName', 'dealTitle'];

export const phoneText = (p: CrmPhone): string => (p.label ? `${p.label} (${p.number})` : p.number);

/** Adds a WhatsApp contact to a pipeline, with a deal, on one of the brand's numbers. */
export const NewContactModal: React.FunctionComponent<{
  pipelineId: string;
  pipelineName?: string;
  /** The brand's numbers; only those the user can chat from are offered. */
  numbers: CrmPhone[];
  onCreated(result: CaptureResult): void;
  onClose(): void;
}> = ({ pipelineId, pipelineName, numbers, onCreated, onClose }) => {
  const { token, workspace } = useSession();
  const offered = numbers.filter((n) => n.canChat);
  const [phone, setPhone] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [channel, setChannel] = React.useState(offered[0]?.phoneNumberId ?? '');
  const [dealTitle, setDealTitle] = React.useState('');
  const [checked, setChecked] = React.useState(false);
  const action = useAction(FIELDS);

  const digits = normaliseNumber(phone);
  const phoneError = checked && !NUMBER_PATTERN.test(digits) ? 'Use 8 to 15 digits, country code first.' : null;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    if (!NUMBER_PATTERN.test(digits) || !channel) return;
    const text = (v: string) => (v.trim() ? v.trim() : undefined);
    const result = await action.run(() =>
      createContact(token as string, workspace?.id ?? '', {
        phone: digits,
        phoneNumberId: channel,
        firstName: text(firstName),
        lastName: text(lastName),
        pipelineId,
        dealTitle: text(dealTitle),
      }),
    );
    if (result) onCreated(result);
  };

  const errors = action.fieldErrors;
  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="crm-new-contact-title">
      <ModalHeader
        title="New contact"
        labelId="crm-new-contact-title"
        description={pipelineName ? `Into the ${pipelineName} pipeline` : undefined}
      />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="crm-new-contact-form" onSubmit={onSubmit}>
          <Field
            label="WhatsApp number"
            fieldId="crm-nc-phone"
            isRequired
            error={phoneError ?? errors.phone}
            help="Country code first, e.g. 919812345678"
          >
            <TextInput
              id="crm-nc-phone"
              value={phone}
              inputMode="numeric"
              placeholder="919812345678"
              validated={phoneError ?? errors.phone ? 'error' : 'default'}
              onChange={(_e, v) => setPhone(v)}
            />
          </Field>
          <Field label="First name" fieldId="crm-nc-first" error={errors.firstName}>
            <TextInput
              id="crm-nc-first"
              value={firstName}
              maxLength={100}
              validated={errors.firstName ? 'error' : 'default'}
              onChange={(_e, v) => setFirstName(v)}
            />
          </Field>
          <Field label="Last name" fieldId="crm-nc-last" error={errors.lastName}>
            <TextInput
              id="crm-nc-last"
              value={lastName}
              maxLength={100}
              validated={errors.lastName ? 'error' : 'default'}
              onChange={(_e, v) => setLastName(v)}
            />
          </Field>
          <Field
            label="Channel number"
            fieldId="crm-nc-channel"
            isRequired
            error={errors.phoneNumberId ?? (checked && !channel ? 'Choose the number to chat from.' : null)}
            help={offered.length === 0 ? 'No number is available to chat from.' : undefined}
          >
            <FormSelect
              id="crm-nc-channel"
              value={channel}
              isDisabled={offered.length === 0}
              onChange={(_e, v) => setChannel(v)}
            >
              {offered.map((n) => (
                <FormSelectOption key={n.phoneNumberId} value={n.phoneNumberId} label={phoneText(n)} />
              ))}
            </FormSelect>
          </Field>
          <Field
            label="Deal title"
            fieldId="crm-nc-deal"
            error={errors.dealTitle}
            help="Optional. Defaults to the contact's name."
          >
            <TextInput
              id="crm-nc-deal"
              value={dealTitle}
              maxLength={200}
              validated={errors.dealTitle ? 'error' : 'default'}
              onChange={(_e, v) => setDealTitle(v)}
            />
          </Field>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="crm-new-contact-form" isDisabled={action.busy} isLoading={action.busy}>
          Add contact
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
