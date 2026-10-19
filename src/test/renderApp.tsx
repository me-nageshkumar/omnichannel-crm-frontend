import * as React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@app/AppShell';

/** Renders the whole app at {@code path}, as the browser would after navigating there. */
export function renderApp(path = '/') {
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  );
  return { user, ...result };
}
