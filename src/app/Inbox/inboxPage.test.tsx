import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import type { ChatView, MessageView, ThreadItem } from '@app/api/inbox';
import type { CurrentUser } from '@app/api/users';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { frame, streamMock } from '../../test/inbox';
import { phoneNumber } from '../../test/phoneNumbers';
import { renderApp } from '../../test/renderApp';
import { AGENT_IN_BRAND, BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const B = '/api/workspaces/w1';
const LIST = `GET ${B}/inbox/phone-numbers/p1/chats`;
const NUMBERS = `GET ${B}/inbox/phone-numbers`;
const STREAM = `GET ${B}/inbox/phone-numbers/p1/stream`;
const CHAT = `GET ${B}/inbox/chats/c1`;
const THREAD = `GET ${B}/inbox/chats/c1/thread`;
const READ = `POST ${B}/inbox/chats/c1/read`;
const ASSIGN = `POST ${B}/inbox/chats/c1/assign`;
const UNASSIGN = `POST ${B}/inbox/chats/c1/unassign`;
const CLOSE = `POST ${B}/inbox/chats/c1/close`;
const REOPEN = `POST ${B}/inbox/chats/c1/reopen`;
const ASSIGNEES = `GET ${B}/inbox/assignees`;

const NUMBER = phoneNumber({ id: 'p1', number: '919928088743', label: 'Sales', status: 'CONNECTED' });

const ASHA: ChatView = {
  id: 'c1',
  phoneNumberId: 'p1',
  remoteId: '919900000001@c.us',
  contact: { id: 'ct1', name: 'Asha Rao', phone: '919900000001', numberHidden: false },
  status: 'OPEN',
  assignedUser: null,
  assignedTeam: null,
  unreadCount: 2,
  lastMessageAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  lastMessage: { direction: 'IN', type: 'text', text: 'Hello from Asha', status: 'READ' },
  creationTime: '2026-10-20T10:00:00Z',
};
const MEENA: ChatView = {
  ...ASHA,
  id: 'c2',
  remoteId: '919900000002@c.us',
  contact: { id: 'ct2', name: 'Meena', phone: null, numberHidden: true },
  unreadCount: 0,
  lastMessageAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  lastMessage: { direction: 'IN', type: 'text', text: 'Hi there', status: 'READ' },
};

function message(over: Partial<MessageView> & { id: string }): MessageView {
  return {
    chatId: 'c1',
    waMessageId: `wa-${over.id}`,
    direction: 'IN',
    source: 'CONTACT',
    type: 'text',
    body: 'text',
    media: null,
    location: null,
    timestamp: new Date(Date.now() - 3600_000).toISOString(),
    status: 'READ',
    statusTimes: { sentAt: null, deliveredAt: null, readAt: null, playedAt: null, failedAt: null },
    sentBy: null,
    templateId: null,
    ...over,
  };
}
const item = (m: MessageView): ThreadItem => ({ kind: 'message', message: m, action: null, at: m.timestamp });
const FIRST = message({ id: 'm1', body: 'Hello from Asha' });

const Where: React.FunctionComponent = () => <output aria-label="Location">{useLocation().pathname}</output>;

/** An agent in Brand A who may see the inbox and nothing more. */
const VIEWER: CurrentUser = {
  ...AGENT_IN_BRAND,
  workspaces: [{ ...BRAND_A, authorities: ['inbox:view'] }],
};

function routes(extra: Record<string, unknown> = {}, user: CurrentUser = WORKSPACE_MANAGER) {
  const stream = streamMock();
  return {
    stream,
    routes: {
      ...meAs(user),
      [NUMBERS]: { status: 200, body: [NUMBER] },
      [LIST]: { status: 200, body: { items: [ASHA, MEENA], hasMore: false } },
      [CHAT]: { status: 200, body: ASHA },
      [THREAD]: { status: 200, body: { items: [item(FIRST)], hasMore: false } },
      [READ]: { status: 204 },
      [STREAM]: stream.response,
      ...extra,
    } as Parameters<typeof mockFetch>[0],
  };
}

const list = () => screen.findByRole('list', { name: 'Chats' });
const header = () => within(screen.getByRole('group', { name: 'Chat header' }));
const streamOpened = (fetch: ReturnType<typeof mockFetch>, n = 1) =>
  waitFor(() => expect(callsTo(fetch, STREAM)).toBe(n));

describe('inbox page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opening a chat loads thread and marks read', async () => {
    const { routes: r } = routes();
    const fetch = mockFetch(r);
    const { user } = renderApp('/inbox/p1', <Where />);
    expect(await screen.findByText('Pick a chat')).toBeVisible();
    const rows = within(await list());
    expect(within(rows.getByRole('button', { name: /Asha Rao/ })).getByText('2')).toBeVisible();

    await user.click(rows.getByRole('button', { name: /Asha Rao/ }));

    expect(await screen.findByText('Hello from Asha', { selector: 'div' })).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/inbox/p1/c1');
    await waitFor(() => expect(callsTo(fetch, READ)).toBe(1));
    expect(callsTo(fetch, CHAT)).toBe(1);
    // Picking a chat moves within the same page: the list and the stream stay as they are.
    expect(callsTo(fetch, LIST)).toBe(1);
    expect(callsTo(fetch, STREAM)).toBe(1);
    await waitFor(() => expect(within(rows.getByRole('button', { name: /Asha Rao/ })).queryByText('2')).toBeNull());
    expect(rows.getByRole('button', { name: /Asha Rao/ })).toHaveAttribute('aria-current', 'true');
    expect(header().getByText('Asha Rao')).toBeVisible();
    expect(header().getByText('+919900000001')).toBeVisible();
    expect(header().getByRole('link', { name: 'Open contact' })).toHaveAttribute('href', '/contacts/ct1');
    expect(requestTo(fetch, STREAM)?.headers.get('Authorization')).toBe('Bearer stored-token');
    expect(requestTo(fetch, STREAM)?.headers.get('Accept')).toBe('text/event-stream');
  });

  it('message event appends to the open thread and updates the list preview', async () => {
    const { routes: r, stream } = routes();
    const fetch = mockFetch(r);
    renderApp('/inbox/p1/c1');
    await screen.findByText('Hello from Asha', { selector: 'div' });
    await streamOpened(fetch);

    const reply = message({ id: 'm2', body: 'Are you there?', timestamp: new Date().toISOString() });
    act(() => {
      stream.push(frame('message', { chatId: 'c1', message: reply }));
      stream.push(
        frame('chat', {
          chat: {
            ...ASHA,
            unreadCount: 1,
            lastMessageAt: reply.timestamp,
            lastMessage: { direction: 'IN', type: 'text', text: 'Are you there?', status: 'READ' },
          },
          visible: true,
        }),
      );
    });

    expect(await within(screen.getByRole('log', { name: 'Messages' })).findByText('Are you there?')).toBeVisible();
    const row = within(await list()).getByRole('button', { name: /Asha Rao/ });
    await waitFor(() => expect(within(row).getByText('Are you there?')).toBeVisible());
    // The chat is open, so the new message is read at once and leaves no badge.
    await waitFor(() => expect(callsTo(fetch, READ)).toBe(2));
    await waitFor(() => expect(within(row).queryByText('1')).toBeNull());
  });

  it('chat event with visible:false closes the open chat with the reassigned notice', async () => {
    const { routes: r, stream } = routes();
    const fetch = mockFetch(r);
    renderApp('/inbox/p1/c1', <Where />);
    await screen.findByText('Hello from Asha', { selector: 'div' });
    await streamOpened(fetch);

    act(() =>
      stream.push(frame('chat', { chat: { ...ASHA, assignedUser: { id: 'u9', name: 'Other' } }, visible: false })),
    );

    expect(await screen.findByText('This chat was reassigned and is no longer in your inbox')).toBeVisible();
    expect(await screen.findByText('Pick a chat')).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/inbox\/p1$/);
    expect(within(await list()).queryByRole('button', { name: /Asha Rao/ })).toBeNull();
  });

  it('assign menu assigns and updates the header', async () => {
    const { routes: r } = routes({
      [ASSIGNEES]: {
        status: 200,
        body: { users: [{ id: 'u9', name: 'Demo Agent', username: 'demo' }], teams: [{ id: 't1', name: 'Support' }] },
      },
      [ASSIGN]: ({ body }: { body: { userId?: string } }) => ({
        status: 200,
        body: body.userId
          ? { ...ASHA, assignedUser: { id: 'u9', name: 'Demo Agent' } }
          : { ...ASHA, assignedTeam: { id: 't1', name: 'Support' } },
      }),
      [UNASSIGN]: { status: 200, body: ASHA },
    });
    const fetch = mockFetch(r);
    const { user } = renderApp('/inbox/p1/c1');
    await screen.findByText('Hello from Asha', { selector: 'div' });
    expect(header().getByText('Unassigned')).toBeVisible();

    await user.click(header().getByRole('button', { name: 'Assign' }));
    await user.click(await screen.findByRole('button', { name: 'Assign to agent…' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Demo Agent' }));
    expect(await header().findByText('Agent: Demo Agent')).toBeVisible();
    expect(requestTo(fetch, ASSIGN)?.body).toEqual({ userId: 'u9' });

    await user.click(header().getByRole('button', { name: 'Assign' }));
    await user.click(await screen.findByRole('button', { name: 'Assign to team…' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Support' }));
    expect(await header().findByText('Team: Support')).toBeVisible();
    expect(requestTo(fetch, ASSIGN, 1)?.body).toEqual({ teamId: 't1' });

    await user.click(header().getByRole('button', { name: 'Assign' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unassign' }));
    expect(await header().findByText('Unassigned')).toBeVisible();
    expect(callsTo(fetch, UNASSIGN)).toBe(1);
    expect(callsTo(fetch, ASSIGNEES)).toBe(1);
  });

  it('close button closes and the composer shows Reopen to reply', async () => {
    const { routes: r } = routes({
      [CLOSE]: { status: 200, body: { ...ASHA, status: 'CLOSED' } },
      [REOPEN]: { status: 200, body: ASHA },
    });
    mockFetch(r);
    const { user } = renderApp('/inbox/p1/c1');
    await screen.findByText('Hello from Asha', { selector: 'div' });
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled();

    await user.click(header().getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Reopen to reply')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();

    await user.click(header().getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(screen.queryByText('Reopen to reply')).toBeNull());
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled();
    expect(header().getByRole('button', { name: 'Close' })).toBeVisible();
  });

  it('shows assign and close controls only to those allowed', async () => {
    const { routes: r } = routes({}, VIEWER);
    mockFetch(r);
    renderApp('/inbox/p1/c1');
    await screen.findByText('Hello from Asha', { selector: 'div' });
    expect(header().getByText('Asha Rao')).toBeVisible();
    expect(header().queryByRole('button', { name: 'Assign' })).toBeNull();
    expect(header().queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('warns that the number is not connected from the number list', async () => {
    const { routes: r } = routes({ [NUMBERS]: { status: 200, body: [{ ...NUMBER, status: 'DISCONNECTED' }] } });
    mockFetch(r);
    renderApp('/inbox/p1/c1');
    expect(await screen.findByText('WhatsApp is not connected on this number')).toBeVisible();
  });

  it('stream reconnect reloads the list once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const streams: Array<ReturnType<typeof streamMock>> = [];
    const { routes: r } = routes({
      [STREAM]: () => {
        const s = streamMock();
        streams.push(s);
        return s.response;
      },
    });
    const fetch = mockFetch(r);
    renderApp('/inbox/p1');
    await list();
    await streamOpened(fetch);
    expect(callsTo(fetch, LIST)).toBe(1);
    expect(screen.queryByText('Reconnecting…')).toBeNull();

    act(() => streams[0].close());
    expect(await screen.findByText('Reconnecting…')).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(1100));

    await streamOpened(fetch, 2);
    await waitFor(() => expect(callsTo(fetch, LIST)).toBe(2));
    await waitFor(() => expect(screen.queryByText('Reconnecting…')).toBeNull());
    expect(callsTo(fetch, NUMBERS)).toBe(2);
    expect(within(await list()).getAllByRole('button', { name: /Asha Rao/ })).toHaveLength(1);
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('stops the stream when the page goes away', async () => {
    const { routes: r } = routes();
    const fetch = mockFetch(r);
    const { unmount } = renderApp('/inbox/p1');
    await list();
    await streamOpened(fetch);
    const signal = fetch.mock.calls.find(([url]) => String(url).endsWith('/stream'))?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('change number link goes back to the picker', async () => {
    const { routes: r } = routes();
    mockFetch(r);
    const { user } = renderApp('/inbox/p1');
    const top = await screen.findByRole('group', { name: 'Inbox number' });
    expect(within(top).getByText('+919928088743')).toBeVisible();
    expect(within(top).getByText('Sales')).toBeVisible();
    expect(await within(top).findByText('Connected')).toBeVisible();
    const link = within(top).getByRole('link', { name: 'Change number' });
    expect(link).toHaveAttribute('href', '/inbox');

    await user.click(link);

    expect(await screen.findByRole('grid', { name: 'Inbox numbers' })).toBeVisible();
  });
});
