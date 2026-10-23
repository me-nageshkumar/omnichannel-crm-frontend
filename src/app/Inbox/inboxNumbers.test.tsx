import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch } from '../../test/fetchMock';
import { streamMock } from '../../test/inbox';
import { rowWith } from '../../test/admin';
import { phoneNumber } from '../../test/phoneNumbers';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const B = '/api/workspaces/w1';
const WEB = phoneNumber({ id: 'p1', number: '919928088743', label: 'Sales', status: 'CONNECTED' });
const CLOUD = phoneNumber({ id: 'p2', number: '919811100000', label: 'Support', connectionType: 'WHATSAPP_CLOUD_API' });

function routes(extra = {}, user = WORKSPACE_MANAGER) {
  return {
    ...meAs(user),
    [`GET ${B}/inbox/phone-numbers`]: { status: 200, body: [WEB, CLOUD] },
    [`GET ${B}/users`]: { status: 200, body: [{ id: 'u9', name: 'Asha Agent', username: 'asha' }] },
    ...extra,
  };
}

describe('inbox number picker', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists numbers and links WhatsApp Web ones', async () => {
    mockFetch(routes());
    renderApp('/inbox');
    const row = await rowWith('Sales');
    expect(within(row).getByRole('link', { name: '+919928088743' })).toHaveAttribute('href', '/inbox/p1');
    expect(within(row).getByText('Connected')).toBeVisible();
  });

  it('cloud api numbers are disabled with the coming-later text', async () => {
    mockFetch(routes());
    renderApp('/inbox');
    const row = await rowWith('Support');
    expect(within(row).getByText('Cloud API inbox coming later')).toBeVisible();
    expect(within(row).queryByRole('link')).toBeNull();
    expect(within(row).getByText('+919811100000')).toBeVisible();
  });

  it('shows the empty state with a link to the phone numbers', async () => {
    mockFetch(routes({ [`GET ${B}/inbox/phone-numbers`]: { status: 200, body: [] } }));
    renderApp('/inbox');
    expect(await screen.findByText('No WhatsApp numbers yet')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to phone numbers' })).toHaveAttribute('href', '/phone-numbers');
  });

  it('the chat routes open the inbox page', async () => {
    const chat = { id: 'c1', phoneNumberId: 'p1', contact: { id: 'ct1', name: 'Asha Rao', phone: null } };
    mockFetch(
      routes({
        [`GET ${B}/inbox/phone-numbers/p1/chats`]: { status: 200, body: { items: [chat], hasMore: false } },
        [`GET ${B}/inbox/chats/c1`]: { status: 200, body: { ...chat, status: 'OPEN', unreadCount: 0 } },
        [`GET ${B}/inbox/chats/c1/thread`]: { status: 200, body: { items: [], hasMore: false } },
        [`POST ${B}/inbox/chats/c1/read`]: { status: 204 },
        [`GET ${B}/inbox/phone-numbers/p1/stream`]: streamMock().response,
      }),
    );
    renderApp('/inbox/p1/c1');
    expect(await screen.findByRole('group', { name: 'Chat header' })).toBeVisible();
  });
});
