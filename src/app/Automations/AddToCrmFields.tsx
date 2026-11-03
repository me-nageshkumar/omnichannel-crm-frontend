import * as React from 'react';
import {
  Alert,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextInput,
} from '@patternfly/react-core';
import type { AutomationAction, AutomationOptions } from '@app/api/automations';

export const CRM_OFF_TEXT = 'CRM is off for this brand. The rule cannot be published with this action.';
const KEYS = ['pipelineId', 'stageId', 'dealTitle'];

const ErrorLine: React.FunctionComponent<{ message?: string }> = ({ message }) =>
  message ? <HelperTextItem variant="error">{message}</HelperTextItem> : null;

/** Add to CRM: the pipeline and lane of the new deal (the default pipeline's first lane when left), and its title. */
export const AddToCrmFields: React.FunctionComponent<{
  action: AutomationAction;
  options: AutomationOptions;
  errors: Record<string, string>;
  isDisabled: boolean;
  onChange(action: AutomationAction): void;
}> = ({ action, options, errors, isDisabled, onChange }) => {
  const id = React.useId();
  if (!options.crm.enabled) {
    const messages = KEYS.filter((k) => errors[k]).map((k) => errors[k]);
    return (
      <>
        <Alert variant="warning" isInline isPlain title={CRM_OFF_TEXT} />
        {messages.length > 0 && (
          <HelperText>
            {messages.map((m) => (
              <ErrorLine key={m} message={m} />
            ))}
          </HelperText>
        )}
      </>
    );
  }
  const pipelineId = action.pipelineId ?? '';
  const stageId = action.stageId ?? '';
  const pipeline = options.crm.pipelines.find((p) => p.id === pipelineId);
  return (
    <>
      <FormGroup label="Pipeline" fieldId={`${id}-pipeline`}>
        <FormSelect
          id={`${id}-pipeline`}
          value={pipelineId}
          isDisabled={isDisabled}
          validated={errors.pipelineId ? 'error' : 'default'}
          onChange={(_e, v) => onChange({ ...action, pipelineId: v === '' ? null : v, stageId: null })}
        >
          <FormSelectOption value="" label="Default pipeline" />
          {pipelineId !== '' && !pipeline && <FormSelectOption value={pipelineId} label="—" isDisabled />}
          {options.crm.pipelines.map((p) => (
            <FormSelectOption key={p.id} value={p.id} label={p.name} />
          ))}
        </FormSelect>
        {errors.pipelineId && (
          <FormHelperText>
            <HelperText>
              <ErrorLine message={errors.pipelineId} />
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
      <FormGroup label="Lane" fieldId={`${id}-lane`}>
        {/* the default pipeline is whichever it is when the rule runs, so only a chosen pipeline offers its lanes */}
        <FormSelect
          id={`${id}-lane`}
          value={stageId}
          isDisabled={isDisabled || !pipeline}
          validated={errors.stageId ? 'error' : 'default'}
          onChange={(_e, v) => onChange({ ...action, stageId: v === '' ? null : v })}
        >
          <FormSelectOption value="" label="First lane" />
          {stageId !== '' && !pipeline?.lanes.some((l) => l.id === stageId) && (
            <FormSelectOption value={stageId} label="—" isDisabled />
          )}
          {(pipeline?.lanes ?? []).map((l) => (
            <FormSelectOption key={l.id} value={l.id} label={l.name} />
          ))}
        </FormSelect>
        {errors.stageId && (
          <FormHelperText>
            <HelperText>
              <ErrorLine message={errors.stageId} />
            </HelperText>
          </FormHelperText>
        )}
      </FormGroup>
      <FormGroup label="Deal title" fieldId={`${id}-title`}>
        <TextInput
          id={`${id}-title`}
          value={action.dealTitle ?? ''}
          placeholder="{{name}} – WhatsApp"
          isDisabled={isDisabled}
          validated={errors.dealTitle ? 'error' : 'default'}
          onChange={(_e, v) => onChange({ ...action, dealTitle: v === '' ? null : v })}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              {
                "{{name}} is the contact's name, or their number when there is none. The owner is whoever the chat is assigned to when this runs."
              }
            </HelperTextItem>
            <ErrorLine message={errors.dealTitle} />
          </HelperText>
        </FormHelperText>
      </FormGroup>
    </>
  );
};

/** The error keys these fields show; the card lists any others itself. */
export const addToCrmShows = (key: string) => KEYS.indexOf(key) >= 0;
