import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { useSession } from '@app/session/SessionContext';

/** Renders children only for a signed-in user; otherwise sends them to /login and back afterwards. */
export const RequireSession: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useSession();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <Bullseye>
        <Spinner aria-label="Loading" />
      </Bullseye>
    );
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};
