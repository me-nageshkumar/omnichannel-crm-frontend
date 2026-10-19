import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Dashboard } from '@app/Dashboard/Dashboard';
import { ProfilePage } from '@app/Profile/ProfilePage';
import { NotFound } from '@app/NotFound/NotFound';

export interface IAppRoute {
  label?: string; // Excluding the label will exclude the route from the nav sidebar in AppLayout
  element: React.ReactElement;
  path: string;
}

const routes: IAppRoute[] = [
  { element: <Dashboard />, label: 'Dashboard', path: '/' },
  { element: <ProfilePage />, label: 'Profile', path: '/profile' },
];

const AppRoutes = (): React.ReactElement => (
  <Routes>
    {routes.map(({ path, element }) => (
      <Route path={path} element={element} key={path} />
    ))}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export { AppRoutes, routes };
