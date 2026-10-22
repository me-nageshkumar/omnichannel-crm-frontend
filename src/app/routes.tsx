import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Dashboard } from '@app/Dashboard/Dashboard';
import { ProfilePage } from '@app/Profile/ProfilePage';
import { NotFound } from '@app/NotFound/NotFound';
import { PlatformUsersPage } from '@app/PlatformUsers/PlatformUsersPage';
import { AuthoritiesPage } from '@app/Authorities/AuthoritiesPage';
import { RolesPage } from '@app/Roles/RolesPage';
import { CustomersPage } from '@app/Customers/CustomersPage';
import { CustomerDetailPage } from '@app/Customers/CustomerDetailPage';
import { BrandsPage } from '@app/Brands/BrandsPage';
import { UsersPage } from '@app/Users/UsersPage';
import { TeamsPage } from '@app/Teams/TeamsPage';
import { PhoneNumbersPage } from '@app/PhoneNumbers/PhoneNumbersPage';
import { AllPhoneNumbersPage } from '@app/PhoneNumbers/AllPhoneNumbersPage';
import { ContactsPage } from '@app/Contacts/ContactsPage';
import { ContactDetailPage } from '@app/Contacts/ContactDetailPage';
import { ContactFieldsPage } from '@app/Contacts/ContactFieldsPage';
import { FilterBuilderPage } from '@app/Contacts/Filters/FilterBuilderPage';
import { TemplatesPage } from '@app/Templates/TemplatesPage';
import { TemplateEditorPage } from '@app/Templates/TemplateEditorPage';
import { CampaignsPage } from '@app/Campaigns/CampaignsPage';
import { SendersPage } from '@app/Campaigns/SendersPage';
import { CampaignSettingsPage } from '@app/Campaigns/CampaignSettingsPage';
import { NewCampaignPage } from '@app/Campaigns/NewCampaign/NewCampaignPage';
import { CampaignDetailPage } from '@app/Campaigns/CampaignDetailPage';
import { InboxNumbersPage } from '@app/Inbox/InboxNumbersPage';
import { InboxPage } from '@app/Inbox/InboxPage';
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
    element: <AuthoritiesPage />,
    label: 'Authorities',
    path: '/authorities',
    group: 'Platform',
    requires: (a) => a.superAdmin,
  },
  {
    element: <CustomersPage />,
    label: 'Customers',
    path: '/customers',
    group: 'Platform',
    requires: (a) => a.has('customer:view'),
  },
  {
    element: <CustomerDetailPage />,
    path: '/customers/:id',
    requires: (a) => a.has('customer:view'),
  },
  {
    element: <AllPhoneNumbersPage />,
    label: 'All phone numbers',
    path: '/platform/phone-numbers',
    group: 'Platform',
    requires: (a) => a.has('phone-number:view-all'),
  },
  {
    element: <BrandsPage />,
    label: 'Brands',
    path: '/brands',
    group: 'Company',
    requires: (a) => a.has('workspace:create'),
  },
  {
    element: <InboxNumbersPage />,
    label: 'Inbox',
    path: '/inbox',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('inbox:view'),
  },
  {
    element: <InboxPage />,
    path: '/inbox/:phoneNumberId',
    requires: (a) => a.hasInWorkspace('inbox:view'),
  },
  {
    element: <InboxPage />,
    path: '/inbox/:phoneNumberId/:chatId',
    requires: (a) => a.hasInWorkspace('inbox:view'),
  },
  {
    element: <UsersPage />,
    label: 'Users',
    path: '/users',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('user:view'),
  },
  {
    element: <TeamsPage />,
    label: 'Teams',
    path: '/teams',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('user:view'),
  },
  {
    element: <PhoneNumbersPage />,
    label: 'Phone numbers',
    path: '/phone-numbers',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('phone-number:view'),
  },
  {
    element: <ContactsPage />,
    label: 'Contacts',
    path: '/contacts',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('contact:view'),
  },
  // Keep before /contacts/:id, which would otherwise capture "filters".
  {
    element: <FilterBuilderPage />,
    path: '/contacts/filters/new',
    requires: (a) => a.hasInWorkspace('contact:view'),
  },
  {
    element: <FilterBuilderPage />,
    path: '/contacts/filters/:id',
    requires: (a) => a.hasInWorkspace('contact:view'),
  },
  {
    element: <ContactDetailPage />,
    path: '/contacts/:id',
    requires: (a) => a.hasInWorkspace('contact:view'),
  },
  {
    element: <ContactFieldsPage />,
    label: 'Contact fields',
    path: '/contact-fields',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('contact-field:manage'),
  },
  {
    element: <TemplatesPage />,
    label: 'Templates',
    path: '/templates',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('template:view'),
  },
  {
    element: <TemplateEditorPage />,
    path: '/templates/new',
    requires: (a) => a.hasInWorkspace('template:view'),
  },
  {
    element: <TemplateEditorPage />,
    path: '/templates/:id',
    requires: (a) => a.hasInWorkspace('template:view'),
  },
  {
    element: <CampaignsPage />,
    label: 'Campaigns',
    path: '/campaigns',
    group: 'Brand',
    requires: (a) => a.hasInWorkspace('campaign:view'),
  },
  // Keep before any /campaigns/:id route, which would otherwise capture "new", "senders" and "settings".
  {
    element: <NewCampaignPage />,
    path: '/campaigns/new',
    requires: (a) => a.hasInWorkspace('campaign:view'),
  },
  {
    element: <SendersPage />,
    path: '/campaigns/senders',
    requires: (a) => a.hasInWorkspace('campaign:view'),
  },
  {
    element: <CampaignSettingsPage />,
    path: '/campaigns/settings',
    requires: (a) => a.hasInWorkspace('campaign:view'),
  },
  {
    element: <CampaignDetailPage />,
    path: '/campaigns/:id',
    requires: (a) => a.hasInWorkspace('campaign:view'),
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
