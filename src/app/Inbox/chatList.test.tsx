import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatView, InboxEvent } from '@app/api/inbox';
import type { CurrentUser } from '@app/api/users';
import { ChatList } from '@app/Inbox/ChatList';
import { defaultFilters } from '@app/Inbox/chatDisplay';
import { useChatList } from '@app/Inbox/useChatList';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { useAccess } from '@app/session/useAccess';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { callsTo, mockFetch } from '../../test/fetchMock';
import { AGENT_IN_BRAND, BRAND_A, meAs, storeSession } from '../../test/session';

const LIST = '/api/workspaces/w1/inbox/phone-numbers/p1/chats';
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function chat(over: Partial<ChatView> & { id: string }): ChatView {
  return {
    phoneNumberId: 'p1',
    remoteId: `${over.id}@c.us`,
    contact: { id: `c-${over.id}`, name: null, phone: null, numberHidden: false },
    status: 'OPEN',
    assignedUser: null,
    assignedTeam: null,
    unreadCount: 0,
    lastMessageAt: hoursAgo(1),
    lastMessage: null,
    creationTime: hoursAgo(48),
    ...over,
  };
}

const ASHA = chat({
  id: 'a',
  contact: { id: 'c-a', name: 'Asha Rao', phone: '919900000001', numberHidden: false },
  unreadCount: 3,
  lastMessageAt: hoursAgo(2),
  lastMessage: { direction: 'OUT', type: 'text', text: 'See you soon', status: 'DELIVERED' },
});
const MEENA = chat({
  id: 'b',
  contact: { id: 'c-b', name: 'Meena', phone: null, numberHidden: true },
  lastMessageAt: hoursAgo(5),
  lastMessage: { direction: 'IN', type: 'text', text: 'Hello there', status: 'READ' },
});
const PHONE_ONLY = chat({
  id: 'c',
  contact: { id: 'c-c', name: null, phone: '919900000003', numberHidden: false },
  lastMessageAt: hoursAgo(9),
});

const HIDDEN = chat({
  id: 'd',
  contact: { id: 'c-d', name: null, phone: null, numberHidden: true },
  lastMessageAt: hoursAgo(12),
});

const page = (items: ChatView[], hasMore = false) => ({ status: 200, body: { items, hasMore } });

function withAuthorities(...authorities: string[]): CurrentUser {
  const base = AGENT_IN_BRAND;
  return { ...base, workspaces: [{ ...BRAND_A, role: base.workspaces[0].role, authorities }] };
}
const AGENT = withAuthorities('inbox:view');
const LEAD = withAuthorities('inbox:view', 'inbox:view-team');
const MANAGER = withAuthorities('inbox:view', 'inbox:view-team', 'inbox:view-all');

let apply: (event: InboxEvent) => void = () => undefined;

const Host: React.FunctionComponent = () => {
  const { status } = useSession();
  return status === 'signedIn' ? <Inbox /> : null;
};

const Inbox: React.FunctionComponent = () => {
  const access = useAccess();
  const [filters, setFilters] = React.useState(() => defaultFilters(access));
  const [selectedId, setSelectedId] = React.useState<string | null>('b');
  const list = useChatList('p1', filters);
  apply = list.apply;
  return (
    <div style={{ height: 600 }}>
      <ChatList
        phoneNumberId="p1"
        selectedId={selectedId}
        onSelect={(c) => setSelectedId(c.id)}
        filters={filters}
        onFilters={setFilters}
        list={list}
      />
    </div>
  );
};

function renderList() {
  const user = userEvent.setup();
  const { unmount } = render(
    <ThemeProvider>
      <SessionProvider>
        <Host />
      </SessionProvider>
    </ThemeProvider>,
  );
  return { user, unmount };
}

const rows = async () => within(await screen.findByRole('list', { name: 'Chats' })).getAllByRole('listitem');
const urls = (fetch: ReturnType<typeof mockFetch>) =>
  fetch.mock.calls.map(([input]) => new URL(String(input), 'http://localhost'));
const listUrls = (fetch: ReturnType<typeof mockFetch>) => urls(fetch).filter((u) => u.pathname === LIST);
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('chat list', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers only allowed scopes and defaults to the widest', async () => {
    const agent = mockFetch({ ...meAs(AGENT), [`GET ${LIST}`]: page([ASHA]) });
    const first = renderList();
    await rows();
    expect(screen.queryByRole('group', { name: 'Scope' })).toBeNull();
    expect(listUrls(agent)[0].searchParams.get('scope')).toBe('MINE');
    expect(listUrls(agent)[0].searchParams.get('status')).toBe('OPEN');
    first.unmount();

    const lead = mockFetch({ ...meAs(LEAD), [`GET ${LIST}`]: page([ASHA]) });
    const second = renderList();
    await rows();
    const leadScope = within(screen.getByRole('group', { name: 'Scope' }));
    expect(leadScope.getAllByRole('button').map((b) => b.textContent)).toEqual(['Mine', 'Team', 'Unassigned']);
    expect(pressed('Team')).toBe('true');
    expect(pressed('Mine')).toBe('false');
    expect(listUrls(lead)[0].searchParams.get('scope')).toBe('TEAM');
    second.unmount();

    const manager = mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA]) });
    renderList();
    await rows();
    const scope = within(screen.getByRole('group', { name: 'Scope' }));
    expect(scope.getAllByRole('button').map((b) => b.textContent)).toEqual(['Mine', 'Team', 'Unassigned', 'All']);
    expect(pressed('All')).toBe('true');
    expect(listUrls(manager)[0].searchParams.get('scope')).toBe('ALL');
  });

  it('renders rows with preview, tick and unread badge', async () => {
    mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA, MEENA, PHONE_ONLY, HIDDEN]) });
    renderList();
    const [asha, meena, phone, hidden] = await rows();
    expect(asha).toHaveTextContent('Asha Rao');
    expect(within(asha).getByText('See you soon')).toBeVisible();
    expect(within(asha).getByRole('img', { name: 'Delivered' })).toHaveTextContent('✓✓');
    expect(within(asha).getByText('3')).toBeVisible();
    expect(within(asha).getByText('2 hours ago')).toBeVisible();
    expect(within(asha).getByText('A')).toBeVisible();
    expect(within(hidden).getByText('Number hidden')).toBeVisible();
    expect(within(meena).getByText('Meena')).toBeVisible();
    expect(within(meena).getByText('Hello there')).toBeVisible();
    expect(within(meena).queryByRole('img')).toBeNull();
    expect(within(phone).getByText('+919900000003')).toBeVisible();
    expect(within(meena).getByRole('button')).toHaveAttribute('aria-current', 'true');
    expect(within(asha).getByRole('button')).not.toHaveAttribute('aria-current');
  });

  it('shows No chats when the list is empty', async () => {
    mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([]) });
    renderList();
    expect(await screen.findByText('No chats')).toBeVisible();
  });

  it('selects a chat on click', async () => {
    mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA, MEENA]) });
    const { user } = renderList();
    const [asha] = await rows();
    await user.click(within(asha).getByRole('button'));
    expect(within((await rows())[0]).getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('visible:false event removes the row', async () => {
    mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA, MEENA]) });
    renderList();
    await rows();
    act(() => apply({ type: 'chat', chat: ASHA, visible: false }));
    const left = await rows();
    expect(left).toHaveLength(1);
    expect(left[0]).toHaveTextContent('Meena');
  });

  it('chat event moves updated chat to the top', async () => {
    const fetch = mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA, MEENA]) });
    renderList();
    await rows();
    const updated = {
      ...MEENA,
      unreadCount: 1,
      lastMessageAt: new Date().toISOString(),
      lastMessage: { direction: 'IN' as const, type: 'text', text: 'Anyone there?', status: 'READ' as const },
    };
    act(() => apply({ type: 'chat', chat: updated, visible: true }));
    const [top, second] = await rows();
    expect(top).toHaveTextContent('Meena');
    expect(top).toHaveTextContent('Anyone there?');
    expect(second).toHaveTextContent('Asha Rao');
    expect(callsTo(fetch, `GET ${LIST}`)).toBe(1);
  });

  it('ignores chat events of another number, and message events', async () => {
    const fetch = mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA]) });
    renderList();
    await rows();
    act(() => apply({ type: 'chat', chat: { ...MEENA, phoneNumberId: 'p2' }, visible: true }));
    act(() => apply({ type: 'chat', chat: { ...ASHA, phoneNumberId: 'p2' }, visible: false }));
    expect(await rows()).toHaveLength(1);
    expect(callsTo(fetch, `GET ${LIST}`)).toBe(1);
  });

  it('unknown chat event triggers a reload', async () => {
    const fetch = mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA]) });
    renderList();
    await rows();
    act(() => apply({ type: 'chat', chat: MEENA, visible: true }));
    await waitFor(() => expect(callsTo(fetch, `GET ${LIST}`)).toBe(2));
  });

  it('unknown chat of the other status does not reload', async () => {
    const fetch = mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA]) });
    renderList();
    await rows();
    act(() => apply({ type: 'chat', chat: { ...MEENA, status: 'CLOSED' }, visible: true }));
    expect(await rows()).toHaveLength(1);
    expect(callsTo(fetch, `GET ${LIST}`)).toBe(1);
  });

  it('load more appends the next page with before cursor', async () => {
    let n = 0;
    const fetch = mockFetch({
      ...meAs(MANAGER),
      [`GET ${LIST}`]: () => (n++ === 0 ? page([ASHA, MEENA], true) : page([PHONE_ONLY])),
    });
    const { user } = renderList();
    await rows();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(async () => expect(await rows()).toHaveLength(3));
    expect((await rows())[2]).toHaveTextContent('+919900000003');
    const second = listUrls(fetch)[1];
    expect(second.searchParams.get('before')).toBe(MEENA.lastMessageAt);
    expect(second.searchParams.get('scope')).toBe('ALL');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('clears the error when a retried load more succeeds', async () => {
    let n = 0;
    mockFetch({
      ...meAs(MANAGER),
      [`GET ${LIST}`]: () => {
        n++;
        if (n === 1) return page([ASHA, MEENA], true);
        return n === 2 ? { status: 500, body: {} } : page([PHONE_ONLY]);
      },
    });
    const { user } = renderList();
    await rows();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText(/went wrong|try again|error/i)).toBeVisible();
    expect(await rows()).toHaveLength(2);
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    await waitFor(async () => expect(await rows()).toHaveLength(3));
    expect(document.querySelector('.pf-v6-c-alert')).toBeNull();
  });

  it('refetches from the top when a filter changes', async () => {
    const fetch = mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA]) });
    const { user } = renderList();
    await rows();
    await user.click(screen.getByRole('button', { name: 'Closed' }));
    await user.click(screen.getByRole('switch', { name: 'Unread only' }));
    await user.click(screen.getByRole('button', { name: 'Mine' }));
    await waitFor(() => {
      const all = listUrls(fetch);
      const last = all[all.length - 1];
      expect(last.searchParams.get('status')).toBe('CLOSED');
      expect(last.searchParams.get('unread')).toBe('true');
      expect(last.searchParams.get('scope')).toBe('MINE');
      expect(last.searchParams.get('before')).toBeNull();
    });
  });

  it('debounces search by 300 ms', async () => {
    const fetch = mockFetch({ ...meAs(MANAGER), [`GET ${LIST}`]: page([ASHA]) });
    const { user } = renderList();
    await rows();
    await user.type(screen.getByRole('textbox', { name: 'Search chats' }), 'ash');
    expect(listUrls(fetch)).toHaveLength(1);
    await waitFor(() => expect(listUrls(fetch)).toHaveLength(2));
    expect(listUrls(fetch)[1].searchParams.get('q')).toBe('ash');
  });
});
