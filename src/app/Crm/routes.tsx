import * as React from 'react';
import { Bullseye, Spinner } from '@patternfly/react-core';
import type { IAppRoute } from '@app/routes';
import { CrmGate } from '@app/Crm/status/CrmGate';

// Each page is its own chunk, fetched only when the CrmGate lets it render.
const PipelinesPage = React.lazy(() =>
  import('@app/Crm/Pipelines/PipelinesPage').then((m) => ({ default: m.PipelinesPage })),
);
const CrmContactsPage = React.lazy(() =>
  import('@app/Crm/Contacts/CrmContactsPage').then((m) => ({ default: m.CrmContactsPage })),
);
const CrmContactDetailPage = React.lazy(() =>
  import('@app/Crm/Contacts/CrmContactDetailPage').then((m) => ({ default: m.CrmContactDetailPage })),
);
const CompaniesPage = React.lazy(() =>
  import('@app/Crm/Companies/CompaniesPage').then((m) => ({ default: m.CompaniesPage })),
);
const CompanyDetailPage = React.lazy(() =>
  import('@app/Crm/Companies/CompanyDetailPage').then((m) => ({ default: m.CompanyDetailPage })),
);
const TasksPage = React.lazy(() => import('@app/Crm/tasks/TasksPage').then((m) => ({ default: m.TasksPage })));
const CrmSettingsPage = React.lazy(() =>
  import('@app/Crm/Settings/CrmSettingsPage').then((m) => ({ default: m.CrmSettingsPage })),
);

/** The gate sits outside Suspense, so an off brand never starts the chunk download. */
const page = (path: string, Page: React.LazyExoticComponent<React.FunctionComponent>): IAppRoute => ({
  path,
  requires: (a) => a.hasInWorkspace('crm:view'),
  element: (
    <CrmGate>
      <React.Suspense
        fallback={
          <Bullseye>
            <Spinner aria-label="Loading" />
          </Bullseye>
        }
      >
        <Page />
      </React.Suspense>
    </CrmGate>
  ),
});

export const crmRoutes: IAppRoute[] = [
  page('/crm', PipelinesPage),
  page('/crm/deals/:dealId', PipelinesPage),
  page('/crm/contacts', CrmContactsPage),
  page('/crm/contacts/:id', CrmContactDetailPage),
  page('/crm/companies', CompaniesPage),
  page('/crm/companies/:id', CompanyDetailPage),
  page('/crm/tasks', TasksPage),
  page('/crm/settings', CrmSettingsPage),
];
