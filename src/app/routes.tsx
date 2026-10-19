import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Dashboard } from '@app/Dashboard/Dashboard';
import { ProfilePage } from '@app/Profile/ProfilePage';
import { NotFound } from '@app/NotFound/NotFound';
import { PageShell } from '@app/admin/PageShell';
import { PlatformUsersPage } from '@app/PlatformUsers/PlatformUsersPage';
import { RolesPage } from '@app/Roles/RolesPage';
import { Access, useAccess } from '@app/session/useAccess';

export type NavGroup = 'Platform' | 'Company' | 'Brand';

export interface IAppRoute {
  label?: string; // Excluding the label will exclude the route from the nav sidebar in AppLayout
  element: React.ReactElement;
  path: string;
  /** Who may open the page; everyone signed in when absent. */
  requires?: (a: Access) => boolean;
  group?: NavGroup;
}

export const NAV_GROUPS: NavGroup[] = ['Platform', 'Company', 'Brand'];

const routes: IAppRoute[] = [
  { element: <Dashboard />, label: 'Dashboard', path: '/' },
  { element: <ProfilePage />, label: 'Profile', path: '/profile' },
  {
    element: <PlatformUsersPage />,
    label: 'Platform users',
    path: '/platform-users',
    group: 'Platform',
    requires: (a) => a.has('platform-user:manage'),
  },
  {
    element: <RolesPage />,
    label: 'Roles',
    path: '/roles',
    group: 'Platform',
    requires: (a) => a.superAdmin,
  },
  {
    element: <PageShell title="Customers" />,
    label: 'Customers',
    path: '/customers',
    group: 'Platform',
    requires: (a) => a.has('customer:view'),
  },
  {
    element: <PageShell title="Customer" />,
    path: '/customers/:id',
    requires: (a) => a.has('customer:view'),
  },
  {
    element: <PageShell title="Brands" />,
    label: 'Brands',
    path: '/brands',
    group: 'Company',
    requires: (a) => a.has('workspace:create'),
  },
  {
    element: <PageShell title="Users" />,
    label: 'Users',
    path: '/users',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('user:view'),
  },
  {
    element: <PageShell title="Teams" />,
    label: 'Teams',
    path: '/teams',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('user:view'),
  },
];

/** The routes the signed-in user may open. */
export function useAllowedRoutes(): IAppRoute[] {
  const access = useAccess();
  return routes.filter((r) => !r.requires || r.requires(access));
}

const AppRoutes = (): React.ReactElement => {
  const allowed = useAllowedRoutes();
  return (
    <Routes>
      {allowed.map(({ path, element }) => (
        <Route path={path} element={element} key={path} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export { AppRoutes, routes };
