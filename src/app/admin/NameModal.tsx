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
import { useAction } from '@app/admin/useAction';

/** A one-field dialog for creating or renaming something that has just a name. */
export function NameModal<T>({
  title,
  label = 'Name',
  current = '',
  submitLabel,
  save,
  onSaved,
  onCancel,
}: {
  title: string;
  label?: string;
  current?: string;
  submitLabel: string;
  save(name: string): Promise<T>;
  onSaved(result: T): void;
  onCancel(): void;
}): React.ReactElement {
  const [name, setName] = React.useState(current);
  const action = useAction();
  const error = action.fieldErrors.name;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!name.trim()) return;
    const result = await action.run(() => save(name.trim()));
    if (result !== undefined) onSaved(result);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="name-modal-title">
      <ModalHeader title={title} labelId="name-modal-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="name-modal-form" onSubmit={onSubmit}>
          <FormGroup label={label} fieldId="name-modal-name" isRequired>
            <TextInput
              id="name-modal-name"
              value={name}
              onChange={(_e, v) => setName(v)}
              validated={error ? 'error' : 'default'}
              isRequired
            />
            {error && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{error}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="name-modal-form" isDisabled={action.busy || !name.trim()}>
          {submitLabel}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
