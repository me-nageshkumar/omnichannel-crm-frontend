import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { PLATFORM_ADDRESS } from '../../test/pagesAddresses';

const PATH = '/api/platform/pages-address';
const SAVED = { ...PLATFORM_ADDRESS, baseUrl: 'https://links.example.in', source: 'SAVED', version: 2 };

describe('platform link address page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the address and where it comes from', async () => {
    mockFetch({ ...meAs(SUPER_ADMIN), [`GET ${PATH}`]: { status: 200, body: PLATFORM_ADDRESS } });
    renderApp('/platform/link-address');
    expect(await screen.findByRole('heading', { name: 'Link address' })).toBeVisible();
    expect(
      screen.getByText('Message and form links use this address unless the brand has a working address of its own.'),
    ).toBeVisible();
    expect(await screen.findByLabelText('Address')).toHaveValue('https://go.example.in');
    expect(
      screen.getByText('From the startup settings. Saving here replaces it until you choose Use the startup setting.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Use the startup setting' })).toBeNull();
  });

  it('a saved address names the startup one and offers to go back to it', async () => {
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      [`GET ${PATH}`]: { status: 200, body: SAVED },
      [`PUT ${PATH}`]: { status: 200, body: PLATFORM_ADDRESS },
    });
    const { user } = renderApp('/platform/link-address');
    expect(await screen.findByText('Saved here. The startup setting is https://go.example.in.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Use the startup setting' }));
    await waitFor(() => expect(callsTo(fetch, `PUT ${PATH}`)).toBe(1));
    expect(requestTo(fetch, `PUT ${PATH}`)?.body).toEqual({ baseUrl: null, version: 2 });
    expect(await screen.findByLabelText('Address')).toHaveValue('https://go.example.in');
  });

  it('Save sends the address and its version', async () => {
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      [`GET ${PATH}`]: { status: 200, body: PLATFORM_ADDRESS },
      [`PUT ${PATH}`]: { status: 200, body: SAVED },
    });
    const { user } = renderApp('/platform/link-address');
    const field = await screen.findByLabelText('Address');
    await user.clear(field);
    await user.type(field, 'https://links.example.in');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Address saved')).toBeVisible();
    expect(requestTo(fetch, `PUT ${PATH}`)?.body).toEqual({ baseUrl: 'https://links.example.in', version: null });
  });

  it('a failed check shows as a warning, not an error', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      [`GET ${PATH}`]: { status: 200, body: PLATFORM_ADDRESS },
      [`PUT ${PATH}`]: { status: 200, body: { ...SAVED, warning: 'The address did not answer' } },
    });
    const { user } = renderApp('/platform/link-address');
    const field = await screen.findByLabelText('Address');
    await user.clear(field);
    await user.type(field, 'https://links.example.in');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('The address was saved, but the check failed: The address did not answer'),
    ).toBeVisible();
  });

  it('a refused address shows the field message', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      [`GET ${PATH}`]: { status: 200, body: PLATFORM_ADDRESS },
      [`PUT ${PATH}`]: { status: 400, body: { code: 'VALIDATION', fields: { baseUrl: 'Use https://' } } },
    });
    const { user } = renderApp('/platform/link-address');
    const field = await screen.findByLabelText('Address');
    await user.clear(field);
    await user.type(field, 'http://links.example.in');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Use https://')).toBeVisible();
    expect(screen.queryByText('Address saved')).toBeNull();
  });

  it('the page and its menu entry need pages-address:manage', async () => {
    mockFetch(meAs(ACCOUNT_MANAGER));
    renderApp('/platform/link-address');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Link address', hidden: true })).toBeNull();
  });

  it('the super admin has the menu entry', async () => {
    mockFetch({ ...meAs(SUPER_ADMIN), [`GET ${PATH}`]: { status: 200, body: PLATFORM_ADDRESS } });
    renderApp('/platform/link-address');
    await screen.findByRole('heading', { name: 'Link address' });
    expect(screen.getByRole('link', { name: 'Link address', hidden: true })).toBeInTheDocument();
  });
});
