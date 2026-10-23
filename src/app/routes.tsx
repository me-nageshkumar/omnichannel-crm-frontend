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
import { SavedFiltersPage } from '@app/Contacts/Filters/SavedFiltersPage';
import { FilterBuilderPage } from '@app/Contacts/Filters/FilterBuilderPage';
import { TemplatesPage } from '@app/Templates/TemplatesPage';
import { TemplateEditorPage } from '@app/Templates/TemplateEditorPage';
import { CampaignsPage } from '@app/Campaigns/CampaignsPage';
import { SendersPage } from '@app/Campaigns/SendersPage';
import { CampaignSettingsPage } from '@app/Campaigns/CampaignSettingsPage';
import { NewCampaignPage } from '@app/Campaigns/NewCampaign/NewCampaignPage';
import { CampaignDetailPage } from '@app/Campaigns/CampaignDetailPage';
import { InboxRedirect } from '@app/Inbox/InboxRedirect';
import { InboxPage } from '@app/Inbox/InboxPage';
import { RoutingSettingsPage } from '@app/Inbox/RoutingSettingsPage';
import { Access, useAccess } from '@app/session/useAccess';

export interface IAppRoute {
  element: React.ReactElement;
  path: string;
  /** Who may open the page; everyone signed in when absent. */
  requires?: (a: Access) => boolean;
}

/** A sidebar link to a route's path. */
export interface NavLinkEntry {
  label: string;
  path: string;
}

/** A sidebar group that expands to its links. */
export interface NavExpandableEntry {
  label: string;
  links: NavLinkEntry[];
}

export type NavEntry = NavLinkEntry | NavExpandableEntry;

export const isExpandable = (entry: NavEntry): entry is NavExpandableEntry => 'links' in entry;

/**
 * The sidebar, as on patternfly.org: sections split by a divider, each a list of links and expandable groups.
 * Everyday work first, then the brand's own setup, then company and platform administration.
 */
const NAV_SECTIONS: NavEntry[][] = [
  [
    { label: 'Dashboard', path: '/' },
    {
      label: 'Inbox',
      links: [
        { label: 'Inbox', path: '/inbox' },
        { label: 'Routing', path: '/inbox/routing' },
      ],
    },
  ],
  [
    {
      label: 'Contacts',
      links: [
        { label: 'All contacts', path: '/contacts' },
        { label: 'Saved filters', path: '/contacts/filters' },
        { label: 'Contact fields', path: '/contact-fields' },
      ],
    },
    {
      label: 'Campaigns',
      links: [
        { label: 'All campaigns', path: '/campaigns' },
        { label: 'Senders', path: '/campaigns/senders' },
        { label: 'Settings', path: '/campaigns/settings' },
      ],
    },
    { label: 'Templates', path: '/templates' },
    { label: 'Phone numbers', path: '/phone-numbers' },
    {
      label: 'Users and teams',
      links: [
        { label: 'Users', path: '/users' },
        { label: 'Teams', path: '/teams' },
      ],
    },
  ],
  [
    { label: 'Brands', path: '/brands' },
    {
      label: 'Platform',
      links: [
        { label: 'Customers', path: '/customers' },
        { label: 'All phone numbers', path: '/platform/phone-numbers' },
      ],
    },
    {
      label: 'Access control',
      links: [
        { label: 'Platform users', path: '/platform-users' },
        { label: 'Roles', path: '/roles' },
        { label: 'Authorities', path: '/authorities' },
      ],
    },
  ],
];

const routes: IAppRoute[] = [
  { element: <Dashboard />, path: '/' },
  { element: <ProfilePage />, path: '/profile' },
  {
    element: <PlatformUsersPage />,
    path: '/platform-users',
    requires: (a) => a.has('platform-user:manage'),
  },
  {
    element: <RolesPage />,
    path: '/roles',
    requires: (a) => a.superAdmin,
  },
  {
    element: <AuthoritiesPage />,
    path: '/authorities',
    requires: (a) => a.superAdmin,
  },
  {
    element: <CustomersPage />,
    path: '/customers',
    requires: (a) => a.has('customer:view'),
  },
  {
    element: <CustomerDetailPage />,
    path: '/customers/:id',
    requires: (a) => a.has('customer:view'),
  },
  {
    element: <AllPhoneNumbersPage />,
    path: '/platform/phone-numbers',
    requires: (a) => a.has('phone-number:view-all'),
  },
  {
    element: <BrandsPage />,
    path: '/brands',
    requires: (a) => a.has('workspace:create'),
  },
  {
    element: <InboxPage />,
    path: '/inbox',
    requires: (a) => a.hasInWorkspace('inbox:view'),
  },
  {
    element: <InboxPage />,
    path: '/inbox/chats/:chatId',
    requires: (a) => a.hasInWorkspace('inbox:view'),
  },
  {
    element: <RoutingSettingsPage />,
    path: '/inbox/routing',
    requires: (a) => a.hasInWorkspace('inbox:settings'),
  },
  {
    element: <InboxRedirect />,
    path: '/inbox/:phoneNumberId',
    requires: (a) => a.hasInWorkspace('inbox:view'),
  },
  {
    element: <InboxRedirect />,
    path: '/inbox/:phoneNumberId/:chatId',
    requires: (a) => a.hasInWorkspace('inbox:view'),
  },
  {
    element: <UsersPage />,
    path: '/users',
    requires: (a) => a.hasInWorkspace('user:view'),
  },
  {
    element: <TeamsPage />,
    path: '/teams',
    requires: (a) => a.hasInWorkspace('user:view'),
  },
  {
    element: <PhoneNumbersPage />,
    path: '/phone-numbers',
    requires: (a) => a.hasInWorkspace('phone-number:view'),
  },
  {
    element: <ContactsPage />,
    path: '/contacts',
    requires: (a) => a.hasInWorkspace('contact:view'),
  },
  // Keep before /contacts/:id, which would otherwise capture "filters".
  {
    element: <SavedFiltersPage />,
    path: '/contacts/filters',
    requires: (a) => a.hasInWorkspace('contact:view'),
  },
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
    path: '/contact-fields',
    requires: (a) => a.hasInWorkspace('contact-field:manage'),
  },
  {
    element: <TemplatesPage />,
    path: '/templates',
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
    path: '/campaigns',
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

/**
 * The sidebar sections the signed-in user may open. Groups keep only allowed links, a group left with one link
 * shows as that link, and empty groups and sections are dropped.
 */
export function useNavSections(): NavEntry[][] {
  const allowed = new Set(useAllowedRoutes().map((r) => r.path));
  return NAV_SECTIONS.map((section) =>
    section.flatMap((entry): NavEntry[] => {
      if (!isExpandable(entry)) return allowed.has(entry.path) ? [entry] : [];
      const links = entry.links.filter((link) => allowed.has(link.path));
      return links.length > 1 ? [{ ...entry, links }] : links;
    }),
  ).filter((section) => section.length > 0);
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
