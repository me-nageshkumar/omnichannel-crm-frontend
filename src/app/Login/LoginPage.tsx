import * as React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Bullseye, LoginForm, Spinner } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { login } from '@app/api/auth';
import { messageFor } from '@app/api/messages';
import { useSession } from '@app/session/SessionContext';
import { useDocumentTitle } from '@app/utils/useDocumentTitle';
import { LoginFrame, fromOf } from '@app/Login/LoginFrame';

const ConsoleLoginPage: React.FunctionComponent = () => {
  useDocumentTitle('Log in | Omnichannel CRM');
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const from = fromOf(location.state);

  if (session.status === 'loading') {
    return (
      <Bullseye>
        <Spinner aria-label="Loading" />
      </Bullseye>
    );
  }
  if (session.status === 'signedIn') {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    setError(null);
    session.showNotice(null);
    setBusy(true);
    try {
      const result = await login(username, password);
      if (result.kind === 'twoFactorRequired') {
        session.startTwoFactor(result.twoFactorToken);
        navigate('/login/verify', { state: { from } });
      } else if (result.kind === 'passwordChangeRequired') {
        session.startPasswordChange(result.passwordChangeToken);
        navigate('/login/new-password', { state: { from } });
      } else {
        await session.signIn(result.token, result.expiresAt);
      }
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LoginFrame title="Log in to your account" notice={session.notice}>
      <LoginForm
        showHelperText={error !== null}
        helperText={error}
        helperTextIcon={<ExclamationCircleIcon />}
        usernameLabel="Username"
        usernameValue={username}
        onChangeUsername={(_e, v) => setUsername(v)}
        isValidUsername={error === null}
        passwordLabel="Password"
        passwordValue={password}
        onChangePassword={(_e, v) => setPassword(v)}
        isValidPassword={error === null}
        isShowPasswordEnabled
        showPasswordAriaLabel="Show password"
        hidePasswordAriaLabel="Hide password"
        isLoginButtonDisabled={busy}
        loginButtonLabel="Log in"
        onLoginButtonClick={onSubmit}
      />
    </LoginFrame>
  );
};

export { ConsoleLoginPage as LoginPage };
