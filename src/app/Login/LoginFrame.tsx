import * as React from 'react';
import { Alert, LoginPage } from '@patternfly/react-core';
import { MESSAGES } from '@app/api/messages';

const INFO_NOTICES = [MESSAGES.sessionExpired, MESSAGES.loggedOutElsewhere];

/** The PatternFly login page frame shared by the password and code screens. */
export const LoginFrame: React.FunctionComponent<{
  title: string;
  notice: string | null;
  children: React.ReactNode;
}> = ({ title, notice, children }) => (
  <LoginPage loginTitle={title} textContent="Omnichannel CRM">
    {notice && (
      <Alert
        variant={INFO_NOTICES.includes(notice) ? 'info' : 'danger'}
        isInline
        isPlain
        title={notice}
        style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
      />
    )}
    {children}
  </LoginPage>
);

/** Where to go after signing in: the page that sent the user to /login, else the dashboard. */
export function fromOf(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('/login') ? from : '/';
}
