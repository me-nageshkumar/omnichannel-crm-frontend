import * as React from 'react';
import { AppLayout } from '@app/AppLayout/AppLayout';
import { AppRoutes } from '@app/routes';

/** Everything inside the router; tests render it in a MemoryRouter. */
const AppShell: React.FunctionComponent = () => (
  <AppLayout>
    <AppRoutes />
  </AppLayout>
);

export { AppShell };
