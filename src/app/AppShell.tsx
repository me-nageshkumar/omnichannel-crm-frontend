import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@app/AppLayout/AppLayout';
import { AppRoutes } from '@app/routes';
import { LoginPage } from '@app/Login/LoginPage';
import { VerifyCodePage } from '@app/Login/VerifyCodePage';
import { NewPasswordPage } from '@app/Login/NewPasswordPage';
import { RequireSession } from '@app/session/RequireSession';
import { SessionProvider } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';

/** Everything inside the router; tests render it in a MemoryRouter. */
const AppShell: React.FunctionComponent<{ children?: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <SessionProvider>
      {children}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/verify" element={<VerifyCodePage />} />
        <Route path="/login/new-password" element={<NewPasswordPage />} />
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
  </ThemeProvider>
);

export { AppShell };
