import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { ChatView } from '@app/api/inbox';
import { mockFetch } from '../../../test/fetchMock';
import { crmStatus } from '../../../test/crm';
import { streamMock } from '../../../test/inbox';
import { phoneNumber } from '../../../test/phoneNumbers';
import { renderApp } from '../../../test/renderApp';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';

const broken = vi.hoisted(() => ({ on: true }));
vi.mock('@app/Crm/inbox/CrmChatPanel', () => ({
  CrmChatPanel: () => {
    if (broken.on) throw new Error('panel blew up');
    return <p>Panel is fine</p>;
  },
}));

const B = '/api/workspaces/w1';
const ASHA: ChatView = {
  id: 'c1',
  phoneNumberId: 'p1',
  remoteId: '919900000001@c.us',
  contact: { id: 'ct1', name: 'Asha Rao', phone: '919900000001', numberHidden: false },
  status: 'OPEN',
  assignedUser: null,
  assignedTeam: null,
  unreadCount: 0,
  lastMessageAt: new Date(Date.now() - 3600_000).toISOString(),
  lastMessage: { direction: 'IN', type: 'text', text: 'Hello', status: 'READ' },
  creationTime: '2026-10-20T10:00:00Z',
  lastAgent: null,
};

describe('CRM panel failure', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    broken.on = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('aBrokenPanelLeavesTheChatUsableAndRetryRemounts', async () => {
    const stream = streamMock();
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      [`GET ${B}/inbox/phone-numbers`]: { status: 200, body: [phoneNumber({ id: 'p1', number: '919928088743', status: 'CONNECTED' })] },
      [`GET ${B}/inbox/chats`]: { status: 200, body: { items: [ASHA], hasMore: false } },
      [`GET ${B}/inbox/chats/c1`]: { status: 200, body: ASHA },
      [`GET ${B}/inbox/chats/c1/thread`]: { status: 200, body: { items: [], hasMore: false } },
      [`POST ${B}/inbox/chats/c1/read`]: { status: 204 },
      [`GET ${B}/inbox/stream`]: stream.response,
      [`GET ${B}/crm/status`]: { status: 200, body: crmStatus() },
    } as Parameters<typeof mockFetch>[0]);
    const { user } = renderApp('/inbox/chats/c1');
    const panel = within(await screen.findByRole('complementary', { name: 'CRM' }));
    expect(await panel.findByText('CRM unavailable')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Chat header' })).toBeVisible();
    expect(screen.getByRole('log', { name: 'Messages' })).toBeVisible();
    broken.on = false;
    await user.click(panel.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(panel.getByText('Panel is fine')).toBeVisible());
  });
});
