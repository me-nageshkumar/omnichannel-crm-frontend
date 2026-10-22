import * as React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, MemoryRouterProps, useLocation } from 'react-router-dom';
import { AppShell } from '@app/AppShell';

export type InitialEntry = NonNullable<MemoryRouterProps['initialEntries']>[number];

/** Shows the router's current pathname, for asserting where a click navigated. */
export const LocationProbe: React.FunctionComponent = () => (
  <output aria-label="Location">{useLocation().pathname}</output>
);

/**
 * Renders the whole app at {@code path} (a path, or {@code { pathname, state }}), as the browser would after navigating there. {@code extra}
 * is rendered inside the session provider (e.g. a probe component that reads the session).
 * {@code userOptions} go to user-event (e.g. {@code advanceTimers} under fake timers).
 */
export function renderApp(
  path: InitialEntry = '/',
  extra?: React.ReactNode,
  userOptions?: Parameters<typeof userEvent.setup>[0],
) {
  const user = userEvent.setup(userOptions);
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>{extra}</AppShell>
    </MemoryRouter>,
  );
  return { user, ...result };
}
