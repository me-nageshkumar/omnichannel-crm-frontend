import * as React from 'react';
import type { IAppRoute } from '@app/routes';
import { BillingSettingsPage } from '@app/Billing/platform/BillingSettingsPage';
import { PlanEditorPage } from '@app/Billing/platform/PlanEditorPage';
import { PlansPage } from '@app/Billing/platform/PlansPage';

const seesPlans: IAppRoute['requires'] = (a) => a.has('plan:manage') || a.has('subscription:view');

export const billingRoutes: IAppRoute[] = [
  { path: '/platform/plans', requires: seesPlans, element: <PlansPage /> },
  { path: '/platform/plans/new', requires: (a) => a.has('plan:manage'), element: <PlanEditorPage /> },
  { path: '/platform/plans/:code', requires: seesPlans, element: <PlanEditorPage /> },
  {
    path: '/platform/billing-settings',
    requires: (a) => a.has('billing-settings:manage'),
    element: <BillingSettingsPage />,
  },
];
