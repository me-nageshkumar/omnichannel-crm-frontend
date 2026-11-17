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
import { type BillingPeriod, PERIODS, PERIOD_LABEL, type Plan, duplicatePlan } from '@app/api/billing';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';

/** Copies a plan into a draft under another code, name and period: how the four periods of one tier are made. */
export const DuplicatePlanModal: React.FunctionComponent<{
  plan: Plan;
  onSaved(copy: Plan): void;
  onCancel(): void;
}> = ({ plan, onSaved, onCancel }) => {
  const { token } = useSession();
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState(plan.name);
  const [period, setPeriod] = React.useState<BillingPeriod>(plan.period);
  const action = useAction(['code', 'name', 'period']);

  const save = async () => {
    const copy = await action.run(() => duplicatePlan(token as string, plan.code, { code: code.trim(), name, period }));
    if (copy) onSaved(copy);
  };
  const error = (field: string) =>
    action.fieldErrors[field] ? (
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant="error">{action.fieldErrors[field]}</HelperTextItem>
        </HelperText>
      </FormHelperText>
    ) : null;

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="duplicate-plan-title">
      <ModalHeader title={`Duplicate ${plan.name}`} labelId="duplicate-plan-title" />
      <ModalBody>
        <Form
          id="duplicate-plan-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {action.error && <Alert variant="danger" isInline title={action.error} />}
          <FormGroup label="Code" isRequired fieldId="duplicate-plan-code">
            <TextInput id="duplicate-plan-code" isRequired value={code} onChange={(_e, v) => setCode(v)} />
            {error('code')}
          </FormGroup>
          <FormGroup label="Name" isRequired fieldId="duplicate-plan-name">
            <TextInput id="duplicate-plan-name" isRequired value={name} onChange={(_e, v) => setName(v)} />
            {error('name')}
          </FormGroup>
          <FormGroup label="Period" isRequired fieldId="duplicate-plan-period">
            <FormSelect id="duplicate-plan-period" value={period} onChange={(_e, v) => setPeriod(v as BillingPeriod)}>
              {PERIODS.map((p) => (
                <FormSelectOption key={p} value={p} label={PERIOD_LABEL[p]} />
              ))}
            </FormSelect>
            {error('period')}
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="duplicate-plan-form" isDisabled={action.busy}>
          Duplicate
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
