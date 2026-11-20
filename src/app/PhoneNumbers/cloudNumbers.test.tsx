import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_VIEWER, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill, rowAction, rowWith } from '../../test/admin';
import { phoneNumber } from '../../test/phoneNumbers';
import type { CloudInfo } from '@app/api/phoneNumbers';
import type { MetaConnection } from '@app/api/metaConnections';

const BASE = '/api/workspaces/w1/phone-numbers';
const META = '/api/workspaces/w1/meta/connections';

const CLOUD: CloudInfo = {
  connectionId: 'c1',
  connectionName: 'Bimal app',
  wabaId: '222',
  metaPhoneNumberId: '333',
  verifiedName: 'Bimal Institute',
  nameStatus: 'APPROVED',
  qualityRating: 'GREEN',
  messagingLimitTier: 'TIER_250',
  registered: true,
  state: 'READY',
  lastError: null,
};

const cloudNumber = (state: CloudInfo['state'], registered = true) =>
  phoneNumber({
    id: 'p2',
    number: '919876543210',
    label: 'Admissions',
    connectionType: 'WHATSAPP_CLOUD_API',
    status: 'NOT_CONNECTED_YET',
    cloud: { ...CLOUD, state, registered },
  });

const CONNECTION: MetaConnection = {
  id: 'c1',
  name: 'Bimal app',
  appId: '111',
  appSecretHint: 'app…cdef',
  appSecretSetAt: '2026-11-20T10:00:00Z',
  tokenHint: 'EAA…1234',
  tokenSetAt: '2026-11-20T10:00:00Z',
  status: 'OK',
  checkedAt: '2026-11-20T10:00:00Z',
  lastError: null,
  webhook: {
    url: 'https://pages.example/hooks/meta/key123',
    verifyToken: 'verify-abc',
    setup: 'MANUAL',
    error: 'Callback verification failed',
    lastWebhookAt: null,
  },
  numbers: [],
  ignoredChanges: 0,
  lastIgnoredNumber: null,
};

function routes(list = [cloudNumber('READY')], extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${BASE}`]: { status: 200, body: list },
    [`GET ${META}`]: { status: 200, body: [CONNECTION] },
    ...extra,
  };
}

describe('cloud numbers on the phone numbers page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('connectionModalSendsSecretsOnce', async () => {
    const fetch = mockFetch(
      routes([], {
        [`POST ${META}`]: { status: 201, body: CONNECTION },
        [`PUT ${META}/c1`]: { status: 200, body: CONNECTION },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await user.click(await screen.findByRole('button', { name: /Meta connections/ }));
    await user.click(await screen.findByRole('button', { name: 'Add Meta connection' }));
    await fill(user, 'Name', 'Bimal app');
    await fill(user, 'App ID', '111');
    await fill(user, 'App secret', 'the-secret');
    await fill(user, 'Access token', 'EAAtoken');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, `POST ${META}`)).toBeDefined());
    expect(requestTo(fetch, `POST ${META}`)?.body).toEqual({
      name: 'Bimal app',
      appId: '111',
      appSecret: 'the-secret',
      accessToken: 'EAAtoken',
    });

    const section = await screen.findByRole('region', { name: 'Meta connection Bimal app' });
    await user.click(within(section).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('EAA…1234')).toBeVisible();
    expect(within(dialog).getAllByRole('button', { name: 'Replace' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(fetch, `PUT ${META}/c1`)).toBeDefined());
    const body = requestTo(fetch, `PUT ${META}/c1`)?.body;
    expect('accessToken' in body).toBe(false);
    expect('appSecret' in body).toBe(false);
  });

  it('webhookDetailsAreCopyable', async () => {
    const fetch = mockFetch(
      routes(undefined, {
        [`POST ${META}/c1/webhook`]: {
          status: 200,
          body: { ...CONNECTION, webhook: { ...CONNECTION.webhook, setup: 'AUTO', error: null } },
        },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    const section = await screen.findByRole('region', { name: 'Meta connection Bimal app' });
    expect(within(section).getByDisplayValue('https://pages.example/hooks/meta/key123')).toBeVisible();
    expect(within(section).getByDisplayValue('verify-abc')).toBeVisible();
    expect(within(section).getByText('Callback verification failed')).toBeVisible();
    await user.click(within(section).getByRole('button', { name: 'Retry webhook setup' }));
    await waitFor(() => expect(requestTo(fetch, `POST ${META}/c1/webhook`)).toBeDefined());
    expect(await within(section).findByText('Set up automatically')).toBeVisible();
  });

  it('addCloudNumberPicksFromCheck', async () => {
    const fetch = mockFetch(
      routes([], {
        [`POST ${META}/c1/check`]: {
          status: 200,
          body: {
            connection: CONNECTION,
            accounts: [
              {
                wabaId: '222',
                wabaName: 'Bimal WABA',
                numbers: [
                  {
                    metaPhoneNumberId: '333',
                    displayPhoneNumber: '+91 98765 43210',
                    verifiedName: 'Bimal Institute',
                    nameStatus: 'APPROVED',
                    qualityRating: 'GREEN',
                    platformType: 'CLOUD_API',
                    phoneNumberId: null,
                  },
                  {
                    metaPhoneNumberId: '444',
                    displayPhoneNumber: '+91 90000 00000',
                    verifiedName: 'Bimal Fees',
                    nameStatus: 'APPROVED',
                    qualityRating: 'GREEN',
                    platformType: 'CLOUD_API',
                    phoneNumberId: 'p7',
                  },
                ],
              },
            ],
          },
        },
        [`POST ${BASE}`]: { status: 201, body: cloudNumber('WAITING_FOR_WEBHOOK') },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await user.click(await screen.findByRole('button', { name: 'Add number' }));
    await user.click(screen.getByRole('button', { name: 'WhatsApp Cloud API' }));
    const first = await screen.findByLabelText(/\+91 98765 43210/);
    expect(screen.getByLabelText(/\+91 90000 00000/)).toBeDisabled();
    expect(screen.getByText('Already added')).toBeVisible();
    await user.click(first);
    await fill(user, 'Label', 'Admissions');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(requestTo(fetch, `POST ${BASE}`)).toBeDefined());
    expect(requestTo(fetch, `POST ${BASE}`)?.body).toEqual({
      label: 'Admissions',
      connectionType: 'WHATSAPP_CLOUD_API',
      cloud: { connectionId: 'c1', wabaId: '222', metaPhoneNumberId: '333' },
    });
    expect(await rowWith('+919876543210')).toBeVisible();
  });

  it('invalidConnectionShowsErrorNoNumbers', async () => {
    mockFetch(
      routes([], {
        [`POST ${META}/c1/check`]: {
          status: 200,
          body: { connection: { ...CONNECTION, status: 'INVALID', lastError: 'Token expired' }, accounts: [] },
        },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    await user.click(await screen.findByRole('button', { name: 'Add number' }));
    await user.click(screen.getByRole('button', { name: 'WhatsApp Cloud API' }));
    expect(await screen.findByText('Token expired')).toBeVisible();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('statusLabels', async () => {
    const list = [
      { ...cloudNumber('READY'), id: 'a', number: '910000000001' },
      { ...cloudNumber('WAITING_FOR_WEBHOOK'), id: 'b', number: '910000000002' },
      { ...cloudNumber('NOT_REGISTERED', false), id: 'c', number: '910000000003' },
      { ...cloudNumber('TOKEN_INVALID'), id: 'd', number: '910000000004' },
    ];
    const fetch = mockFetch(
      routes(list, { [`POST ${BASE}/c/cloud/register`]: { status: 200, body: { ...list[2], cloud: { ...CLOUD } } } }),
    );
    const { user } = renderApp('/phone-numbers');
    expect(within(await rowWith('+910000000001')).getByText('Ready')).toBeVisible();
    expect(within(await rowWith('+910000000002')).getByText('Waiting for first webhook')).toBeVisible();
    expect(within(await rowWith('+910000000003')).getByText('Not registered')).toBeVisible();
    expect(within(await rowWith('+910000000004')).getByText('Token invalid')).toBeVisible();

    await rowAction(user, '+910000000003', 'Register');
    const pin = await screen.findByLabelText(/^Two-step PIN/);
    await user.type(pin, '12ab345678');
    expect(pin).toHaveValue('123456');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(requestTo(fetch, `POST ${BASE}/c/cloud/register`)?.body).toEqual({ pin: '123456' }));
  });

  it('cloudRowsHideDeviceActions', async () => {
    mockFetch(routes());
    const { user } = renderApp('/phone-numbers');
    const row = await rowWith('+919876543210');
    expect(within(row).getByText(/Bimal Institute · quality GREEN · TIER_250/)).toBeVisible();
    await user.click(within(row).getByRole('button', { name: 'Kebab toggle' }));
    const items = (await screen.findAllByRole('menuitem')).map((m) => m.textContent);
    expect(items).toEqual(['Edit label', 'Set team', 'Disable', 'Delete']);
  });

  it('deleteConnectionInUseShowsNames', async () => {
    mockFetch(
      routes(undefined, {
        [`DELETE ${META}/c1`]: {
          status: 409,
          body: { code: 'meta_connection_in_use', field: 'numbers', message: 'Used by: Admissions' },
        },
      }),
    );
    const { user } = renderApp('/phone-numbers');
    const section = await screen.findByRole('region', { name: 'Meta connection Bimal app' });
    await user.click(within(section).getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect((await screen.findAllByText(/Used by: Admissions/)).length).toBeGreaterThan(0);
  });

  it('viewerSeesNoActions', async () => {
    mockFetch({ ...routes(), ...meAs(BRAND_VIEWER) });
    renderApp('/phone-numbers');
    const section = await screen.findByRole('region', { name: 'Meta connection Bimal app' });
    expect(within(section).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(section).queryByRole('button', { name: 'Retry webhook setup' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Meta connection' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add number' })).toBeNull();
  });
});
