import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { CurrentUser } from '@app/api/users';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { LEAD_QUALIFIER } from '../../test/chatbots';
import { EMPTY_LAYER } from '@app/Chatbots/settings/settingsLayers';

const PATH = '/api/workspaces/w1/chatbots/settings';
const PLATFORM = LEAD_QUALIFIER.inheritedSettings;

function brand(own = EMPTY_LAYER, version: number | null = 3) {
  return { status: 200, body: { own, inherited: PLATFORM, version } };
}

const VIEWER: CurrentUser = {
  ...WORKSPACE_MANAGER,
  workspaces: [{ ...BRAND_A, role: { id: 'r-cv', name: 'CHATBOT_VIEWER' }, authorities: ['chatbot:view'] }],
};

describe('brand chatbot settings page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('showsInheritedPlatformValues', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), [`GET ${PATH}`]: brand() });
    renderApp('/chatbots/settings');
    expect(await screen.findByRole('heading', { name: 'Chatbot settings' })).toBeVisible();
    expect(
      screen.getByText(
        'Your chatbots use these unless a chatbot sets its own. Empty fields follow the platform default.',
      ),
    ).toBeVisible();
    expect(await screen.findByRole('spinbutton', { name: 'End after minutes' })).toHaveAttribute(
      'placeholder',
      '120 — platform default',
    );
  });

  it('savesTheOwnLayer', async () => {
    const fetch = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${PATH}`]: brand(),
      [`PUT ${PATH}`]: brand({ ...EMPTY_LAYER, endAfterMinutes: 60 }, 4),
    });
    const { user } = renderApp('/chatbots/settings');
    await user.type(await screen.findByRole('spinbutton', { name: 'End after minutes' }), '60');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Settings saved')).toBeVisible();
    expect(requestTo(fetch, `PUT ${PATH}`)?.body).toEqual({ own: { ...EMPTY_LAYER, endAfterMinutes: 60 }, version: 3 });
  });

  it('readOnlyWithoutManage', async () => {
    mockFetch({ ...meAs(VIEWER), [`GET ${PATH}`]: brand() });
    renderApp('/chatbots/settings');
    expect(await screen.findByRole('spinbutton', { name: 'End after minutes' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('serverFieldErrorLandsOnTheField', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${PATH}`]: brand(),
      [`PUT ${PATH}`]: {
        status: 400,
        body: { code: 'VALIDATION', fields: { 'own.retryMessage': 'is required' } },
      },
    });
    const { user } = renderApp('/chatbots/settings');
    await user.type(await screen.findByRole('textbox', { name: 'Retry message' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('is required')).toBeVisible();
  });

  it('staleSaveOffersReload', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${PATH}`]: brand(),
      [`PUT ${PATH}`]: { status: 409, body: { code: 'CONFLICT' } },
    });
    const { user } = renderApp('/chatbots/settings');
    await user.type(await screen.findByRole('spinbutton', { name: 'End after minutes' }), '60');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Someone else changed these settings. Reload to see their version.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
  });

  it('settingsRouteIsNotAChatbotId', async () => {
    const fetch = mockFetch({ ...meAs(WORKSPACE_MANAGER), [`GET ${PATH}`]: brand() });
    renderApp('/chatbots/settings');
    expect(await screen.findByRole('spinbutton', { name: 'End after minutes' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Chatbot settings' })).toBeVisible();
    expect(requestTo(fetch, 'GET /api/workspaces/w1/chatbots/settings')).toBeDefined();
  });
});
