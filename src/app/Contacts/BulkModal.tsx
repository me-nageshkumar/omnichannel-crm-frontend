import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from '@patternfly/react-core';
import type { BulkAction, BulkRequest, ContactAttribute, ContactLabel, Selection } from '@app/api/contacts';
import { useAction } from '@app/admin/useAction';
import { countText } from '@app/Contacts/filterSpec';

export const BULK_BUTTON: Record<BulkAction, string> = {
  ADD_LABELS: 'Add labels',
  REMOVE_LABELS: 'Remove labels',
  SET_ATTRIBUTE: 'Set attribute',
  CLEAR_ATTRIBUTE: 'Clear attribute',
  DELETE: 'Delete',
};

/**
 * One bulk action in two steps: choose what to apply, then confirm against the server's count of the
 * contacts the selection matches right now.
 */
export const BulkModal: React.FunctionComponent<{
  action: BulkAction;
  selection: Selection;
  labels: ContactLabel[];
  attributes: ContactAttribute[];
  count(selection: Selection): Promise<{ count: number }>;
  run(request: BulkRequest): Promise<{ matched: number; changed: number }>;
  onDone(result: { matched: number; changed: number }): void;
  onCancel(): void;
}> = ({ action, selection, labels, attributes, count, run, onDone, onCancel }) => {
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
  const [attributeId, setAttributeId] = React.useState('');
  const [value, setValue] = React.useState('');
  const [matched, setMatched] = React.useState<number | null>(null);
  const counting = useAction();
  const running = useAction();
  const runCount = counting.run;

  const usesLabels = action === 'ADD_LABELS' || action === 'REMOVE_LABELS';
  const usesAttribute = action === 'SET_ATTRIBUTE' || action === 'CLEAR_ATTRIBUTE';
  const needsParams = action !== 'DELETE';
  const valid = usesLabels
    ? labelIds.length > 0
    : usesAttribute
      ? attributeId !== '' && (action === 'CLEAR_ATTRIBUTE' || value.trim() !== '')
      : true;
  const attributeName = attributes.find((a) => a.id === attributeId)?.name ?? '';

  const loadCount = React.useCallback(async () => {
    const result = await runCount(() => count(selection));
    if (result) setMatched(result.count);
  }, [count, selection, runCount]);

  // Deleting has nothing to choose, so go straight to the question.
  React.useEffect(() => {
    if (!needsParams) loadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = (): BulkRequest => ({
    selection,
    action,
    ...(usesLabels ? { labelIds } : {}),
    ...(usesAttribute ? { attributeId } : {}),
    ...(action === 'SET_ATTRIBUTE' ? { value: value.trim() } : {}),
  });
  const onConfirm = async () => {
    const result = await running.run(() => run(request()));
    if (result) onDone(result);
  };

  const n = matched ?? 0;
  const title = (): string => {
    switch (action) {
      case 'ADD_LABELS':
        return `Add labels to ${countText(n)}?`;
      case 'REMOVE_LABELS':
        return `Remove labels from ${countText(n)}?`;
      case 'SET_ATTRIBUTE':
        return `Set ${attributeName} on ${countText(n)}?`;
      case 'CLEAR_ATTRIBUTE':
        return `Clear ${attributeName} on ${countText(n)}?`;
      default:
        return `Delete ${countText(n)}?`;
    }
  };

  const confirming = matched !== null;
  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="bulk-title">
      <ModalHeader
        title={confirming ? title() : BULK_BUTTON[action]}
        labelId="bulk-title"
        titleIconVariant={action === 'DELETE' ? 'warning' : undefined}
      />
      <ModalBody>
        {(counting.error || running.error) && (
          <Alert variant="danger" isInline isPlain title={counting.error ?? running.error} />
        )}
        {confirming ? (
          action === 'DELETE' ? (
            'Their notes are deleted too. This cannot be undone.'
          ) : (
            'This applies to every contact the selection matches now.'
          )
        ) : needsParams ? (
          <Form
            id="bulk-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) loadCount();
            }}
          >
            {usesLabels && (
              <FormGroup role="group" label="Labels" isStack>
                {labels.map((l) => (
                  <Checkbox
                    key={l.id}
                    id={`bulk-label-${l.id}`}
                    label={l.name}
                    isChecked={labelIds.includes(l.id)}
                    onChange={(_e, on) => setLabelIds(on ? [...labelIds, l.id] : labelIds.filter((x) => x !== l.id))}
                  />
                ))}
              </FormGroup>
            )}
            {usesAttribute && (
              <FormGroup label="Attribute" fieldId="bulk-attribute">
                <FormSelect id="bulk-attribute" value={attributeId} onChange={(_e, v) => setAttributeId(v)}>
                  <FormSelectOption value="" label="Choose attribute" isPlaceholder />
                  {attributes.map((a) => (
                    <FormSelectOption key={a.id} value={a.id} label={a.name} />
                  ))}
                </FormSelect>
              </FormGroup>
            )}
            {action === 'SET_ATTRIBUTE' && (
              <FormGroup label="Value" fieldId="bulk-value">
                <TextInput id="bulk-value" value={value} onChange={(_e, v) => setValue(v)} />
              </FormGroup>
            )}
          </Form>
        ) : (
          'Counting contacts…'
        )}
      </ModalBody>
      <ModalFooter>
        {confirming ? (
          <Button
            variant={action === 'DELETE' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isDisabled={running.busy}
            isLoading={running.busy}
          >
            {BULK_BUTTON[action]}
          </Button>
        ) : (
          needsParams && (
            <Button type="submit" form="bulk-form" isDisabled={!valid || counting.busy} isLoading={counting.busy}>
              Continue
            </Button>
          )
        )}
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
