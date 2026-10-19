import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSection,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import { Customer, createCustomer } from '@app/api/customers';
import type { WithTemporaryPassword } from '@app/api/users';
import { EMPTY_PERSON, Person, PersonFields, validatePerson } from '@app/admin/PersonFields';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';

/** A new customer with its first brand and owner, created in one step. */
export const CreateCustomerModal: React.FunctionComponent<{
  onCreated(customer: Customer, owner: WithTemporaryPassword): void;
  onCancel(): void;
}> = ({ onCreated, onCancel }) => {
  const { token } = useSession();
  const [name, setName] = React.useState('');
  const [brand, setBrand] = React.useState('');
  const [owner, setOwner] = React.useState<Person>(EMPTY_PERSON);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const action = useAction();

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const local = validatePerson(owner, 'create');
    if (!name.trim()) local.companyName = 'Required.';
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    const reply = await action.run(() =>
      createCustomer(token as string, { name, workspaceName: brand.trim() ? brand : null, admin: owner }),
    );
    if (reply) onCreated(reply.customer, { user: reply.user, temporaryPassword: reply.temporaryPassword });
  };

  const shown = { ...errors, ...action.fieldErrors };
  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="create-customer-title">
      <ModalHeader title="Add customer" labelId="create-customer-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="create-customer-form" onSubmit={onSubmit}>
          <FormSection title="Company">
            <FormGroup label="Company name" fieldId="customer-name" isRequired>
              <TextInput
                id="customer-name"
                value={name}
                onChange={(_e, v) => setName(v)}
                validated={shown.companyName ? 'error' : 'default'}
                isRequired
              />
              {shown.companyName && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="error">{shown.companyName}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
            <FormGroup label="First brand name" fieldId="customer-brand">
              <TextInput
                id="customer-brand"
                value={brand}
                placeholder="Same as company name"
                onChange={(_e, v) => setBrand(v)}
              />
            </FormGroup>
          </FormSection>
          <FormSection title="Owner">
            <PersonFields mode="create" idPrefix="owner" values={owner} onChange={setOwner} errors={shown} />
          </FormSection>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="create-customer-form" isDisabled={action.busy}>
          Create
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
