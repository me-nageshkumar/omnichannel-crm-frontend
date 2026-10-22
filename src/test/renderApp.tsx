import * as React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@app/AppShell';

/**
 * Renders the whole app at {@code path}, as the browser would after navigating there. {@code extra}
 * is rendered inside the session provider (e.g. a probe component that reads the session).
 * {@code userOptions} go to user-event (e.g. {@code advanceTimers} under fake timers).
 */
export function renderApp(path = '/', extra?: React.ReactNode, userOptions?: Parameters<typeof userEvent.setup>[0]) {
  const user = userEvent.setup(userOptions);
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>{extra}</AppShell>
    </MemoryRouter>,
  );
  return { user, ...result };
}
