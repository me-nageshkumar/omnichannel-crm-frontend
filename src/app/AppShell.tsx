import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@app/AppLayout/AppLayout';
import { AppRoutes } from '@app/routes';
import { LoginPage } from '@app/Login/LoginPage';
import { VerifyCodePage } from '@app/Login/VerifyCodePage';
import { RequireSession } from '@app/session/RequireSession';
import { SessionProvider } from '@app/session/SessionContext';

/** Everything inside the router; tests render it in a MemoryRouter. */
const AppShell: React.FunctionComponent = () => (
  <SessionProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/verify" element={<VerifyCodePage />} />
      <Route
        path="*"
        element={
          <RequireSession>
            <AppLayout>
              <AppRoutes />
            </AppLayout>
          </RequireSession>
        }
      />
    </Routes>
  </SessionProvider>
);

export { AppShell };
