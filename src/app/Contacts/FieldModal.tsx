import * as React from 'react';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectList,
  SelectOption,
  TextInput,
} from '@patternfly/react-core';
import { LABEL_COLORS, LabelColor } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';

export interface FieldValues {
  name: string;
  description: string | null;
  color?: LabelColor;
}

const titleCase = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/** Add or edit a contact label (with a colour) or attribute: name and description. */
export function FieldModal<T>({
  noun,
  withColor,
  existing,
  save,
  onSaved,
  onCancel,
}: {
  noun: 'label' | 'attribute';
  withColor?: boolean;
  existing?: { name: string; description: string | null; color?: LabelColor };
  save(values: FieldValues): Promise<T>;
  onSaved(saved: T): void;
  onCancel(): void;
}): React.ReactElement {
  const [name, setName] = React.useState(existing?.name ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [color, setColor] = React.useState<LabelColor>(existing?.color ?? 'blue');
  const [colorOpen, setColorOpen] = React.useState(false);
  const action = useAction(['name', 'color', 'description']);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!name.trim()) return;
    const values: FieldValues = {
      name: name.trim(),
      description: description.trim() || null,
      ...(withColor ? { color } : {}),
    };
    const result = await action.run(() => save(values));
    if (result !== undefined) onSaved(result);
  };
  const err = (field: string) =>
    action.fieldErrors[field] && (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant="error">{action.fieldErrors[field]}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    );

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="field-modal-title">
      <ModalHeader title={`${existing ? 'Edit' : 'Add'} ${noun}`} labelId="field-modal-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="field-modal-form" onSubmit={onSubmit}>
          <FormGroup label="Name" fieldId="field-modal-name" isRequired>
            <TextInput
              id="field-modal-name"
              value={name}
              onChange={(_e, v) => setName(v)}
              validated={action.fieldErrors.name ? 'error' : 'default'}
              isRequired
            />
            {err('name')}
          </FormGroup>
          {withColor && (
            <FormGroup label="Colour" fieldId="field-modal-color">
              <Select
                isOpen={colorOpen}
                selected={color}
                onSelect={(_e, v) => {
                  setColor(v as LabelColor);
                  setColorOpen(false);
                }}
                onOpenChange={setColorOpen}
                popperProps={{ appendTo: 'inline' }}
                toggle={(ref) => (
                  <MenuToggle
                    ref={ref}
                    id="field-modal-color"
                    isExpanded={colorOpen}
                    onClick={() => setColorOpen(!colorOpen)}
                  >
                    {`Colour: ${titleCase(color)}`}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {LABEL_COLORS.map((c) => (
                    <SelectOption key={c} value={c}>
                      {titleCase(c)}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
              {err('color')}
            </FormGroup>
          )}
          <FormGroup label="Description" fieldId="field-modal-description">
            <TextInput
              id="field-modal-description"
              value={description}
              onChange={(_e, v) => setDescription(v)}
              validated={action.fieldErrors.description ? 'error' : 'default'}
              placeholder="Optional"
            />
            {err('description')}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          type="submit"
          form="field-modal-form"
          isDisabled={action.busy || !name.trim()}
          isLoading={action.busy}
        >
          {existing ? 'Save' : 'Add'}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
