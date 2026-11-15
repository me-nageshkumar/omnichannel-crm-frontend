import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../test/session';
import { LEAD_QUALIFIER } from '../../test/chatbots';

const PATH = '/api/platform/chatbot-settings';
const PLATFORM = LEAD_QUALIFIER.inheritedSettings;

describe('platform chatbot defaults page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('savesEveryField', async () => {
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      [`GET ${PATH}`]: {
        status: 200,
        body: { settings: PLATFORM, version: null, lastUpdateTime: null, updatedBy: null },
      },
      [`PUT ${PATH}`]: {
        status: 200,
        body: { settings: { ...PLATFORM, endAfterMinutes: 90 }, version: 0, lastUpdateTime: null, updatedBy: 'u1' },
      },
    });
    const { user } = renderApp('/platform/chatbot-settings');
    expect(await screen.findByRole('heading', { name: 'Chatbot defaults' })).toBeVisible();
    expect(screen.getByText('Every brand uses these until it sets its own.')).toBeVisible();
    const end = await screen.findByRole('spinbutton', { name: 'End after minutes' });
    expect(end).toHaveValue(120);
    await user.clear(end);
    await user.type(end, '90');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Settings saved')).toBeVisible();
    expect(requestTo(fetch, `PUT ${PATH}`)?.body).toEqual({
      settings: { ...PLATFORM, endAfterMinutes: 90 },
      version: null,
    });
  });

  it('aClearedRequiredFieldBlocksSave', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      [`GET ${PATH}`]: { status: 200, body: { settings: PLATFORM, version: 2, lastUpdateTime: null, updatedBy: null } },
    });
    const { user } = renderApp('/platform/chatbot-settings');
    await user.clear(await screen.findByRole('textbox', { name: 'Retry message' }));
    expect(screen.getByText('is required')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('hiddenWithoutTheDefaultsRight', async () => {
    mockFetch(meAs(ACCOUNT_MANAGER));
    renderApp('/platform/chatbot-settings');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });
});
