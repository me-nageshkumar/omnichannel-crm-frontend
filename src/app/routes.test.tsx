import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { CurrentUser } from '@app/api/users';
import { renderApp } from '../test/renderApp';
import { mockFetch } from '../test/fetchMock';
import {
  ACCOUNT_MANAGER,
  AGENT_NO_BRANDS,
  CUSTOMER_ADMIN,
  SUPER_ADMIN,
  WORKSPACE_MANAGER,
  meAs,
  storeSession,
} from '../test/session';

const ALL = ['Platform users', 'Roles', 'Customers', 'Brands', 'Users', 'Teams'];

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
    expect(await navFor(CUSTOMER_ADMIN)).toEqual(['Brands', 'Users', 'Teams']);
  });

  it('workspace manager sees users and teams', async () => {
    expect(await navFor(WORKSPACE_MANAGER)).toEqual(['Users', 'Teams']);
  });

  it('account manager sees customers only', async () => {
    expect(await navFor(ACCOUNT_MANAGER)).toEqual(['Customers']);
  });

  it('super admin sees platform users, roles and customers', async () => {
    expect(await navFor(SUPER_ADMIN)).toEqual(['Platform users', 'Roles', 'Customers']);
  });

  it('a direct URL without the authority is not found', async () => {
    storeSession();
    mockFetch(meAs(ACCOUNT_MANAGER));
    renderApp('/roles');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });
});
