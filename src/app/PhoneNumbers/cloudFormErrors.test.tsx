import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill } from '../../test/admin';

const BASE = '/api/workspaces/w1/phone-numbers';
const META = '/api/workspaces/w1/meta/connections';
const CONNECTION = {
  id: 'c1',
  name: 'Bimal app',
  appId: '111',
  appSecretHint: 'app…cdef',
  appSecretSetAt: null,
  tokenHint: 'EAA…1234',
  tokenSetAt: null,
  status: 'OK',
  checkedAt: null,
  lastError: null,
  webhook: { url: 'https://x/hooks/meta/k', verifyToken: 'v', setup: 'AUTO', error: null, lastWebhookAt: null },
  numbers: [],
  ignoredChanges: 0,
  lastIgnoredNumber: null,
};

describe('Cloud number forms say why they were refused', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('failedWabaLookupShowsWhyAndKeepsTheForm', async () => {
    let calls = 0;
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${BASE}`]: { status: 200, body: [] },
      [`GET ${META}`]: { status: 200, body: [CONNECTION] },
      [`POST ${META}/c1/check`]: () =>
        calls++ === 0
          ? {
              status: 200,
              body: { connection: CONNECTION, accounts: [{ wabaId: '222', wabaName: null, numbers: [] }] },
            }
          : {
              status: 400,
              body: { code: 'VALIDATION', fields: { wabaId: 'Meta does not let this token read WABA 777' } },
            },
    });
    const { user } = renderApp('/phone-numbers');
    await user.click(await screen.findByRole('button', { name: 'Add number' }));
    await user.click(screen.getByRole('button', { name: 'WhatsApp Cloud API' }));
    await fill(user, 'WhatsApp account \\(WABA\\) ID', '777');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText('Meta does not let this token read WABA 777')).toBeVisible();
    expect(screen.getByLabelText(/^WhatsApp account \(WABA\) ID/)).toHaveValue('777');
  });

  it('connectionFormShowsFieldReasons', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${BASE}`]: { status: 200, body: [] },
      [`GET ${META}`]: { status: 200, body: [] },
      [`POST ${META}`]: {
        status: 409,
        body: { code: 'DUPLICATE', field: 'appId', message: 'This Meta app is connected to another brand' },
      },
    });
    const { user } = renderApp('/phone-numbers');
    await user.click(await screen.findByRole('button', { name: /Meta connections/ }));
    await user.click(await screen.findByRole('button', { name: 'Add Meta connection' }));
    await fill(user, 'Name', 'Bimal app');
    await fill(user, 'App ID', '111');
    await fill(user, 'App secret', 's');
    await fill(user, 'Access token', 't');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This Meta app is connected to another brand')).toBeVisible();
  });
});
