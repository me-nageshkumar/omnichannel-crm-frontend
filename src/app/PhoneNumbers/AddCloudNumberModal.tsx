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
  Radio,
  Spinner,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { ConnectionCheck, MetaConnection, checkMetaConnection, listMetaConnections } from '@app/api/metaConnections';
import { PhoneNumber, addCloudNumber } from '@app/api/phoneNumbers';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

export const META_STEPS_URL = 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started';

/** "WhatsApp Web" or "WhatsApp Cloud API", at the top of the add dialogs. */
export const NumberKindToggle: React.FunctionComponent<{ cloud: boolean; onChange(cloud: boolean): void }> = ({
  cloud,
  onChange,
}) => (
  <ToggleGroup aria-label="How the number reaches WhatsApp" className="pf-v6-u-mb-md">
    <ToggleGroupItem text="WhatsApp Web" buttonId="kind-web" isSelected={!cloud} onChange={() => onChange(false)} />
    <ToggleGroupItem
      text="WhatsApp Cloud API"
      buttonId="kind-cloud"
      isSelected={cloud}
      onChange={() => onChange(true)}
    />
  </ToggleGroup>
);

/**
 * Adds a number that lives on the brand's own Meta app (spec 2026-11-20 §5.7): pick the Meta connection, then one of
 * the numbers its token can use; Meta gives the digits.
 */
export const AddCloudNumberModal: React.FunctionComponent<{
  onChooseWeb(): void;
  onAddConnection(): void;
  onSaved(saved: PhoneNumber): void;
  onCancel(): void;
}> = ({ onChooseWeb, onAddConnection, onSaved, onCancel }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const t = token as string;
  const connections = useLoad((tok) => listMetaConnections(tok, ws), [ws]);
  const [connectionId, setConnectionId] = React.useState('');
  const [typedWaba, setTypedWaba] = React.useState('');
  const [check, setCheck] = React.useState<ConnectionCheck | null>(null);
  const [picked, setPicked] = React.useState<{ wabaId: string; metaPhoneNumberId: string } | null>(null);
  const [label, setLabel] = React.useState('');
  const checking = useAction(['wabaId']);
  const action = useAction(['cloud', 'label']);

  /** A new connection starts over; a typed WABA look-up keeps the list it adds to, so a refusal leaves the form. */
  const runCheck = async (id: string, waba?: string) => {
    if (!waba) {
      setCheck(null);
      setPicked(null);
    }
    if (!id) return;
    const result = await checking.run(() => checkMetaConnection(t, ws, id, waba));
    if (result !== undefined) setCheck(result);
  };

  React.useEffect(() => {
    const list = connections.data ?? [];
    if (!connectionId && list.length === 1) {
      setConnectionId(list[0].id);
      runCheck(list[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.data]);

  const invalid = check?.connection.status === 'INVALID';
  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!picked) return;
    const result = await action.run(() => addCloudNumber(t, ws, { label, cloud: { connectionId, ...picked } }));
    if (result !== undefined) onSaved(result);
  };
  const list: MetaConnection[] = connections.data ?? [];

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="cloud-number-title">
      <ModalHeader title="Add number" labelId="cloud-number-title" />
      <ModalBody>
        <NumberKindToggle cloud onChange={(cloud) => !cloud && onChooseWeb()} />
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        {action.fieldErrors.cloud && <Alert variant="danger" isInline isPlain title={action.fieldErrors.cloud} />}
        <Alert variant="info" isInline isPlain title="Before you start, in Meta">
          Create a Meta app of type Business, add WhatsApp, add the number and confirm it, create a system user with a
          token that never expires (whatsapp_business_messaging and whatsapp_business_management), add a payment method
          to the WhatsApp account, and put the app live.{' '}
          <a href={META_STEPS_URL} target="_blank" rel="noreferrer">
            Meta&apos;s getting-started guide
          </a>
        </Alert>
        {connections.loading && !connections.data ? (
          <Spinner size="md" aria-label="Loading Meta connections" />
        ) : list.length === 0 ? (
          <p>
            No Meta connection yet.{' '}
            <Button variant="link" isInline onClick={onAddConnection}>
              Add Meta connection
            </Button>
          </p>
        ) : (
          <Form id="cloud-number-form" onSubmit={onSubmit}>
            <FormGroup label="Meta connection" fieldId="cloud-number-connection" isRequired>
              <FormSelect
                id="cloud-number-connection"
                value={connectionId}
                onChange={(_e, v) => {
                  setConnectionId(v);
                  runCheck(v);
                }}
              >
                <FormSelectOption value="" label="Choose a connection" isPlaceholder />
                {list.map((c) => (
                  <FormSelectOption key={c.id} value={c.id} label={c.name} />
                ))}
              </FormSelect>
            </FormGroup>
            {checking.busy && <Spinner size="md" aria-label="Asking Meta" />}
            {checking.error && <Alert variant="danger" isInline isPlain title={checking.error} />}
            {invalid && (
              <Alert variant="danger" isInline isPlain title="Meta does not accept this connection's token">
                {check?.connection.lastError}
              </Alert>
            )}
            {check && !invalid && (
              <>
                {check.accounts.flatMap((a) =>
                  a.numbers.map((n) => (
                    <Radio
                      key={n.metaPhoneNumberId}
                      id={`cloud-number-${n.metaPhoneNumberId}`}
                      name="cloud-number-pick"
                      isDisabled={Boolean(n.phoneNumberId)}
                      isChecked={picked?.metaPhoneNumberId === n.metaPhoneNumberId}
                      onChange={() => setPicked({ wabaId: a.wabaId, metaPhoneNumberId: n.metaPhoneNumberId })}
                      label={`${n.displayPhoneNumber ?? n.metaPhoneNumberId} · ${n.verifiedName ?? 'no display name'}`}
                      description={
                        n.phoneNumberId
                          ? 'Already added'
                          : `${a.wabaName ?? a.wabaId} · quality ${n.qualityRating ?? 'unknown'}${
                              n.nameStatus ? ` · name ${n.nameStatus.toLowerCase()}` : ''
                            }`
                      }
                    />
                  )),
                )}
                {check.accounts.every((a) => a.numbers.length === 0) && (
                  <p>Meta lists no numbers for this token. Type the WhatsApp account (WABA) ID to look it up.</p>
                )}
                <FormGroup label="WhatsApp account (WABA) ID" fieldId="cloud-number-waba">
                  <TextInput
                    id="cloud-number-waba"
                    value={typedWaba}
                    onChange={(_e, v) => setTypedWaba(v)}
                    validated={checking.fieldErrors.wabaId ? 'error' : 'default'}
                    placeholder="Only if your number is not listed"
                  />
                  <Button
                    variant="secondary"
                    className="pf-v6-u-mt-sm"
                    isDisabled={!typedWaba.trim() || checking.busy}
                    onClick={() => runCheck(connectionId, typedWaba)}
                  >
                    Look up
                  </Button>
                  {checking.fieldErrors.wabaId && (
                    <FormHelperText>
                      <HelperText>
                        <HelperTextItem variant="error">{checking.fieldErrors.wabaId}</HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  )}
                </FormGroup>
                <FormGroup label="Label" fieldId="cloud-number-label">
                  <TextInput
                    id="cloud-number-label"
                    value={label}
                    onChange={(_e, v) => setLabel(v)}
                    placeholder="Optional, e.g. Admissions"
                  />
                </FormGroup>
              </>
            )}
          </Form>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          type="submit"
          form="cloud-number-form"
          isDisabled={!picked || invalid || action.busy}
          isLoading={action.busy}
        >
          Add
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
