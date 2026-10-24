import * as React from 'react';
import {
  Button,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core';
import type { Stage } from '@app/api/crm';

/** Asks where the deals of a lane being removed go. {@code targets} are the lanes that stay. */
export const StageRemovalModal: React.FunctionComponent<{
  stageName: string;
  count: number;
  targets: Stage[];
  busy?: boolean;
  onConfirm(targetStageId: string): void;
  onCancel(): void;
}> = ({ stageName, count, targets, busy, onConfirm, onCancel }) => {
  const [target, setTarget] = React.useState('');
  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="stage-removal-title">
      <ModalHeader title="Move deals before removing" labelId="stage-removal-title" titleIconVariant="warning" />
      <ModalBody>
        <p className="pf-v6-u-mb-md">
          {stageName} still holds {count} {count === 1 ? 'deal' : 'deals'}. Choose the lane they move to; the move
          happens when you save.
        </p>
        <FormGroup label="Move deals to" fieldId="stage-removal-target">
          <FormSelect id="stage-removal-target" value={target} onChange={(_e, v) => setTarget(v)}>
            <FormSelectOption value="" label="Choose a lane" isPlaceholder />
            {targets.map((t) => (
              <FormSelectOption
                key={t.id}
                value={t.id}
                label={t.type === 'OPEN' ? t.name : `${t.name} (${t.type === 'WON' ? 'won' : 'lost'})`}
              />
            ))}
          </FormSelect>
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!target || busy} isLoading={busy} onClick={() => onConfirm(target)}>
          Move deals and save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
