import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { Contact, NUMBER_PATTERN, normaliseNumber } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';

/** Add a contact by hand: a phone number (country code first) and an optional name. */
export const AddContactModal: React.FunctionComponent<{
  save(name: string | null, phone: string): Promise<Contact>;
  onSaved(saved: Contact): void;
  onCancel(): void;
}> = ({ save, onSaved, onCancel }) => {
  const [phone, setPhone] = React.useState('');
  const [name, setName] = React.useState('');
  const [checked, setChecked] = React.useState(false);
  const action = useAction(['phone', 'name']);

  const digits = normaliseNumber(phone);
  const phoneError = checked && !NUMBER_PATTERN.test(digits) ? 'Use 8 to 15 digits, country code first.' : null;
  const shownPhoneError = phoneError ?? action.fieldErrors.phone ?? null;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    if (!NUMBER_PATTERN.test(digits)) return;
    const result = await action.run(() => save(name.trim() || null, digits));
    if (result !== undefined) onSaved(result);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="add-contact-title">
      <ModalHeader title="Add contact" labelId="add-contact-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="add-contact-form" onSubmit={onSubmit}>
          <FormGroup label="Phone number" fieldId="add-contact-phone" isRequired>
            <TextInput
              id="add-contact-phone"
              value={phone}
              onChange={(_e, v) => setPhone(v)}
              validated={shownPhoneError ? 'error' : 'default'}
              placeholder="919812345678"
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={shownPhoneError ? 'error' : 'default'}>
                  {shownPhoneError ?? 'Country code first, e.g. 919812345678'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <FormGroup label="Name" fieldId="add-contact-name">
            <TextInput
              id="add-contact-name"
              value={name}
              onChange={(_e, v) => setName(v)}
              validated={action.fieldErrors.name ? 'error' : 'default'}
              placeholder="Optional"
            />
            {action.fieldErrors.name && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{action.fieldErrors.name}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="add-contact-form" isDisabled={action.busy} isLoading={action.busy}>
          Add
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
