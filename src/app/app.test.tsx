import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../test/renderApp';

describe('App shell', () => {
  it('shows the app name in the masthead', () => {
    renderApp('/');
    expect(screen.getByText('Omnichannel CRM')).toBeVisible();
  });

  // jsdom has no viewport width, so the managed sidebar starts collapsed (hidden)
  it('nav lists Dashboard and Profile only', () => {
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Dashboard', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile', hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Support', hidden: true })).toBeNull();
  });

  it('unknown path shows not found', () => {
    renderApp('/nope');
    expect(screen.getByText('404 Page not found')).toBeVisible();
  });

  it('profile route renders', () => {
    renderApp('/profile');
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeVisible();
  });
});
