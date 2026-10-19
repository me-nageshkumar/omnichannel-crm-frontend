import * as React from 'react';
import { Alert, Button, Form, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';
import { EMPTY_PERSON, Person, PersonFields, PersonMode, validatePerson } from '@app/admin/PersonFields';
import { RoleSelect } from '@app/admin/RoleSelect';
import { useAction } from '@app/admin/useAction';
import type { RoleRef } from '@app/api/users';

export interface PersonInput extends Person {
  roleId: string;
}

/**
 * Create or edit a person, optionally with a role. {@code submit} calls the server; its result goes to
 * {@code onSaved}. Server field errors (DUPLICATE, VALIDATION) land on the matching field.
 */
export function PersonModal<R>({
  title,
  mode,
  initial = EMPTY_PERSON,
  initialRoleId = '',
  roles,
  submitLabel,
  submit,
  onSaved,
  onCancel,
}: {
  title: string;
  mode: Exclude<PersonMode, 'password'>;
  initial?: Person;
  initialRoleId?: string;
  /** Omit to hide the role picker. */
  roles?: RoleRef[];
  submitLabel: string;
  submit(input: PersonInput): Promise<R>;
  onSaved(result: R): void;
  onCancel(): void;
}): React.ReactElement {
  const [values, setValues] = React.useState<Person>(initial);
  const [roleId, setRoleId] = React.useState(initialRoleId);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const action = useAction(['name', 'username', 'email', 'mobileNumber', 'temporaryPassword', 'roleId']);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const local = validatePerson(values, mode);
    if (roles && !roleId) local.roleId = 'Required.';
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    const result = await action.run(() => submit({ ...values, roleId }));
    if (result !== undefined) onSaved(result);
  };

  const shown = { ...errors, ...action.fieldErrors };
  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="person-title">
      <ModalHeader title={title} labelId="person-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="person-form" onSubmit={onSubmit}>
          <PersonFields mode={mode} values={values} onChange={setValues} errors={shown} />
          {roles && (
            <RoleSelect id="person-role" roles={roles} value={roleId} onChange={setRoleId} error={shown.roleId} />
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="person-form" isDisabled={action.busy}>
          {submitLabel}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/** A {@link Person} prefilled from a stored user (no password). */
export function personOf(u: {
  name: string;
  username: string;
  email: string | null;
  mobileNumber: string | null;
}): Person {
  return {
    name: u.name,
    username: u.username,
    email: u.email ?? '',
    mobileNumber: u.mobileNumber ?? '',
    temporaryPassword: '',
  };
}
