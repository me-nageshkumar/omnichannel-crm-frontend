import * as React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ActionGroup,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  TextInput,
} from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';
import { setInitialPassword } from '@app/api/auth';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';
import { LoginFrame, fromOf } from '@app/Login/LoginFrame';

export const MIN_PASSWORD_LENGTH = 10;

const PasswordField: React.FunctionComponent<{
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  error: string | null;
  hint?: string;
}> = ({ id, label, value, onChange, error, hint }) => {
  const [shown, setShown] = React.useState(false);
  return (
    <FormGroup label={label} fieldId={id} isRequired>
      <InputGroup>
        <InputGroupItem isFill>
          <TextInput
            id={id}
            type={shown ? 'text' : 'password'}
            value={value}
            onChange={(_e, v) => onChange(v)}
            autoComplete="new-password"
            validated={error ? 'error' : 'default'}
            isRequired
          />
        </InputGroupItem>
        <InputGroupItem>
          <Button
            variant="control"
            aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            onClick={() => setShown(!shown)}
            icon={shown ? <EyeSlashIcon /> : <EyeIcon />}
          />
        </InputGroupItem>
      </InputGroup>
      {(error || hint) && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant={error ? 'error' : 'default'}>{error ?? hint}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
};

/** First login: replace the temporary password. Needs the in-memory change token, so a refresh lands on /login. */
export const NewPasswordPage: React.FunctionComponent = () => {
  useDocumentTitle('Choose a new password | Omnichannel CRM');
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const from = fromOf(location.state);

  if (session.status === 'signedIn') {
    return <Navigate to={from} replace />;
  }
  if (!session.pendingPasswordChangeToken) {
    return <Navigate to="/login" state={{ from }} replace />;
  }
  const pending = session.pendingPasswordChangeToken;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const tooShort = password.length < MIN_PASSWORD_LENGTH;
    const mismatch = password !== confirm;
    setPasswordError(tooShort ? `At least ${MIN_PASSWORD_LENGTH} characters.` : null);
    setConfirmError(!tooShort && mismatch ? "Passwords don't match." : null);
    if (tooShort || mismatch) return;
    setBusy(true);
    try {
      const issued = await setInitialPassword(pending, password);
      await session.signIn(issued.token, issued.expiresAt);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        session.startPasswordChange('');
        session.showNotice(messageFor(e));
        navigate('/login', { state: { from }, replace: true });
        return;
      }
      setPasswordError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginFrame title="Choose a new password" notice={session.notice}>
      <Form onSubmit={onSubmit}>
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          error={passwordError}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          error={confirmError}
        />
        <ActionGroup>
          <Button type="submit" isBlock isDisabled={busy}>
            Save and continue
          </Button>
        </ActionGroup>
      </Form>
    </LoginFrame>
  );
};
