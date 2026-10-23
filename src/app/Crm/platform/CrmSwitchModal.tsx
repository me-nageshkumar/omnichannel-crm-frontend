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
  Spinner,
  Switch,
  TextInput,
} from '@patternfly/react-core';
import { Enablement, getCrmSwitch, putCrmSwitch } from '@app/api/crm';
import type { Workspace } from '@app/api/workspaces';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

/** The CRM switch of each brand, loaded for platform staff only; {@code put} records a saved switch. */
export function useCrmSwitches(customerId: string, brands: Workspace[], enabled: boolean) {
  const { token } = useSession();
  const [switches, setSwitches] = React.useState<Record<string, Enablement>>({});
  const ids = brands.map((b) => b.id).join(',');
  React.useEffect(() => {
    if (!enabled || !token) return undefined;
    let live = true;
    brands.forEach((b) =>
      getCrmSwitch(token, customerId, b.id).then(
        (e) => live && setSwitches((s) => ({ ...s, [b.id]: e })),
        () => undefined,
      ),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token, customerId, ids]);
  const put = (workspaceId: string, e: Enablement) => setSwitches((s) => ({ ...s, [workspaceId]: e }));
  return { switches, put };
}

const asText = (n: number | null) => (n === null ? '' : String(n));
/** Blank is unlimited (null); anything else must be a whole number of at least 1. */
function parseLimit(text: string): number | null | 'invalid' {
  if (!text.trim()) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 ? n : 'invalid';
}

const FIELDS = ['maxPipelines', 'maxCustomFields'];

/** Platform staff switch a brand's CRM on or off and set its limits. */
export const CrmSwitchModal: React.FunctionComponent<{
  customerId: string;
  workspace: Workspace;
  onClose(): void;
  onSaved(e: Enablement): void;
}> = ({ customerId, workspace, onClose, onSaved }) => {
  const { token } = useSession();
  const current = useLoad((t) => getCrmSwitch(t, customerId, workspace.id), [customerId, workspace.id]);
  const [on, setOn] = React.useState(false);
  const [pipelines, setPipelines] = React.useState('');
  const [customFields, setCustomFields] = React.useState('');
  const [localErrors, setLocalErrors] = React.useState<Record<string, string>>({});
  const action = useAction(FIELDS);

  React.useEffect(() => {
    if (!current.data) return;
    setOn(current.data.enabled);
    setPipelines(asText(current.data.maxPipelines));
    setCustomFields(asText(current.data.maxCustomFields));
  }, [current.data]);

  const errors = { ...action.fieldErrors, ...localErrors };

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const maxPipelines = parseLimit(pipelines);
    const maxCustomFields = parseLimit(customFields);
    const bad: Record<string, string> = {};
    if (maxPipelines === 'invalid')
      bad.maxPipelines = 'Enter a whole number of 1 or more, or leave blank for no limit.';
    if (maxCustomFields === 'invalid')
      bad.maxCustomFields = 'Enter a whole number of 1 or more, or leave blank for no limit.';
    setLocalErrors(bad);
    if (maxPipelines === 'invalid' || maxCustomFields === 'invalid') return;
    const saved = await action.run(() =>
      putCrmSwitch(token as string, customerId, workspace.id, { enabled: on, maxPipelines, maxCustomFields }),
    );
    if (saved) onSaved(saved);
  };

  const limit = (id: string, key: string, label: string, value: string, set: (v: string) => void) => (
    <FormGroup label={label} fieldId={id}>
      <TextInput
        id={id}
        type="number"
        min={1}
        inputMode="numeric"
        value={value}
        onChange={(_e, v) => set(v)}
        validated={errors[key] ? 'error' : 'default'}
      />
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={errors[key] ? 'error' : 'default'}>
            {errors[key] ?? 'Leave blank for no limit.'}
          </HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );

  return (
    <Modal isOpen variant="small" onClose={onClose} aria-labelledby="crm-switch-title">
      <ModalHeader title={`CRM settings for ${workspace.name}`} labelId="crm-switch-title" />
      <ModalBody>
        {(current.error || action.error) && (
          <Alert variant="danger" isInline isPlain title={current.error ?? action.error} />
        )}
        {current.loading && !current.data ? (
          <Spinner aria-label="Loading CRM settings" />
        ) : (
          <Form id="crm-switch-form" onSubmit={onSubmit}>
            <Switch id="crm-switch-on" label="CRM on" isChecked={on} onChange={(_e, v) => setOn(v)} />
            {limit('crm-max-pipelines', 'maxPipelines', 'Max pipelines', pipelines, setPipelines)}
            {limit(
              'crm-max-custom-fields',
              'maxCustomFields',
              'Max custom fields per record type',
              customFields,
              setCustomFields,
            )}
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="crm-switch-form" isDisabled={action.busy || !current.data}>
          Save
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
