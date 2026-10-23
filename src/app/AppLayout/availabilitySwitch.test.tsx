import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, AGENT_NO_BRANDS, SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { MESSAGES } from '@app/api/messages';

const PUT = 'PUT /api/users/me/availability';

describe('availability switch', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rendersCheckedWhenAvailable', async () => {
    mockFetch(meAs(AGENT_IN_BRAND));
    renderApp('/');
    const toggle = await screen.findByRole('switch', { name: 'Availability' });
    expect(toggle).toBeChecked();
    expect(screen.getByText('Available')).toBeVisible();
  });

  it('togglePutsAwayAndUpdatesLabel', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [PUT]: { status: 200, body: { ...AGENT_IN_BRAND, availability: { status: 'AWAY', at: '2026-10-23T10:00:00Z' } } },
    });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('switch', { name: 'Availability' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Availability' })).not.toBeChecked());
    expect(requestTo(fetch, PUT)?.body).toEqual({ status: 'AWAY' });
    expect(screen.getByText('Away')).toBeVisible();
  });

  it('availabilityRevertsOnError', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [PUT]: { status: 500, body: { code: 'INTERNAL', message: 'boom' } } });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('switch', { name: 'Availability' }));
    expect(await screen.findByText(MESSAGES.generic)).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Availability' })).toBeChecked();
    expect(screen.getByText('Available')).toBeVisible();
  });

  it('hiddenForPlatformStaffAndUsersWithoutAnInbox', async () => {
    mockFetch(meAs(SUPER_ADMIN));
    renderApp('/');
    await screen.findByText('Nagesh Kumar');
    expect(screen.queryByRole('switch', { name: 'Availability' })).toBeNull();
  });

  it('hiddenWithoutBrands', async () => {
    mockFetch(meAs(AGENT_NO_BRANDS));
    renderApp('/');
    await screen.findByText('Arun Agent');
    expect(screen.queryByRole('switch', { name: 'Availability' })).toBeNull();
  });
});
