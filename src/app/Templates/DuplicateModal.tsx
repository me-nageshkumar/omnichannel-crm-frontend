import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import type { TemplateView } from '@app/api/templates';
import type { WorkspaceAccess } from '@app/api/users';
import { useAction } from '@app/admin/useAction';

/** The default name of a copy; the whole name stays within the 100-character limit. */
export const copyName = (name: string) => `${name.slice(0, 93)} (copy)`;

/** Copies a template into one of the brands the user may manage templates in. */
export const DuplicateModal: React.FunctionComponent<{
  source: TemplateView;
  /** The brands the user may copy into (they hold template:manage there). */
  targets: WorkspaceAccess[];
  currentId: string;
  save(targetWorkspaceId: string, name: string): Promise<TemplateView>;
  onSaved(copy: TemplateView, target: WorkspaceAccess): void;
  onCancel(): void;
}> = ({ source, targets, currentId, save, onSaved, onCancel }) => {
  const [target, setTarget] = React.useState((targets.find((w) => w.id === currentId) ?? targets[0])?.id ?? '');
  const [name, setName] = React.useState(copyName(source.name));
  const action = useAction(['name']);
  const error = action.fieldErrors.name;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const brand = targets.find((w) => w.id === target);
    if (!brand || !name.trim()) return;
    const copy = await action.run(() => save(brand.id, name.trim()));
    if (copy !== undefined) onSaved(copy, brand);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="duplicate-title">
      <ModalHeader title="Duplicate template" labelId="duplicate-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="duplicate-form" onSubmit={onSubmit}>
          <FormGroup label="Brand" fieldId="duplicate-brand" isRequired>
            <FormSelect id="duplicate-brand" value={target} onChange={(_e, v) => setTarget(v)}>
              {targets.map((w) => (
                <FormSelectOption key={w.id} value={w.id} label={w.name} />
              ))}
            </FormSelect>
          </FormGroup>
          <FormGroup label="Name" fieldId="duplicate-name" isRequired>
            <TextInput
              id="duplicate-name"
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
        <Button
          variant="primary"
          type="submit"
          form="duplicate-form"
          isDisabled={action.busy || !name.trim() || !target}
        >
          Duplicate
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
