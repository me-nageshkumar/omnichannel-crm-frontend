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
  TextInput,
} from '@patternfly/react-core';
import { verifyOtp } from '@app/api/auth';
import { ApiError } from '@app/api/client';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';
import { LoginFrame, fromOf } from '@app/Login/LoginFrame';

/** Step two of login: the 6-digit code. Needs the in-memory pending token, so a refresh lands on /login. */
export const VerifyCodePage: React.FunctionComponent = () => {
  useDocumentTitle('Verification code | Omnichannel CRM');
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const from = fromOf(location.state);

  if (session.status === 'signedIn') {
    return <Navigate to={from} replace />;
  }
  if (!session.pendingTwoFactorToken) {
    return <Navigate to="/login" state={{ from }} replace />;
  }
  const pending = session.pendingTwoFactorToken;

  const backToLogin = (notice: string | null) => {
    session.startTwoFactor('');
    session.showNotice(notice);
    navigate('/login', { state: { from }, replace: true });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const issued = await verifyOtp(pending, code.trim());
      await session.signIn(issued.token, issued.expiresAt);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'invalid_token') {
        backToLogin(messageFor(e));
        return;
      }
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginFrame title="Enter your verification code" notice={session.notice}>
      <Form onSubmit={onSubmit}>
        <FormGroup label="6-digit code" fieldId="otp" isRequired>
          <TextInput
            id="otp"
            value={code}
            onChange={(_e, v) => setCode(v)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            validated={error ? 'error' : 'default'}
            isRequired
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant={error ? 'error' : 'default'}>
                {error ?? 'Open your authenticator app and enter the code it shows.'}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
        <ActionGroup>
          <Button type="submit" isBlock isDisabled={busy || code.trim().length === 0}>
            Verify
          </Button>
          <Button variant="link" isInline onClick={() => backToLogin(null)}>
            Back to log in
          </Button>
        </ActionGroup>
      </Form>
    </LoginFrame>
  );
};
