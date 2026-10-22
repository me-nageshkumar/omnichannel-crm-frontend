import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
import { mockFetch } from '../test/fetchMock';
import { meRoute, storeSession } from '../test/session';

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    mockFetch({ ...meRoute() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the app name in the masthead', async () => {
    renderApp('/');
    expect(await screen.findByText('Omnichannel CRM')).toBeVisible();
  });

  // jsdom has no viewport width, so the managed sidebar starts collapsed (hidden)
  // Profile lives in the user menu, not the sidebar.
  it('nav lists Dashboard only', async () => {
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Dashboard', hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Profile', hidden: true })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Support', hidden: true })).toBeNull();
  });

  it('unknown path shows not found', async () => {
    renderApp('/nope');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });

  it('profile route renders', async () => {
    renderApp('/profile');
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeVisible();
  });
});
