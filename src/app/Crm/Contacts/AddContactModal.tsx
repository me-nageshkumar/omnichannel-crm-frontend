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
import { addContact } from '@app/api/crm';
import type { AddContactResult, CrmPhone } from '@app/api/crm';
import { searchContacts } from '@app/api/contacts';
import type { Contact } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { Field } from '@app/Crm/deals/fields';
import { phoneText } from '@app/Crm/deals/NewContactModal';

const FIELDS = ['contactId'];

const contactText = (c: Contact): string => {
  if (c.name && c.phone && c.name !== c.phone) return `${c.name} (${c.phone})`;
  return c.name || c.phone || 'Number hidden';
};

/** Puts one of the brand's contacts in the CRM on a number, without a deal. */
export const AddContactModal: React.FunctionComponent<{
  /** The brand's numbers; only those the user can chat from are offered. */
  numbers: CrmPhone[];
  onAdded(result: AddContactResult): void;
  onClose(): void;
}> = ({ numbers, onAdded, onClose }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const offered = numbers.filter((n) => n.canChat);
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [contactId, setContactId] = React.useState('');
  const [channel, setChannel] = React.useState(offered[0]?.phoneNumberId ?? '');
  const action = useAction(FIELDS);

  React.useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const found = useLoad((t) => (q ? searchContacts(t, ws, { filter: { q } }) : Promise.resolve(undefined)), [ws, q], {
    keepOnError: true,
  });
  const matches = found.data?.items ?? [];
  const total = found.data?.total ?? 0;
  const moreHint =
    total > matches.length
      ? `Showing the first ${matches.length} of ${total.toLocaleString('en-US')}. Keep typing to narrow it down.`
      : undefined;

  const placeholder = () => {
    if (!search.trim()) return 'Type a name or number';
    if (found.loading || q !== search.trim()) return 'Searching…';
    // the alert above says what went wrong
    if (found.error) return 'Type a name or number';
    return matches.length === 0 ? 'No contacts match' : 'Choose a contact';
  };

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!contactId || !channel) return;
    const result = await action.run(() => addContact(token as string, ws, { contactId, channelAccountId: channel }));
    if (result) onAdded(result);
  };

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="crm-add-contact-title">
      <ModalHeader
        title="Add contact"
        labelId="crm-add-contact-title"
        description="Pick one of your contacts to add to the CRM. No deal is created."
      />
      <ModalBody>
        {(action.error || found.error) && (
          <Alert variant="danger" isInline isPlain title={action.error ?? found.error} />
        )}
        <Form id="crm-add-contact-form" onSubmit={onSubmit}>
          <Field
            label="Contact"
            fieldId="crm-ac-contact"
            isRequired
            error={action.fieldErrors.contactId}
            help={moreHint}
          >
            <TextInput
              aria-label="Search contacts"
              placeholder="Search by name or number"
              value={search}
              onChange={(_e, v) => {
                setSearch(v);
                setContactId('');
              }}
            />
            <FormSelect id="crm-ac-contact" value={contactId} onChange={(_e, v) => setContactId(v)}>
              <FormSelectOption value="" label={placeholder()} isPlaceholder />
              {matches.map((c) => (
                <FormSelectOption key={c.id} value={c.id} label={contactText(c)} />
              ))}
            </FormSelect>
          </Field>
          <Field
            label="Channel number"
            fieldId="crm-ac-channel"
            isRequired
            help={offered.length === 0 ? 'No number is available to chat from.' : 'The number the CRM contact sits on.'}
          >
            <FormSelect
              id="crm-ac-channel"
              value={channel}
              isDisabled={offered.length === 0}
              onChange={(_e, v) => setChannel(v)}
            >
              {offered.map((n) => (
                <FormSelectOption key={n.phoneNumberId} value={n.phoneNumberId} label={phoneText(n)} />
              ))}
            </FormSelect>
          </Field>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="submit"
          form="crm-add-contact-form"
          isDisabled={action.busy || !contactId || !channel}
          isLoading={action.busy}
        >
          Add contact
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
