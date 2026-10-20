import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
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
  TextInput,
} from '@patternfly/react-core';
import type { ContactAttribute } from '@app/api/contacts';
import { parsePlaceholders } from '@app/Templates/placeholders';

/** The error for a new agent field's name, or null when {{name}} is a valid agent placeholder. */
export function newFieldError(name: string): string | null {
  const { refs, error } = parsePlaceholders(`{{${name}}}`);
  if (error) return error;
  if (refs.length !== 1 || refs[0].kind !== 'AGENT') return 'Use the Contact group for contact fields';
  return null;
}

const NewFieldModal: React.FunctionComponent<{ onInsert(name: string): void; onCancel(): void }> = ({
  onInsert,
  onCancel,
}) => {
  const [name, setName] = React.useState('');
  const error = name ? newFieldError(name) : null;
  const valid = name !== '' && error === null;
  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (valid) onInsert(name);
  };
  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="new-field-title">
      <ModalHeader title="New field" labelId="new-field-title" />
      <ModalBody>
        <Form id="new-field-form" onSubmit={submit}>
          <FormGroup label="Field name" fieldId="new-field-name" isRequired>
            <TextInput
              id="new-field-name"
              value={name}
              onChange={(_e, v) => setName(v)}
              validated={error ? 'error' : 'default'}
              placeholder="order_id"
              isRequired
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={error ? 'error' : 'default'}>
                  {error ??
                    'Lowercase letters, digits and _, starting with a letter. The agent fills it in when sending.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="new-field-form" isDisabled={!valid}>
          Insert
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

/**
 * "Insert placeholder": Contact (name, phone, each attribute) and New field…. It calls
 * {@code onInsert} with the `{{…}}` text; the field decides where it goes.
 */
export const InsertPlaceholderMenu: React.FunctionComponent<{
  /** The field's label, for the button's accessible name. */
  fieldLabel: string;
  attributes: ContactAttribute[];
  onInsert(text: string): void;
}> = ({ fieldLabel, attributes, onInsert }) => {
  const [isOpen, setOpen] = React.useState(false);
  const [newField, setNewField] = React.useState(false);
  const insert = (text: string) => () => {
    setOpen(false);
    onInsert(text);
  };
  return (
    <>
      <Dropdown
        isOpen={isOpen}
        onOpenChange={setOpen}
        onSelect={() => setOpen(false)}
        toggle={(ref) => (
          <MenuToggle
            ref={ref}
            variant="plainText"
            size="sm"
            aria-label={`Insert placeholder in ${fieldLabel}`}
            isExpanded={isOpen}
            onClick={() => setOpen(!isOpen)}
          >
            Insert placeholder
          </MenuToggle>
        )}
      >
        <DropdownGroup label="Contact">
          <DropdownList>
            <DropdownItem onClick={insert('{{contact.name}}')}>{'Name · {{contact.name}}'}</DropdownItem>
            <DropdownItem onClick={insert('{{contact.phone}}')}>{'Phone · {{contact.phone}}'}</DropdownItem>
            {attributes.map((a) => (
              <DropdownItem key={a.id} onClick={insert(`{{contact.attributes.${a.key}}}`)}>
                {`${a.name} · {{contact.attributes.${a.key}}}`}
              </DropdownItem>
            ))}
          </DropdownList>
        </DropdownGroup>
        <DropdownList>
          <DropdownItem
            onClick={() => {
              setOpen(false);
              setNewField(true);
            }}
          >
            New field…
          </DropdownItem>
        </DropdownList>
      </Dropdown>
      {newField && (
        <NewFieldModal
          onCancel={() => setNewField(false)}
          onInsert={(name) => {
            setNewField(false);
            onInsert(`{{${name}}}`);
          }}
        />
      )}
    </>
  );
};
