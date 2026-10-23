import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActionView, ChatView, InboxEvent, MessageView, ThreadItem } from '@app/api/inbox';
import { Thread, actionText } from '@app/Inbox/Thread';
import { dayLabel } from '@app/Inbox/chatDisplay';
import { useThread } from '@app/Inbox/useThread';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { callsTo, mockFetch } from '../../test/fetchMock';
import { AGENT_IN_BRAND, meAs, storeSession } from '../../test/session';

const THREAD = '/api/workspaces/w1/inbox/chats/c1/thread';
const MEDIA = (id: string) => `/api/workspaces/w1/inbox/chats/c1/messages/${id}/media`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
/** Noon of the local day {@code n} days before today, so day boundaries never depend on the clock time. */
const noon = (n: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, 12).toISOString();
};

const CHAT: ChatView = {
  id: 'c1',
  phoneNumberId: 'p1',
  remoteId: '919900000001@c.us',
  contact: { id: 'ct1', name: 'Asha Rao', phone: '919900000001', numberHidden: false },
  status: 'OPEN',
  assignedUser: null,
  assignedTeam: null,
  unreadCount: 0,
  lastMessageAt: hoursAgo(1),
  lastMessage: null,
  creationTime: hoursAgo(48),
  lastAgent: null,
};

function message(over: Partial<MessageView> & { id: string }): ThreadItem {
  const m: MessageView = {
    chatId: 'c1',
    waMessageId: `wa-${over.id}`,
    direction: 'IN',
    source: 'CONTACT',
    type: 'text',
    body: null,
    media: null,
    location: null,
    timestamp: hoursAgo(2),
    status: 'READ',
    statusTimes: { sentAt: null, deliveredAt: null, readAt: null, playedAt: null, failedAt: null },
    sentBy: null,
    templateId: null,
    ...over,
  };
  return { kind: 'message', message: m, action: null, at: m.timestamp };
}

function action(over: Partial<ActionView> & { id: string }): ThreadItem {
  const a: ActionView = {
    type: 'CLOSED',
    by: null,
    toUser: null,
    toTeam: null,
    at: hoursAgo(2),
    reason: null,
    fromTeam: null,
    ...over,
  };
  return { kind: 'action', message: null, action: a, at: a.at };
}

const page = (items: ThreadItem[], hasMore = false) => ({ status: 200, body: { items, hasMore } });
const named = (name: string) => ({ id: `id-${name}`, name });

let apply: (event: InboxEvent) => void = () => undefined;

const Host: React.FunctionComponent<{ chatId: string | null }> = ({ chatId }) => {
  const { status } = useSession();
  return status === 'signedIn' ? <Open chatId={chatId} /> : null;
};

const Open: React.FunctionComponent<{ chatId: string | null }> = ({ chatId }) => {
  const thread = useThread(chatId);
  apply = thread.apply;
  return (
    <div style={{ height: 600 }}>
      <Thread chat={CHAT} thread={thread} meId="u-me" />
    </div>
  );
};

const tree = (chatId: string | null) => (
  <ThemeProvider>
    <SessionProvider>
      <Host chatId={chatId} />
    </SessionProvider>
  </ThemeProvider>
);

function renderThread(chatId: string | null = 'c1') {
  const user = userEvent.setup();
  const view = render(tree(chatId));
  return { user, ...view };
}

/** Holds back the thread reply of chat c1 until {@code release()}; everything else answers at once. */
function gateThreadOfC1(fetch: ReturnType<typeof mockFetch>) {
  const answer = fetch.getMockImplementation() as NonNullable<ReturnType<typeof fetch.getMockImplementation>>;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  fetch.mockImplementation(async (input, init) => {
    if (new URL(String(input), 'http://localhost').pathname === THREAD) await gate;
    return answer(input, init);
  });
  return release;
}

const messageEvent = (item: ThreadItem, chatId = 'c1'): InboxEvent => ({
  type: 'message',
  chatId,
  message: item.message as MessageView,
});

const mediaCalls = (fetch: ReturnType<typeof mockFetch>, id: string) => callsTo(fetch, `GET ${MEDIA(id)}`);

describe('thread', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    // jsdom has no object URLs.
    URL.createObjectURL = vi.fn(() => 'blob:media');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (URL as Partial<typeof URL>).createObjectURL;
    delete (URL as Partial<typeof URL>).revokeObjectURL;
  });

  it('renders incoming and outgoing with ticks and sender label', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({ id: 'm1', body: 'Hi there' }),
        message({
          id: 'm2',
          direction: 'OUT',
          source: 'CONSOLE',
          body: 'Hello *Asha*',
          status: 'DELIVERED',
          sentBy: named('Demo Agent'),
        }),
        message({ id: 'm3', direction: 'OUT', source: 'WHATSAPP_WEB', body: 'From phone', status: 'READ' }),
        message({
          id: 'm4',
          direction: 'OUT',
          source: 'CONSOLE',
          body: 'Oops',
          status: 'FAILED',
          sentBy: named('Demo Agent'),
        }),
      ]),
    });
    renderThread();

    const incoming = (await screen.findByText('Hi there')).closest('[data-side]') as HTMLElement;
    expect(incoming).toHaveAttribute('data-side', 'left');
    expect(within(incoming).queryByRole('img')).toBeNull();
    expect(within(incoming).queryByText('WhatsApp Web')).toBeNull();

    const console = screen.getByText('Asha').closest('[data-side]') as HTMLElement;
    expect(console).toHaveAttribute('data-side', 'right');
    expect(screen.getByText('Asha').tagName).toBe('STRONG');
    expect(within(console).getByText('Demo Agent')).toBeInTheDocument();
    expect(within(console).getByRole('img', { name: 'Delivered' })).toHaveTextContent('✓✓');

    const phone = screen.getByText('From phone').closest('[data-side]') as HTMLElement;
    expect(within(phone).getByText('WhatsApp Web')).toBeInTheDocument();
    const read = within(phone).getByRole('img', { name: 'Read' });
    expect(read).toHaveStyle({ color: 'var(--pf-t--global--icon--color--status--info--default)' });
    expect(within(console).getByRole('img', { name: 'Delivered' })).not.toHaveStyle({
      color: 'var(--pf-t--global--icon--color--status--info--default)',
    });

    const failed = screen.getByText('Oops').closest('[data-side]') as HTMLElement;
    expect(within(failed).getByRole('img', { name: 'Failed' })).toBeInTheDocument();
  });

  it('shows deleted, location, poll and unsupported messages', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({ id: 'm1', type: 'revoked' }),
        message({
          id: 'm2',
          type: 'location',
          location: { latitude: 12.5, longitude: 77.25, description: 'Our shop' },
        }),
        message({ id: 'm3', type: 'poll_creation', body: 'Lunch where?' }),
        message({ id: 'm4', type: 'vcard' }),
      ]),
    });
    renderThread();

    const deleted = await screen.findByText('This message was deleted');
    expect(deleted.tagName).toBe('EM');
    expect(screen.getByRole('link', { name: 'Our shop' })).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=12.5,77.25',
    );
    expect(screen.getByText('Poll')).toBeInTheDocument();
    expect(screen.getByText('Lunch where?')).toBeInTheDocument();
    expect(screen.getByText('Unsupported message')).toBeInTheDocument();
  });

  it('threadRendersTransferredAndRoutedReasons', () => {
    const to = { id: 'u9', name: 'Demo Agent' };
    const by = { id: 'u7', name: 'Ishaan' };
    const action = (over: Partial<ActionView>): ActionView => ({
      id: 'a',
      type: 'CLOSED',
      by: null,
      toUser: null,
      toTeam: null,
      at: hoursAgo(1),
      reason: null,
      fromTeam: null,
      ...over,
    });
    expect(actionText(action({ type: 'ROUTED', toUser: to, reason: 'STICKY' }))).toBe(
      'Routed to Demo Agent (returning customer)',
    );
    expect(actionText(action({ type: 'ROUTED', toUser: to, reason: 'HANDED_BACK', by }))).toBe(
      'Routed to Demo Agent (handed back by Ishaan)',
    );
    expect(actionText(action({ type: 'ROUTED', toTeam: { id: 't1', name: 'Sales' }, reason: 'OWNER_CHANGED' }))).toBe(
      'Routed to Sales (the number changed team)',
    );
    expect(actionText(action({ type: 'ROUTED', toUser: to, reason: 'MEMBER_REMOVED' }))).toBe(
      'Routed to Demo Agent (the previous agent left the team)',
    );
    expect(
      actionText(action({ type: 'TRANSFERRED', fromTeam: { id: 't1', name: 'Sales' }, toTeam: { id: 't2', name: 'Support' }, by })),
    ).toBe('Transferred from Sales to Support by Ishaan');
    expect(actionText(action({ type: 'TRANSFERRED', toTeam: { id: 't2', name: 'Support' } }))).toBe(
      'Transferred to Support',
    );
  });

  it('action items render as system lines', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        action({ id: 'a1', type: 'ROUTED', toTeam: named('Demo Support'), at: hoursAgo(6) }),
        action({ id: 'a2', type: 'ASSIGNED', toUser: named('Demo Agent'), by: named('Demo Lead'), at: hoursAgo(5) }),
        action({ id: 'a3', type: 'UNASSIGNED', by: named('Demo Lead'), at: hoursAgo(4) }),
        action({ id: 'a4', type: 'CLOSED', by: named('Demo Agent'), at: hoursAgo(3) }),
        action({ id: 'a5', type: 'REOPENED', by: named('Demo Agent'), at: hoursAgo(2) }),
      ]),
    });
    renderThread();

    for (const line of [
      'Routed to Demo Support',
      'Assigned to Demo Agent by Demo Lead',
      'Unassigned by Demo Lead',
      'Closed by Demo Agent',
      'Reopened',
    ]) {
      expect(await screen.findByText(line)).toBeInTheDocument();
    }
  });

  it('shows the campaign as the sender', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({
          id: 'm1',
          direction: 'OUT',
          source: 'CAMPAIGN',
          body: 'Diwali offer',
          sentBy: named('Campaign: Diwali leads'),
        }),
      ]),
    });
    renderThread();
    const bubble = (await screen.findByText('Diwali offer')).closest('[data-side]') as HTMLElement;
    expect(within(bubble).getByText('Campaign: Diwali leads')).toBeInTheDocument();
    expect(within(bubble).queryByText('WhatsApp Web')).toBeNull();
  });

  it('reopenedByACampaignShowsTheCampaign', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        action({ id: 'a1', type: 'REOPENED', by: { id: null, name: 'Campaign: Diwali leads' }, at: hoursAgo(1) }),
        action({ id: 'a2', type: 'REOPENED', by: named('Demo Agent'), at: hoursAgo(0.5) }),
      ]),
    });
    renderThread();
    expect(await screen.findByText('Reopened by Campaign: Diwali leads')).toBeInTheDocument();
    expect(screen.getByText('Reopened')).toBeInTheDocument();
  });

  it('media not available shows Download and fetches on click', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({
          id: 'm1',
          type: 'image',
          body: 'A caption',
          media: { mimetype: 'image/png', filename: null, size: 2048, available: false },
        }),
      ]),
      [`GET ${MEDIA('m1')}`]: { status: 200, text: 'PNG', headers: { 'Content-Type': 'image/png' } },
    });
    const { user } = renderThread();

    const button = await screen.findByRole('button', { name: 'Download' });
    expect(screen.getByText('A caption')).toBeInTheDocument();
    expect(mediaCalls(fetch, 'm1')).toBe(0);
    expect(screen.queryByRole('img')).toBeNull();

    await user.click(button);
    const img = await screen.findByRole('img');
    expect(img).toHaveAttribute('src', 'blob:media');
    expect(mediaCalls(fetch, 'm1')).toBe(1);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('available image fetches on mount and revokes the object URL on unmount', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({
          id: 'm1',
          type: 'image',
          media: { mimetype: 'image/png', filename: null, size: 10, available: true },
        }),
      ]),
      [`GET ${MEDIA('m1')}`]: { status: 200, text: 'PNG', headers: { 'Content-Type': 'image/png' } },
    });
    const { unmount } = renderThread();

    expect(await screen.findByRole('img')).toHaveAttribute('src', 'blob:media');
    expect(mediaCalls(fetch, 'm1')).toBe(1);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    expect(fetch.mock.calls.find(([, init]) => new Headers(init?.headers).get('Authorization'))).toBeDefined();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:media');
  });

  it('shows a document chip and saves it only on Download', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({
          id: 'm1',
          type: 'document',
          media: { mimetype: 'application/pdf', filename: 'invoice.pdf', size: 3 * 1024 * 1024, available: true },
        }),
      ]),
      [`GET ${MEDIA('m1')}`]: { status: 200, text: '%PDF', headers: { 'Content-Type': 'application/pdf' } },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user } = renderThread();

    expect(await screen.findByText('invoice.pdf')).toBeInTheDocument();
    expect(screen.getByText('3.0 MB')).toBeInTheDocument();
    expect(mediaCalls(fetch, 'm1')).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(mediaCalls(fetch, 'm1')).toBe(1);
    click.mockRestore();
  });

  it('reports a failed download through the error message', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({
          id: 'm1',
          type: 'audio',
          media: { mimetype: 'audio/ogg', filename: null, size: 10, available: false },
        }),
      ]),
      [`GET ${MEDIA('m1')}`]: { status: 404, body: { code: 'NOT_FOUND' } },
    });
    const { user } = renderThread();

    await user.click(await screen.findByRole('button', { name: 'Download' }));
    expect(await screen.findByText(/no longer exists/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('message event updates status in place', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({ id: 'm1', body: 'First', timestamp: hoursAgo(3) }),
        message({
          id: 'm2',
          direction: 'OUT',
          source: 'CONSOLE',
          body: 'Second',
          status: 'SENT',
          sentBy: named('Demo Agent'),
          timestamp: hoursAgo(2),
        }),
        message({ id: 'm3', body: 'Third', timestamp: hoursAgo(1) }),
      ]),
    });
    renderThread();
    await screen.findByText('Second');
    expect(screen.getByRole('img', { name: 'Sent' })).toBeInTheDocument();

    act(() =>
      apply(
        messageEvent(
          message({
            id: 'm2',
            direction: 'OUT',
            source: 'CONSOLE',
            body: 'Second',
            status: 'READ',
            sentBy: named('Demo Agent'),
            timestamp: hoursAgo(2),
          }),
        ),
      ),
    );
    expect(screen.getByRole('img', { name: 'Read' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Sent' })).toBeNull();
    expect(screen.getAllByText(/First|Second|Third/).map((e) => e.textContent)).toEqual(['First', 'Second', 'Third']);

    // A new message appends in time order; other chats and unrelated events are ignored.
    act(() => apply(messageEvent(message({ id: 'm4', body: 'Fourth', timestamp: hoursAgo(0.5) }))));
    act(() => apply(messageEvent(message({ id: 'm5', body: 'Elsewhere' }), 'other')));
    act(() =>
      apply({
        type: 'action',
        chatId: 'c1',
        action: action({ id: 'a1', type: 'REOPENED', at: hoursAgo(0.1) }).action as ActionView,
      }),
    );
    expect(screen.getByText('Fourth')).toBeInTheDocument();
    expect(screen.queryByText('Elsewhere')).toBeNull();
    expect(screen.getByText('Reopened')).toBeInTheDocument();
  });

  it('load earlier prepends', async () => {
    let calls = 0;
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: () =>
        ++calls === 1
          ? page([message({ id: 'm2', body: 'Newer', timestamp: '2026-10-20T10:00:00Z' })], true)
          : page([message({ id: 'm1', body: 'Older', timestamp: '2026-10-19T10:00:00Z' })]),
    });
    const { user } = renderThread();

    await screen.findByText('Newer');
    await user.click(screen.getByRole('button', { name: 'Load earlier' }));
    await screen.findByText('Older');
    expect(screen.queryByRole('button', { name: 'Load earlier' })).toBeNull();
    expect(screen.getAllByText(/Older|Newer/).map((e) => e.textContent)).toEqual(['Older', 'Newer']);
    expect(calls).toBe(2);
  });

  it('asks for the page before the oldest item shown', async () => {
    let calls = 0;
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: () =>
        ++calls === 1
          ? page([message({ id: 'm2', body: 'Newer', timestamp: '2026-10-20T10:00:00Z' })], true)
          : page([message({ id: 'm1', body: 'Older', timestamp: '2026-10-19T10:00:00Z' })]),
    });
    const { user } = renderThread();

    await user.click(await screen.findByRole('button', { name: 'Load earlier' }));
    await screen.findByText('Older');
    const requests = fetch.mock.calls.map(([input]) => String(input)).filter((u) => u.includes('/thread'));
    expect(requests[0]).not.toContain('before=');
    expect(requests[1]).toContain('before=2026-10-20T10%3A00%3A00Z');
  });

  it('drops the reply of a chat that was left while it loaded', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([message({ id: 'm1', body: 'Old chat message' })]),
      'GET /api/workspaces/w1/inbox/chats/c2/thread': page([message({ id: 'm2', body: 'New chat message' })]),
    });
    const release = gateThreadOfC1(fetch);
    const { rerender } = renderThread('c1');
    await waitFor(() => expect(callsTo(fetch, `GET ${THREAD}`)).toBe(1));

    rerender(tree('c2'));
    expect(await screen.findByText('New chat message')).toBeInTheDocument();
    await act(async () => {
      release();
    });
    expect(screen.getByText('New chat message')).toBeInTheDocument();
    expect(screen.queryByText('Old chat message')).toBeNull();
  });

  it('merges an event that arrives while the first page loads', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([message({ id: 'm1', body: 'From the page', timestamp: hoursAgo(3) })]),
    });
    const release = gateThreadOfC1(fetch);
    renderThread();
    await waitFor(() => expect(callsTo(fetch, `GET ${THREAD}`)).toBe(1));

    act(() => apply(messageEvent(message({ id: 'm2', body: 'Live one', timestamp: hoursAgo(1) }))));
    expect(await screen.findByText('Live one')).toBeInTheDocument();
    await act(async () => {
      release();
    });
    await screen.findByText('From the page');
    expect(screen.getAllByText(/From the page|Live one/).map((e) => e.textContent)).toEqual([
      'From the page',
      'Live one',
    ]);
  });

  it('inserts a late event between existing items by time', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({ id: 'm1', body: 'Early', timestamp: hoursAgo(3) }),
        message({ id: 'm3', body: 'Late', timestamp: hoursAgo(1) }),
      ]),
    });
    renderThread();
    await screen.findByText('Late');

    act(() => apply(messageEvent(message({ id: 'm2', body: 'Middle', timestamp: hoursAgo(2) }))));
    expect(screen.getAllByText(/Early|Middle|Late/).map((e) => e.textContent)).toEqual(['Early', 'Middle', 'Late']);
  });

  it('day separators', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({ id: 'm1', body: 'Long ago', timestamp: '2025-03-05T12:00:00' }),
        message({ id: 'm2', body: 'Yesterday msg', timestamp: noon(1) }),
        message({ id: 'm3', body: 'Today one', timestamp: noon(0) }),
        message({ id: 'm4', body: 'Today two', timestamp: noon(0) }),
      ]),
    });
    renderThread();

    await screen.findByText('Today two');
    expect(screen.getAllByRole('separator').map((s) => s.textContent)).toEqual(['5 Mar 2025', 'Yesterday', 'Today']);
  });

  it('keeps the view at the bottom only when it already was', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([message({ id: 'm1', body: 'One', timestamp: hoursAgo(3) })]),
    });
    renderThread();
    const scroller = await screen.findByRole('log', { name: 'Messages' });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 });

    scroller.scrollTop = 580; // within 40 px of the bottom (1000 - 400 = 600)
    scroller.dispatchEvent(new Event('scroll'));
    act(() => apply(messageEvent(message({ id: 'm2', body: 'Two', timestamp: hoursAgo(2) }))));
    expect(scroller.scrollTop).toBe(1000);

    scroller.scrollTop = 100;
    scroller.dispatchEvent(new Event('scroll'));
    act(() => apply(messageEvent(message({ id: 'm3', body: 'Three', timestamp: hoursAgo(1) }))));
    expect(scroller.scrollTop).toBe(100);
  });

  it('stays at the bottom when an image loads and makes the content taller', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({
          id: 'm1',
          type: 'image',
          media: { mimetype: 'image/png', filename: null, size: 10, available: true },
        }),
      ]),
      [`GET ${MEDIA('m1')}`]: { status: 200, text: 'PNG', headers: { 'Content-Type': 'image/png' } },
    });
    renderThread();
    const scroller = await screen.findByRole('log', { name: 'Messages' });
    const image = await screen.findByRole('img');
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 });

    fireEvent.load(image);
    expect(scroller.scrollTop).toBe(1000);

    // Someone who scrolled up to read is left where they are.
    scroller.scrollTop = 100;
    scroller.dispatchEvent(new Event('scroll'));
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1500 });
    fireEvent.load(image);
    expect(scroller.scrollTop).toBe(100);
  });

  it('stays at the bottom when a video learns its size', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({
          id: 'm1',
          type: 'video',
          media: { mimetype: 'video/mp4', filename: null, size: 10, available: true },
        }),
      ]),
      [`GET ${MEDIA('m1')}`]: { status: 200, text: 'MP4', headers: { 'Content-Type': 'video/mp4' } },
    });
    const { container } = renderThread();
    const scroller = await screen.findByRole('log', { name: 'Messages' });
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 900 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 });

    fireEvent.loadedMetadata(container.querySelector('video') as HTMLVideoElement);
    expect(scroller.scrollTop).toBe(900);
  });

  it('fetches nothing without a chat', async () => {
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND) });
    renderThread(null);
    await waitFor(() => expect(screen.getByRole('log', { name: 'Messages' })).toBeInTheDocument());
    expect(callsTo(fetch, `GET ${THREAD}`)).toBe(0);
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, else d MMM yyyy', () => {
    const now = new Date(2026, 9, 21, 9, 30);
    expect(dayLabel(new Date(2026, 9, 21, 0, 5).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 20, 23, 59).toISOString(), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 9, 19, 12).toISOString(), now)).toBe('19 Oct 2026');
    expect(dayLabel(new Date(2025, 0, 3, 12).toISOString(), now)).toBe('3 Jan 2025');
  });
});
