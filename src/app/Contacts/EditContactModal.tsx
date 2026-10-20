import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import type { Contact, ContactAttribute } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';

/** Edit a contact's name and the value of each of the brand's attributes. */
export const EditContactModal: React.FunctionComponent<{
  contact: Contact;
  attributes: ContactAttribute[];
  save(changes: { name?: string | null; attributes?: Record<string, string> }): Promise<Contact>;
  onSaved(saved: Contact): void;
  onCancel(): void;
}> = ({ contact, attributes, save, onSaved, onCancel }) => {
  const [name, setName] = React.useState(contact.name ?? '');
  const [values, setValues] = React.useState<Record<string, string>>(contact.attributes);
  const action = useAction(['name']);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const changes: { name?: string | null; attributes?: Record<string, string> } = {};
    // Sending an unchanged name would mark it as typed and stop WhatsApp from updating it.
    // The server merges by key, so send only the changed ones; "" clears a value.
    if (name.trim() !== (contact.name ?? '')) changes.name = name.trim();
    const delta: Record<string, string> = {};
    attributes.forEach((a) => {
      const v = (values[a.id] ?? '').trim();
      if (v !== (contact.attributes[a.id] ?? '')) delta[a.id] = v;
    });
    if (Object.keys(delta).length > 0) changes.attributes = delta;
    if (Object.keys(changes).length === 0) {
      onCancel();
      return;
    }
    const result = await action.run(() => save(changes));
    if (result !== undefined) onSaved(result);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="edit-contact-title">
      <ModalHeader title="Edit contact" labelId="edit-contact-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="edit-contact-form" onSubmit={onSubmit}>
          <FormGroup label="Name" fieldId="edit-contact-name">
            <TextInput
              id="edit-contact-name"
              value={name}
              onChange={(_e, v) => setName(v)}
              validated={action.fieldErrors.name ? 'error' : 'default'}
            />
          </FormGroup>
          {attributes.map((a) => (
            <FormGroup key={a.id} label={a.name} fieldId={`edit-contact-attr-${a.id}`}>
              <TextInput
                id={`edit-contact-attr-${a.id}`}
                value={values[a.id] ?? ''}
                onChange={(_e, v) => setValues({ ...values, [a.id]: v })}
              />
            </FormGroup>
          ))}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="edit-contact-form" isDisabled={action.busy} isLoading={action.busy}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
