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
import { MetaConnection, createMetaConnection, updateMetaConnection } from '@app/api/metaConnections';
import { useAction } from '@app/admin/useAction';
import { useSession } from '@app/session/SessionContext';
import { SecretField } from '@app/AI/SecretField';

/** Adds a brand's Meta app, or edits one: the app secret and token are write-only (spec 2026-11-20 §5.7). */
export const MetaConnectionModal: React.FunctionComponent<{
  existing?: MetaConnection;
  onSaved(saved: MetaConnection): void;
  onCancel(): void;
}> = ({ existing, onSaved, onCancel }) => {
  const { token, workspace } = useSession();
  const ws = workspace?.id ?? '';
  const [name, setName] = React.useState(existing?.name ?? '');
  const [appId, setAppId] = React.useState(existing?.appId ?? '');
  const [appSecret, setAppSecret] = React.useState('');
  const [accessToken, setAccessToken] = React.useState('');
  const action = useAction(['name', 'appId', 'appSecret', 'accessToken']);

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const result = await action.run(() =>
      existing
        ? updateMetaConnection(token as string, ws, existing.id, { name, appSecret, accessToken })
        : createMetaConnection(token as string, ws, { name, appId: appId.trim(), appSecret, accessToken }),
    );
    if (result !== undefined) onSaved(result);
  };

  return (
    <Modal isOpen variant="small" onClose={onCancel} aria-labelledby="meta-connection-title">
      <ModalHeader title={existing ? `Edit ${existing.name}` : 'Add Meta connection'} labelId="meta-connection-title" />
      <ModalBody>
        {action.error && <Alert variant="danger" isInline isPlain title={action.error} />}
        <Form id="meta-connection-form" onSubmit={onSubmit}>
          <FormGroup label="Name" fieldId="meta-connection-name" isRequired>
            <TextInput
              id="meta-connection-name"
              value={name}
              onChange={(_e, v) => setName(v)}
              validated={action.fieldErrors.name ? 'error' : 'default'}
              placeholder="e.g. Bimal Institute app"
            />
            {action.fieldErrors.name && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{action.fieldErrors.name}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          <FormGroup label="App ID" fieldId="meta-connection-app-id" isRequired={!existing}>
            <TextInput
              id="meta-connection-app-id"
              value={appId}
              onChange={(_e, v) => setAppId(v)}
              isDisabled={Boolean(existing)}
              validated={action.fieldErrors.appId ? 'error' : 'default'}
              placeholder="From the Meta app dashboard"
            />
            {action.fieldErrors.appId && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{action.fieldErrors.appId}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          <SecretField
            id="meta-connection-app-secret"
            label="App secret"
            hint={existing?.appSecretHint ?? null}
            setAt={existing?.appSecretSetAt ?? null}
            value={appSecret}
            onChange={setAppSecret}
            isRequired
            error={action.fieldErrors.appSecret}
            replaceLabel="Replace"
          />
          <SecretField
            id="meta-connection-token"
            label="Access token"
            hint={existing?.tokenHint ?? null}
            setAt={existing?.tokenSetAt ?? null}
            value={accessToken}
            onChange={setAccessToken}
            isRequired
            error={action.fieldErrors.accessToken}
            replaceLabel="Replace"
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" form="meta-connection-form" isDisabled={action.busy} isLoading={action.busy}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
