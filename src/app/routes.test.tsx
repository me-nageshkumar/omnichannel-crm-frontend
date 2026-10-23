import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import type { CurrentUser } from '@app/api/users';
import { renderApp } from '../test/renderApp';
import { mockFetch } from '../test/fetchMock';
import {
  ACCOUNT_MANAGER,
  AGENT_IN_BRAND,
  AGENT_NO_BRANDS,
  BRAND_VIEWER,
  CUSTOMER_ADMIN,
  SUPER_ADMIN,
  WORKSPACE_MANAGER,
  meAs,
  storeSession,
} from '../test/session';

/** The sidebar's link names in order, without the dashboard every signed-in user sees. */
async function navFor(user: CurrentUser, path = '/'): Promise<string[]> {
  storeSession();
  mockFetch(meAs(user));
  renderApp(path);
  await screen.findByRole('link', { name: 'Dashboard', hidden: true });
  return within(sidebarNav())
    .getAllByRole('link', { hidden: true })
    .map((link) => link.textContent ?? '')
    .filter((name) => name !== 'Dashboard');
}

const sidebarNav = (): HTMLElement => document.getElementById('nav-primary') as HTMLElement;

const BRAND_LINKS = [
  'Inbox',
  'Routing',
  'All contacts',
  'Saved filters',
  'Contact fields',
  'All campaigns',
  'Senders',
  'Settings',
  'Templates',
  'Phone numbers',
  'Users',
  'Teams',
];

describe('authority-driven navigation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('agent without brands sees the dashboard only', async () => {
    expect(await navFor(AGENT_NO_BRANDS)).toEqual([]);
  });

  it('customer admin sees brands, users and teams', async () => {
    expect(await navFor(CUSTOMER_ADMIN)).toEqual([...BRAND_LINKS, 'Brands']);
  });

  it('workspace manager sees users and teams', async () => {
    expect(await navFor(WORKSPACE_MANAGER)).toEqual(BRAND_LINKS);
  });

  it('viewerAndAgentSeeCampaigns', async () => {
    expect(await navFor(BRAND_VIEWER)).toContain('All campaigns');
    cleanup();
    expect(await navFor(AGENT_IN_BRAND)).toContain('All campaigns');
  });

  it('account manager sees customers only', async () => {
    expect(await navFor(ACCOUNT_MANAGER)).toEqual(['Customers', 'All phone numbers']);
  });

  it('super admin sees platform users, roles and customers', async () => {
    expect(await navFor(SUPER_ADMIN)).toEqual(['Customers', 'All phone numbers', 'Platform users', 'Roles', 'Authorities']);
  });

  it('dividers split everyday work, brand work and administration', async () => {
    await navFor(CUSTOMER_ADMIN);
    expect(sidebarNav().querySelectorAll('.pf-v6-c-divider')).toHaveLength(2);
    cleanup();
    await navFor(WORKSPACE_MANAGER);
    expect(sidebarNav().querySelectorAll('.pf-v6-c-divider')).toHaveLength(1);
  });

  it('a nested page expands its group and marks its own link current', async () => {
    await navFor(WORKSPACE_MANAGER, '/contacts/filters/new');
    const nav = within(sidebarNav());
    expect(nav.getByRole('button', { name: 'Contacts', hidden: true })).toHaveAttribute('aria-expanded', 'true');
    expect(nav.getByRole('button', { name: 'Campaigns', hidden: true })).toHaveAttribute('aria-expanded', 'false');
    expect(nav.getByRole('link', { name: 'Saved filters', hidden: true })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'All contacts', hidden: true })).not.toHaveAttribute('aria-current');
  });

  it('a group with one allowed page shows as that page\'s link', async () => {
    const user = { ...AGENT_NO_BRANDS, authorities: ['platform-user:manage'] };
    expect(await navFor(user)).toEqual(['Platform users']);
    expect(within(sidebarNav()).queryByRole('button', { name: 'Access control', hidden: true })).toBeNull();
  });

  it('a direct URL without the authority is not found', async () => {
    storeSession();
    mockFetch(meAs(ACCOUNT_MANAGER));
    renderApp('/roles');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });

  it('the template editor routes need template:view and have no nav entry', async () => {
    storeSession();
    mockFetch(meAs(ACCOUNT_MANAGER));
    renderApp('/templates/new?type=TEXT');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });

  it('the template editor routes open for a user with template:view', async () => {
    storeSession();
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      'GET /api/workspaces/w1/templates/categories': { status: 200, body: [] },
      'GET /api/workspaces/w1/contact-attributes': { status: 200, body: [] },
    });
    renderApp('/templates/new?type=TEXT');
    expect(await screen.findByRole('button', { name: 'Save' })).toBeVisible();
  });
});
