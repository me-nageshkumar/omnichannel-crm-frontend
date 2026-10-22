import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import type { CurrentUser } from '@app/api/users';
import { renderApp } from '../test/renderApp';
import { mockFetch } from '../test/fetchMock';
import {
  ACCOUNT_MANAGER,
  AGENT_IN_BRAND,
  AGENT_NO_BRANDS,
  CUSTOMER_ADMIN,
  SUPER_ADMIN,
  TEAM_LEAD,
  WORKSPACE_MANAGER,
  meAs,
  storeSession,
} from '../test/session';

const ALL = [
  'Platform users',
  'Roles',
  'Authorities',
  'Customers',
  'Brands',
  'Inbox',
  'Users',
  'Teams',
  'Phone numbers',
  'Contacts',
  'Contact fields',
  'Templates',
  'Campaigns',
  'All phone numbers',
];

async function navFor(user: CurrentUser): Promise<string[]> {
  storeSession();
  mockFetch(meAs(user));
  renderApp('/');
  await screen.findByRole('link', { name: 'Dashboard', hidden: true });
  return ALL.filter((name) => screen.queryByRole('link', { name, hidden: true }) !== null);
}

describe('authority-driven navigation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('agent without brands sees the dashboard only', async () => {
    expect(await navFor(AGENT_NO_BRANDS)).toEqual([]);
  });

  it('customer admin sees brands, users and teams', async () => {
    expect(await navFor(CUSTOMER_ADMIN)).toEqual([
      'Brands',
      'Inbox',
      'Users',
      'Teams',
      'Phone numbers',
      'Contacts',
      'Contact fields',
      'Templates',
      'Campaigns',
    ]);
  });

  it('workspace manager sees users and teams', async () => {
    expect(await navFor(WORKSPACE_MANAGER)).toEqual([
      'Inbox',
      'Users',
      'Teams',
      'Phone numbers',
      'Contacts',
      'Contact fields',
      'Templates',
      'Campaigns',
    ]);
  });

  it('teamLeadAndAgentSeeCampaigns', async () => {
    expect(await navFor(TEAM_LEAD)).toContain('Campaigns');
    cleanup();
    expect(await navFor(AGENT_IN_BRAND)).toContain('Campaigns');
  });

  it('account manager sees customers only', async () => {
    expect(await navFor(ACCOUNT_MANAGER)).toEqual(['Customers', 'All phone numbers']);
  });

  it('super admin sees platform users, roles and customers', async () => {
    expect(await navFor(SUPER_ADMIN)).toEqual([
      'Platform users',
      'Roles',
      'Authorities',
      'Customers',
      'All phone numbers',
    ]);
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
