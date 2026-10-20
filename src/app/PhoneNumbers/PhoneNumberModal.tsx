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
import { NUMBER_PATTERN, PhoneNumber, normaliseNumber, shown } from '@app/api/phoneNumbers';
import { useAction } from '@app/admin/useAction';

const MAX_LABEL = 60;

/** Add a number (number and label) or edit an existing one's label. */
export const PhoneNumberModal: React.FunctionComponent<{
  existing?: PhoneNumber;
  save(number: string, label: string): Promise<PhoneNumber>;
  onSaved(saved: PhoneNumber): void;
  onCancel(): void;
}> = ({ existing, save, onSaved, onCancel }) => {
  const [number, setNumber] = React.useState(existing ? shown(existing.number) : '');
  const [label, setLabel] = React.useState(existing?.label ?? '');
  const [checked, setChecked] = React.useState(false);
  const action = useAction(['number', 'label']);

  const digits = normaliseNumber(number);
  const numberError =
    !existing && checked && !NUMBER_PATTERN.test(digits) ? 'Use 8 to 15 digits, country code first.' : null;
  const labelError = label.trim().length > MAX_LABEL ? `At most ${MAX_LABEL} characters.` : null;
  const shownNumberError = numberError ?? action.fieldErrors.number ?? null;
  const shownLabelError = labelError ?? action.fieldErrors.label ?? null;

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setChecked(true);
    if ((!existing && !NUMBER_PATTERN.test(digits)) || labelError) return;
    const result = await action.run(() => save(digits, label));
    if (result !== undefined) onSaved(result);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="number-modal-title">
      <ModalHeader title={existing ? `Edit ${shown(existing.number)}` : 'Add number'} labelId="number-modal-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="number-modal-form" onSubmit={onSubmit}>
          <FormGroup label="WhatsApp number" fieldId="number-modal-number" isRequired={!existing}>
            <TextInput
              id="number-modal-number"
              value={number}
              onChange={(_e, v) => setNumber(v)}
              isDisabled={Boolean(existing)}
              validated={shownNumberError ? 'error' : 'default'}
              placeholder="919812345678"
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={shownNumberError ? 'error' : 'default'}>
                  {shownNumberError ?? 'Country code first, e.g. 919812345678'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <FormGroup label="Label" fieldId="number-modal-label">
            <TextInput
              id="number-modal-label"
              value={label}
              onChange={(_e, v) => setLabel(v)}
              validated={shownLabelError ? 'error' : 'default'}
              placeholder="Optional, e.g. Sales line"
            />
            {shownLabelError && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{shownLabelError}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="number-modal-form" isDisabled={action.busy} isLoading={action.busy}>
          {existing ? 'Save' : 'Add'}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
