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
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { type BrandPagesAddress, setBrandPagesAddress } from '@app/api/pagesAddresses';
import { customerStep } from '@app/Customers/linkAddressText';
import { useSession } from '@app/session/SessionContext';

const TAKEN = 'Another customer uses this domain.';
const STALE = 'Someone else changed this address. Close and open it again.';
const CERTIFICATE_NOTE =
  'A new subdomain can need a minute for its certificate. If the first check fails, check again.';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Sets or changes a brand's link address; the server checks it before answering. */
export const LinkAddressDialog: React.FunctionComponent<{
  customerId: string;
  brand: BrandPagesAddress;
  platformBaseUrl: string;
  onDone(row: BrandPagesAddress): void;
  onCancel(): void;
}> = ({ customerId, brand, platformBaseUrl, onDone, onCancel }) => {
  const { token } = useSession();
  const [text, setText] = React.useState(brand.address?.baseUrl ?? '');
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const step = customerStep(text, platformBaseUrl);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFieldError(null);
    setError(null);
    try {
      onDone(await setBrandPagesAddress(token as string, customerId, brand.workspaceId, text.trim(), brand.version));
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.fields?.baseUrl) setFieldError(e.fields.baseUrl);
      else if (e instanceof ApiError && e.code === 'PAGES_HOST_TAKEN') setFieldError(TAKEN);
      else if (e instanceof ApiError && e.status === 409) setError(STALE);
      else setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen variant="medium" onClose={onCancel} aria-labelledby="link-address-title">
      <ModalHeader title={`Link address of ${brand.workspaceName}`} labelId="link-address-title" />
      <ModalBody>
        <Form
          id="link-address-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {error && <Alert variant="danger" isInline isPlain title={error} />}
          <FormGroup label="Address" fieldId="link-address-url">
            <TextInput
              id="link-address-url"
              aria-label="Address"
              type="url"
              placeholder="https://links.example.com"
              value={text}
              autoFocus
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
                {step && <HelperTextItem>{step}</HelperTextItem>}
                <HelperTextItem>{CERTIFICATE_NOTE}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          {brand.address && (
            <p>{`${hostOf(brand.address.baseUrl)} must keep working for 90 days after the change, for links already sent.`}</p>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="link-address-form" isDisabled={busy} isLoading={busy}>
          Save
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
