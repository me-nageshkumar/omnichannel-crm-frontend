import * as React from 'react';
import type { IAppRoute } from '@app/routes';
import { PlansPage } from '@app/Billing/platform/PlansPage';

const seesPlans: IAppRoute['requires'] = (a) => a.has('plan:manage') || a.has('subscription:view');

export const billingRoutes: IAppRoute[] = [{ path: '/platform/plans', requires: seesPlans, element: <PlansPage /> }];
