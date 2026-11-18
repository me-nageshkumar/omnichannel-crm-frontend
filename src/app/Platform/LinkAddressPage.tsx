import * as React from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  Content,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Spinner,
  TextInput,
} from '@patternfly/react-core';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { type PlatformPagesAddress, getPlatformPagesAddress, savePlatformPagesAddress } from '@app/api/pagesAddresses';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';

/** The platform's own link address (link addresses spec §5.9): what every brand without a working one uses. */
export const LinkAddressPage: React.FunctionComponent = () => {
  const { token } = useSession();
  const loaded = useLoad((t) => getPlatformPagesAddress(t), []);
  const [text, setText] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<PlatformPagesAddress | null>(null);
  const [busy, setBusy] = React.useState(false);

  const current = loaded.data;
  const value = text ?? current?.baseUrl ?? '';

  const save = async (baseUrl: string | null) => {
    if (!current || busy) return;
    setBusy(true);
    setFieldError(null);
    setError(null);
    setSaved(null);
    try {
      const after = await savePlatformPagesAddress(token as string, baseUrl, current.version);
      loaded.setData(() => after);
      setText(null);
      setSaved(after);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.fields?.baseUrl) setFieldError(e.fields.baseUrl);
      else setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Link address">
      <Content component="p">
        Message and form links use this address unless the brand has a working address of its own.
      </Content>
      {loaded.error && <Alert variant="danger" isInline title={loaded.error} />}
      {!current && !loaded.error && <Spinner aria-label="Loading the link address" />}
      {current && (
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            void save(value.trim());
          }}
        >
          {error && <Alert variant="danger" isInline isPlain title={error} />}
          {saved && <Alert variant="success" isInline isPlain title="Address saved" />}
          {saved?.warning && (
            <Alert variant="warning" isInline title={`The address was saved, but the check failed: ${saved.warning}`} />
          )}
          <FormGroup label="Address" fieldId="platform-link-address">
            <TextInput
              id="platform-link-address"
              aria-label="Address"
              type="url"
              value={value}
              validated={fieldError ? 'error' : 'default'}
              aria-invalid={fieldError ? true : undefined}
              onChange={(_e, v) => {
                setText(v);
                setFieldError(null);
              }}
            />
            <FormHelperText>
              <HelperText>
                {fieldError && <HelperTextItem variant="error">{fieldError}</HelperTextItem>}
                <HelperTextItem>
                  {current.source === 'STARTUP'
                    ? 'From the startup settings. Saving here replaces it until you choose Use the startup setting.'
                    : `Saved here. The startup setting is ${current.startupBaseUrl}.`}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <ActionGroup>
            <Button variant="primary" type="submit" isDisabled={busy} isLoading={busy}>
              Save
            </Button>
            {current.source === 'SAVED' && (
              <Button variant="link" isDisabled={busy} onClick={() => void save(null)}>
                Use the startup setting
              </Button>
            )}
          </ActionGroup>
        </Form>
      )}
    </PageShell>
  );
};
