import * as React from 'react';
import type { IAppRoute } from '@app/routes';
import { MyBillingPage } from '@app/Billing/my/MyBillingPage';
import { BillingSettingsPage } from '@app/Billing/platform/BillingSettingsPage';
import { PlanEditorPage } from '@app/Billing/platform/PlanEditorPage';
import { PlansPage } from '@app/Billing/platform/PlansPage';
import { RequestsPage } from '@app/Billing/platform/RequestsPage';

const seesPlans: IAppRoute['requires'] = (a) => a.has('plan:manage') || a.has('subscription:view');

export const billingRoutes: IAppRoute[] = [
  { path: '/billing', requires: (a) => a.has('billing:view'), element: <MyBillingPage /> },
  { path: '/platform/plans', requires: seesPlans, element: <PlansPage /> },
  { path: '/platform/plans/new', requires: (a) => a.has('plan:manage'), element: <PlanEditorPage /> },
  { path: '/platform/plans/:code', requires: seesPlans, element: <PlanEditorPage /> },
  { path: '/platform/billing-requests', requires: (a) => a.has('subscription:view'), element: <RequestsPage /> },
  {
    path: '/platform/billing-settings',
    requires: (a) => a.has('billing-settings:manage'),
    element: <BillingSettingsPage />,
  },
];
