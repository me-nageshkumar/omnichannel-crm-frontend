import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActionView, ChatView, InboxEvent, MessageView, ThreadItem } from '@app/api/inbox';
import { Thread, actionText } from '@app/Inbox/Thread';
import { dayLabel } from '@app/Inbox/chatDisplay';
import { ThreadState, itemKey, useThread } from '@app/Inbox/useThread';
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
  adClick: null,
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
    adClick: null,
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
    reasonDetail: null,
    ...over,
  };
  return { kind: 'action', message: null, action: a, at: a.at };
}

const page = (items: ThreadItem[], hasMore = false) => ({ status: 200, body: { items, hasMore } });
const named = (name: string) => ({ id: `id-${name}`, name });

let apply: (event: InboxEvent) => void = () => undefined;
let shownThread: ThreadState | null = null;

const Host: React.FunctionComponent<{ chatId: string | null }> = ({ chatId }) => {
  const { status } = useSession();
  return status === 'signedIn' ? <Open chatId={chatId} /> : null;
};

const Open: React.FunctionComponent<{ chatId: string | null }> = ({ chatId }) => {
  const thread = useThread(chatId);
  apply = thread.apply;
  shownThread = thread;
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

  it('shows a poll with no options and a location with no name', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({ id: 'm1', type: 'poll_creation', body: 'Lunch where?', pollOptions: null }),
        message({ id: 'm2', type: 'location', location: { latitude: 0, longitude: 0, description: null } }),
      ]),
    });
    renderThread();

    expect(await screen.findByText('Lunch where?')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Poll options' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Location' })).toHaveAttribute('href', 'https://maps.google.com/?q=0,0');
  });

  it('lists every poll option even when two are the same', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({ id: 'm1', type: 'poll_creation', body: 'Pick', pollOptions: ['Same', 'Same'] }),
      ]),
    });
    renderThread();

    const list = await screen.findByRole('list', { name: 'Poll options' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('same key'),
      expect.anything(),
      expect.anything(),
    );
    consoleError.mockRestore();
  });

  const showing = async (...messages: ThreadItem[]) => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [`GET ${THREAD}`]: page(messages) });
    renderThread();
    return screen.findByRole('log', { name: 'Messages' });
  };

  const call = (id: string, direction: 'IN' | 'OUT', detail: MessageView['call']) =>
    message({ id, type: 'call_log', direction, call: detail });

  it.each<[string, 'IN' | 'OUT', MessageView['call'], string]>([
    ['nothing known, in', 'IN', null, 'Incoming call'],
    ['nothing known, out', 'OUT', null, 'Outgoing call'],
    ['an answered call', 'IN', { video: false, missed: false, durationSeconds: 125 }, 'Incoming call · 2 min 5 s'],
    ['a short call', 'OUT', { video: false, missed: false, durationSeconds: 45 }, 'Outgoing call · 45 s'],
    ['a long call', 'IN', { video: false, missed: false, durationSeconds: 3900 }, 'Incoming call · 1 h 5 min'],
    ['a video call', 'OUT', { video: true, missed: false, durationSeconds: null }, 'Outgoing video call'],
    ['a missed call', 'IN', { video: false, missed: true, durationSeconds: null }, 'Missed call'],
    ['a missed video call', 'IN', { video: true, missed: true, durationSeconds: null }, 'Missed video call'],
    ['an unanswered call', 'OUT', { video: false, missed: true, durationSeconds: null }, 'Call not answered'],
  ])('shows %s as a line', async (_name, direction, detail, text) => {
    await showing(call('c1', direction, detail));
    expect(await screen.findByText(text)).toBeVisible();
    expect(screen.queryByText('Unsupported message')).toBeNull();
  });

  it('a stored WhatsApp notice is a quiet line, not an unsupported message', async () => {
    const log = await showing(message({ id: 'n1', type: 'notification_template' }));
    expect(await within(log).findByText('WhatsApp notice')).toBeVisible();
    expect(screen.queryByText('Unsupported message')).toBeNull();
    expect(log.querySelector('[data-side]')).toBeNull();
  });

  const WIFE =
    'BEGIN:VCARD\nVERSION:3.0\nN:;Wife;;;\nFN:Wife\nTEL;type=CELL;waid=919799750743:+91 97997 50743\nEMAIL;type=INTERNET:wife@example.com\nEND:VCARD';
  const ASHA = 'BEGIN:VCARD\nVERSION:3.0\nN:Rao;Asha;;;\nTEL:+91 98100 00001\nEND:VCARD';

  it('a contact card shows the name, number and email on it', async () => {
    const log = await showing(message({ id: 'v1', type: 'vcard', body: WIFE }));
    const card = await within(log).findByRole('group', { name: 'Contact card: Wife' });
    expect(within(card).getByText('Wife')).toBeVisible();
    expect(within(card).getByText('+91 97997 50743')).toBeVisible();
    expect(within(card).getByText('wife@example.com')).toBeVisible();
    expect(screen.queryByText('Unsupported message')).toBeNull();
    expect(screen.queryByText(/BEGIN:VCARD/)).toBeNull();
  });

  it('several contact cards show one after the other, named from N when FN is missing', async () => {
    const log = await showing(message({ id: 'v2', type: 'multi_vcard', body: `${WIFE}\n${ASHA}` }));
    expect(await within(log).findByRole('group', { name: 'Contact card: Wife' })).toBeVisible();
    const asha = within(log).getByRole('group', { name: 'Contact card: Asha Rao' });
    expect(within(asha).getByText('+91 98100 00001')).toBeVisible();
  });

  it('a contact card with nothing readable on it still says it is a contact card', async () => {
    const log = await showing(message({ id: 'v3', type: 'vcard', body: null }));
    expect(await within(log).findByText('Contact card')).toBeVisible();
    expect(screen.queryByText('Unsupported message')).toBeNull();
  });

  it('a verification code WhatsApp keeps on the phone says so', async () => {
    const log = await showing(message({ id: 'b1', type: 'biz_content_placeholder', businessTag: 'AUTHENTICATION' }));
    expect(await within(log).findByText('A verification code only the phone can show')).toBeVisible();
  });

  it('a channel invite names the channel', async () => {
    const log = await showing(message({ id: 'n1', type: 'newsletter_follower_invite', body: 'Speak English' }));
    expect(await within(log).findByText('An invitation to follow the channel “Speak English”')).toBeVisible();
  });

  it.each([
    ['biz_content_placeholder', 'A business message only the phone can show'],
    ['unknown', 'A message only the phone can show'],
    ['newsletter_follower_invite', 'An invitation to follow a WhatsApp channel'],
  ])('a %s message says what it is', async (type, text) => {
    const log = await showing(message({ id: 'u1', type }));
    expect(await within(log).findByText(text)).toBeVisible();
    expect(screen.queryByText('Unsupported message')).toBeNull();
  });

  it('a type nobody knows still says it is unsupported', async () => {
    const log = await showing(message({ id: 'x1', type: 'something_new' }));
    expect(await within(log).findByText('Unsupported message')).toBeVisible();
  });

  const interactive = (over: Partial<MessageView> = {}) =>
    message({ id: 'i1', type: 'interactive', body: 'Dear *Asha*, your policy is due', ...over });
  const cached = (mimetype: string): MessageView['media'] => ({
    mimetype,
    filename: null,
    size: 2048,
    available: true,
  });

  it('an interactive message shows its text, formatted', async () => {
    const log = await showing(interactive());
    expect((await within(log).findByText('Asha')).tagName).toBe('STRONG');
    expect(screen.queryByText('Unsupported message')).toBeNull();
    expect(screen.queryByText('Media not available')).toBeNull();
    expect(log.querySelector('[data-side]')).not.toBeNull();
  });

  it('an interactive message with no text or media is still unsupported', async () => {
    await showing(interactive({ body: null }));
    expect(await screen.findByText('Unsupported message')).toBeVisible();
  });

  const showingMedia = async (item: ThreadItem) => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([item]),
      [`GET ${MEDIA('i1')}`]: { status: 200, text: 'x', headers: { 'Content-Type': 'application/octet-stream' } },
    });
    renderThread();
    return screen.findByRole('log', { name: 'Messages' });
  };

  it('an interactive message plays a video as a video', async () => {
    const log = await showingMedia(interactive({ media: cached('video/mp4') }));
    await waitFor(() => expect(log.querySelector('video')).not.toBeNull());
    expect(log.querySelector('img')).toBeNull();
    expect(within(log).getByText('Asha')).toBeVisible();
  });

  it('an interactive message shows an image as an image', async () => {
    const log = await showingMedia(interactive({ media: cached('image/jpeg') }));
    await waitFor(() => expect(log.querySelector('img')).not.toBeNull());
    expect(log.querySelector('img')?.getAttribute('alt')).toBe('Image');
  });

  it('a video not yet fetched waits for Download, then plays as a video', async () => {
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        interactive({ media: { mimetype: 'video/mp4', filename: null, size: 2048, available: false } }),
      ]),
      [`GET ${MEDIA('i1')}`]: { status: 200, text: 'x', headers: { 'Content-Type': 'video/mp4' } },
    });
    const { user } = renderThread();
    const log = await screen.findByRole('log', { name: 'Messages' });

    await user.click(await within(log).findByRole('button', { name: 'Download' }));

    await waitFor(() => expect(log.querySelector('video')).not.toBeNull());
    expect(log.querySelector('img')).toBeNull();
    expect(mediaCalls(fetch, 'i1')).toBe(1);
  });

  it('an interactive message offers anything else as a download', async () => {
    const log = await showing(
      interactive({ media: { mimetype: 'application/pdf', filename: 'policy.pdf', size: 2048, available: true } }),
    );
    expect(await within(log).findByText('policy.pdf')).toBeVisible();
    expect(within(log).getByRole('button', { name: 'Download' })).toBeVisible();
  });

  it('a call is a line, not a bubble, and has no ticks', async () => {
    const log = await showing(call('c1', 'OUT', null));
    await within(log).findByText('Outgoing call');
    expect(log.querySelector('[data-side]')).toBeNull();
    expect(within(log).queryByRole('img', { name: /sent|pending|delivered|read/i })).toBeNull();
  });

  const poll = (over: Partial<MessageView> = {}) =>
    message({ id: 'p1', type: 'poll_creation', body: 'Lunch?', pollOptions: ['Yes', 'No'], ...over });
  const pollVote = (voter: string, options: number[], fromMe = false) => ({
    voter,
    fromMe,
    options,
    at: '2026-11-01T01:54:54Z',
  });
  const option = (name: string) => screen.getByRole('listitem', { name });

  it('a poll without votes says so', async () => {
    await showing(poll());
    expect(await screen.findByText('No votes yet')).toBeVisible();
    expect(option('Yes: 0 votes')).toBeVisible();
    expect(option('No: 0 votes')).toBeVisible();
  });

  it('counts the votes on each option and names the contact', async () => {
    await showing(poll({ pollVotes: [pollVote('1@lid', [0])] }));
    expect(await screen.findByText('1 vote')).toBeVisible();
    const yes = option('Yes: 1 vote');
    expect(within(yes).getByText('Asha Rao')).toBeVisible();
    expect(within(option('No: 0 votes')).queryByText('Asha Rao')).toBeNull();
  });

  it('a vote from this number shows as You', async () => {
    await showing(poll({ pollVotes: [pollVote('me@c.us', [1], true)] }));
    await screen.findByText('1 vote');
    expect(within(option('No: 1 vote')).getByText('You')).toBeVisible();
  });

  it('a voter can pick several options and still counts once', async () => {
    await showing(poll({ pollVotes: [pollVote('1@lid', [0, 1])] }));
    expect(await screen.findByText('1 vote')).toBeVisible();
    expect(option('Yes: 1 vote')).toBeVisible();
    expect(option('No: 1 vote')).toBeVisible();
  });

  it("the bars show each option's share of the voters", async () => {
    await showing(poll({ pollVotes: [pollVote('a', [0]), pollVote('b', [0, 1], true)] }));
    await screen.findByText('2 votes');
    const bar = (name: string) => option(name).querySelector<HTMLElement>('[data-poll-bar]');
    expect(bar('Yes: 2 votes')?.style.width).toBe('100%');
    expect(bar('No: 1 vote')?.style.width).toBe('50%');
  });

  it('a vote for an option the poll no longer lists is ignored', async () => {
    await showing(poll({ pollVotes: [pollVote('a', [7])] }));
    expect(await screen.findByText('1 vote')).toBeVisible();
    expect(option('Yes: 0 votes')).toBeVisible();
  });

  it('a live vote updates the poll in place', async () => {
    await showing(poll());
    await screen.findByText('No votes yet');
    act(() =>
      shownThread?.apply({
        type: 'message',
        chatId: 'c1',
        message: poll({ pollVotes: [pollVote('1@lid', [0])] }).message as MessageView,
      }),
    );
    expect(await screen.findByText('1 vote')).toBeVisible();
    expect(screen.queryByText('No votes yet')).toBeNull();
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
        message({ id: 'm3', type: 'poll_creation', body: 'Lunch where?', pollOptions: ['Pizza', 'Sushi'] }),
        message({ id: 'm4', type: 'something_new' }),
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
    const options = within(screen.getByRole('list', { name: 'Poll options' })).getAllByRole('listitem');
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual(['Pizza: 0 votes', 'Sushi: 0 votes']);
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
      reasonDetail: null,
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
    expect(actionText(action({ type: 'ROUTED', toUser: to, reason: 'FETCHED' }))).toBe(
      'Routed to Demo Agent (fetched from WhatsApp, waiting for a reply)',
    );
    expect(
      actionText(
        action({
          type: 'TRANSFERRED',
          fromTeam: { id: 't1', name: 'Sales' },
          toTeam: { id: 't2', name: 'Support' },
          by,
        }),
      ),
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

  it('resetReplacesItemsAndRestoresHasMore', async () => {
    let calls = 0;
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: () =>
        ++calls === 1
          ? page([message({ id: 'm1', body: 'Short', timestamp: '2026-10-20T10:00:00Z' })])
          : page(
              [
                message({ id: 'm8', body: 'Imported one', timestamp: '2026-10-18T10:00:00Z' }),
                message({ id: 'm9', body: 'Imported two', timestamp: '2026-10-19T10:00:00Z' }),
              ],
              true,
            ),
    });
    renderThread();

    await screen.findByText('Short');
    expect(screen.queryByRole('button', { name: 'Load earlier' })).toBeNull();
    act(() => shownThread?.reset());
    await screen.findByText('Imported two');
    expect(shownThread?.items.map(itemKey)).toEqual(['m:m8', 'm:m9']);
    expect(shownThread?.hasMore).toBe(true);
    expect(screen.queryByText('Short')).toBeNull();
    expect(screen.getByRole('button', { name: 'Load earlier' })).toBeVisible();
    expect(calls).toBe(2);
  });

  it('catchUpMergesWithoutDroppingAndOffersOlderMessages', async () => {
    let calls = 0;
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: () =>
        ++calls === 1
          ? page([message({ id: 'm1', body: 'Short', timestamp: '2026-10-20T10:00:00Z' })])
          : page([message({ id: 'm9', body: 'Imported', timestamp: '2026-10-19T10:00:00Z' })], true),
    });
    renderThread();

    await screen.findByText('Short');
    act(() => shownThread?.catchUp());
    await screen.findByText('Imported');
    expect(shownThread?.items.map(itemKey)).toEqual(['m:m9', 'm:m1']);
    expect(shownThread?.hasMore).toBe(true);
    expect(shownThread?.loading).toBe(false);
  });

  it('catchUpLeavesNoGapThatLoadEarlierCouldNotReach', async () => {
    let calls = 0;
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: () =>
        ++calls === 1
          ? page([
              message({ id: 'march', body: 'March', timestamp: '2026-03-01T10:00:00Z' }),
              message({ id: 'oct', body: 'October', timestamp: '2026-10-20T10:00:00Z' }),
            ])
          : page(
              [
                message({ id: 'sept', body: 'September', timestamp: '2026-09-01T10:00:00Z' }),
                message({ id: 'oct', body: 'October', timestamp: '2026-10-20T10:00:00Z' }),
              ],
              true,
            ),
    });
    renderThread();

    await screen.findByText('March');
    act(() => shownThread?.catchUp());
    await screen.findByText('September');
    // March comes back through Load earlier, walking past everything imported on the way
    expect(shownThread?.items.map(itemKey)).toEqual(['m:sept', 'm:oct']);
    expect(shownThread?.hasMore).toBe(true);
  });

  it('catchUpKeepsWhatTheReaderLoadedEarlier', async () => {
    let calls = 0;
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: () => {
        calls += 1;
        if (calls === 1)
          return page([message({ id: 'oct', body: 'October', timestamp: '2026-10-20T10:00:00Z' })], true);
        if (calls === 2) return page([message({ id: 'march', body: 'March', timestamp: '2026-03-01T10:00:00Z' })]);
        return page([message({ id: 'sept', body: 'September', timestamp: '2026-09-01T10:00:00Z' })]);
      },
    });
    renderThread();

    await screen.findByText('October');
    act(() => shownThread?.loadEarlier());
    await screen.findByText('March');
    act(() => shownThread?.catchUp());
    await screen.findByText('September');
    expect(shownThread?.items.map(itemKey)).toEqual(['m:march', 'm:sept', 'm:oct']);
  });

  it('catchUpKeepsAMessageNewerThanThePage', async () => {
    let calls = 0;
    const live = message({ id: 'live', body: 'Just arrived', timestamp: '2026-10-21T10:00:00Z' });
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: () =>
        ++calls === 1
          ? page([message({ id: 'oct', body: 'October', timestamp: '2026-10-20T10:00:00Z' })])
          : page([
              message({ id: 'sept', body: 'September', timestamp: '2026-09-01T10:00:00Z' }),
              message({ id: 'oct', body: 'October', timestamp: '2026-10-20T10:00:00Z' }),
            ]),
    });
    renderThread();

    await screen.findByText('October');
    act(() => shownThread?.apply({ type: 'message', chatId: 'c1', message: live.message as MessageView }));
    act(() => shownThread?.catchUp());
    await screen.findByText('September');
    expect(shownThread?.items.map(itemKey)).toEqual(['m:sept', 'm:oct', 'm:live']);
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

  it('showsTheAutomationAsTheSender', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({
          id: 'm1',
          direction: 'OUT',
          source: 'AUTOMATION',
          body: 'Welcome aboard',
          sentBy: { id: null, name: 'Automation: Welcome' },
        }),
      ]),
    });
    renderThread();
    const bubble = (await screen.findByText('Welcome aboard')).closest('[data-side]') as HTMLElement;
    expect(within(bubble).getByText('Automation: Welcome')).toBeInTheDocument();
    expect(within(bubble).queryByText('WhatsApp Web')).toBeNull();
  });

  it('routedByAutomationLine', () => {
    const action = (over: Partial<ActionView>): ActionView => ({
      id: 'a',
      type: 'ROUTED',
      by: null,
      toUser: null,
      toTeam: { id: 't1', name: 'Support' },
      at: hoursAgo(1),
      reason: 'AUTOMATION',
      fromTeam: null,
      reasonDetail: null,
      ...over,
    });
    expect(actionText(action({ reasonDetail: 'Welcome' }))).toBe('Routed to Support (by automation: Welcome)');
    expect(actionText(action({ reasonDetail: null }))).toBe('Routed to Support (by automation)');
  });

  const AD = {
    sourceId: '1',
    sourceUrl: 'https://fb.me/x',
    sourceApp: 'facebook',
    headline: 'Diwali sale',
    description: null,
  };

  it('showsTheAdLine', async () => {
    mockFetch({ ...meAs(AGENT_IN_BRAND), [`GET ${THREAD}`]: page([message({ id: 'm1', body: 'Hi', adClick: AD })]) });
    renderThread();
    const link = await screen.findByRole('link', { name: 'Diwali sale' });
    expect(link).toHaveAttribute('href', 'https://fb.me/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.parentElement).toHaveTextContent('From ad: Diwali sale');
  });

  it('adLineWithoutLinkIsText', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([message({ id: 'm1', body: 'Hi', adClick: { ...AD, sourceUrl: null } })]),
    });
    renderThread();
    expect(await screen.findByText('From ad: Diwali sale')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Diwali sale' })).toBeNull();
  });

  it('adLineFallsBackToAnAd', async () => {
    mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [`GET ${THREAD}`]: page([
        message({ id: 'm1', body: 'Hi', adClick: { ...AD, sourceUrl: 'javascript:alert(1)', headline: null } }),
      ]),
    });
    renderThread();
    expect(await screen.findByText('From ad: an ad')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'an ad' })).toBeNull();
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
