import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HistoryImportView } from '@app/api/historyImports';
import type { ChatView } from '@app/api/inbox';
import { ChatHeader } from '@app/Inbox/ChatHeader';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { callsTo, mockFetch } from '../../test/fetchMock';
import { BRAND_VIEWER, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const POST = 'POST /api/workspaces/w1/inbox/chats/c1/history-imports';
const GET = 'GET /api/workspaces/w1/inbox/history-imports/imp1';
const ACTIVE = 'GET /api/workspaces/w1/inbox/chats/c1/history-imports/active';
const PAUSE = 'POST /api/workspaces/w1/inbox/history-imports/imp1/pause';
const RESUME = 'POST /api/workspaces/w1/inbox/history-imports/imp1/resume';
const STOP = 'POST /api/workspaces/w1/inbox/history-imports/imp1/cancel';

const CHAT: ChatView = {
  id: 'c1',
  phoneNumberId: 'p1',
  remoteId: '919900000001@c.us',
  contact: { id: 'ct1', name: 'Asha Rao', phone: '919900000001', numberHidden: false },
  status: 'OPEN',
  assignedUser: null,
  assignedTeam: null,
  unreadCount: 0,
  lastMessageAt: null,
  lastMessage: null,
  creationTime: new Date().toISOString(),
  lastAgent: null,
  adClick: null,
};

const view = (over: Partial<HistoryImportView>, counts: Partial<HistoryImportView['counts']> = {}) =>
  ({
    id: 'imp1',
    status: 'RUNNING',
    waiting: null,
    error: null,
    counts: { messagesSeen: 0, messagesInserted: 0, chatsSkipped: 0, chatsFailed: 0, ...counts },
    ...over,
  }) as HistoryImportView;

const Host: React.FunctionComponent<{ onImported(): void; chat?: ChatView }> = ({ onImported, chat = CHAT }) => {
  const { status } = useSession();
  return status === 'signedIn' ? (
    <MemoryRouter>
      <ChatHeader chat={chat} onChange={() => undefined} onHistoryImported={onImported} />
    </MemoryRouter>
  ) : null;
};

function setup(user: typeof WORKSPACE_MANAGER, routes: Parameters<typeof mockFetch>[0] = {}, chat?: ChatView) {
  const fetch = mockFetch({ ...meAs(user), ...routes });
  const onImported = vi.fn();
  const ui = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <ThemeProvider>
      <SessionProvider>
        <Host onImported={onImported} chat={chat} />
      </SessionProvider>
    </ThemeProvider>,
  );
  return { fetch, onImported, ui };
}

async function startImport(ui: ReturnType<typeof userEvent.setup>) {
  await ui.click(await screen.findByRole('button', { name: 'Fetch history' }));
  await ui.click(await screen.findByRole('button', { name: 'Start import' }));
}

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('chat header: fetch history', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fetchHistoryStartsAndShowsProgress', async () => {
    const { fetch, ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({ status: 'QUEUED' }) },
      [GET]: { status: 200, body: view({}, { messagesSeen: 12 }) },
    });
    await startImport(ui);
    expect(callsTo(fetch, POST)).toBe(1);
    await tick(5000);
    expect(await screen.findByText('Importing history… 12 messages so far')).toBeTruthy();
  });

  it('runningShowsPauseAndStop', async () => {
    const { ui } = setup(WORKSPACE_MANAGER, { [POST]: { status: 201, body: view({ status: 'QUEUED' }) } });
    await startImport(ui);
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('pauseThenPlay', async () => {
    const paused = view({ status: 'PAUSED' }, { messagesSeen: 100 });
    const { fetch, ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({}) },
      [PAUSE]: { status: 200, body: paused },
      [RESUME]: { status: 200, body: view({}, { messagesSeen: 100 }) },
      [GET]: { status: 200, body: view({}, { messagesSeen: 100 }) },
    });
    await startImport(ui);
    await ui.click(await screen.findByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('History import paused: 100 messages so far')).toBeTruthy();
    expect(callsTo(fetch, PAUSE)).toBe(1);
    await ui.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByText('Importing history… 100 messages so far')).toBeTruthy();
    expect(callsTo(fetch, RESUME)).toBe(1);
  });

  it('aPausedImportKeepsBeingFollowed', async () => {
    const { fetch, ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({ status: 'PAUSED' }) },
      [GET]: { status: 200, body: view({ status: 'PAUSED' }, { messagesSeen: 130 }) },
    });
    await startImport(ui);
    await tick(5000);
    expect(await screen.findByText('History import paused: 130 messages so far')).toBeTruthy();
    expect(callsTo(fetch, GET)).toBe(1);
  });

  it('stopShowsWhatWasFetchedAndChecksOnce', async () => {
    const { fetch, ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({}) },
      [STOP]: { status: 200, body: view({ status: 'CANCELLED' }, { messagesSeen: 100 }) },
      [GET]: { status: 200, body: view({ status: 'CANCELLED' }, { messagesSeen: 130 }) },
    });
    await startImport(ui);
    await ui.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('History import stopped: 100 messages fetched')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    await tick(5000);
    expect(await screen.findByText('History import stopped: 130 messages fetched')).toBeTruthy();
    await tick(5000);
    expect(callsTo(fetch, GET)).toBe(1);
  });

  it('aFailedControlShowsWhy', async () => {
    const { ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({}) },
      [PAUSE]: { status: 409, body: { code: 'HISTORY_IMPORT_STATE', message: 'This import cannot be paused now.' } },
    });
    await startImport(ui);
    await ui.click(await screen.findByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('This import cannot be paused now.')).toBeTruthy();
  });

  it('opensOnAnImportAlreadyGoing', async () => {
    setup(WORKSPACE_MANAGER, {
      [ACTIVE]: { status: 200, body: view({ status: 'PAUSED' }, { messagesSeen: 40 }) },
    });
    expect(await screen.findByText('History import paused: 40 messages so far')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('showsNothingWhenNoImportIsGoing', async () => {
    const { fetch } = setup(WORKSPACE_MANAGER, { [ACTIVE]: { status: 204 } });
    await screen.findByRole('button', { name: 'Fetch history' });
    await tick(0);
    expect(callsTo(fetch, ACTIVE)).toBe(1);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('doesNotLookForAnImportWithoutTheAuthority', async () => {
    const { fetch } = setup(BRAND_VIEWER);
    await screen.findByText('Asha Rao');
    await tick(0);
    expect(callsTo(fetch, ACTIVE)).toBe(0);
  });

  it('completionReloadsThread', async () => {
    const { fetch, onImported, ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({ status: 'QUEUED' }) },
      [GET]: { status: 200, body: view({ status: 'COMPLETED' }, { messagesInserted: 7 }) },
    });
    await startImport(ui);
    await tick(5000);
    expect(await screen.findByText('History imported: 7 new messages')).toBeTruthy();
    expect(onImported).toHaveBeenCalledTimes(1);
    await tick(5000);
    expect(callsTo(fetch, GET)).toBe(1);
    await tick(6000);
    expect(screen.queryByText('History imported: 7 new messages')).toBeNull();
    expect(onImported).toHaveBeenCalledTimes(1);
  });

  it('failureShowsErrorWithoutReload', async () => {
    const { onImported, ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({ status: 'QUEUED' }) },
      [GET]: { status: 200, body: view({ status: 'FAILED', error: 'NUMBER_GONE' }) },
    });
    await startImport(ui);
    await tick(5000);
    expect(await screen.findByText(/Failed.*NUMBER_GONE/)).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('completedWithFailedChatShowsWarningWithoutReload', async () => {
    const { onImported, ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({ status: 'QUEUED' }) },
      [GET]: { status: 200, body: view({ status: 'COMPLETED', error: 'NO_PROGRESS' }, { chatsFailed: 1 }) },
    });
    await startImport(ui);
    await tick(5000);
    expect(await screen.findByText(/Could not fetch this chat's history.*NO_PROGRESS/)).toBeTruthy();
    expect(screen.queryByText(/History imported/)).toBeNull();
    await tick(11000);
    expect(screen.getByText(/Could not fetch this chat's history/)).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('completedWithSkippedChatShowsNoChatWarning', async () => {
    const { onImported, ui } = setup(WORKSPACE_MANAGER, {
      [POST]: { status: 201, body: view({ status: 'QUEUED' }) },
      [GET]: { status: 200, body: view({ status: 'COMPLETED' }, { chatsSkipped: 1 }) },
    });
    await startImport(ui);
    await tick(5000);
    expect(await screen.findByText('No chat with this contact on the phone')).toBeTruthy();
    expect(screen.queryByText(/History imported/)).toBeNull();
    await tick(11000);
    expect(screen.getByText('No chat with this contact on the phone')).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('buttonHiddenWithoutAuthority', async () => {
    setup(BRAND_VIEWER);
    await screen.findByText('Asha Rao');
    expect(screen.queryByRole('button', { name: 'Fetch history' })).toBeNull();
  });

  it('adChatShowsTheLabel', async () => {
    const adClick = { sourceId: '1', sourceUrl: null, sourceApp: null, headline: 'Diwali sale', description: null };
    setup(WORKSPACE_MANAGER, {}, { ...CHAT, adClick });
    const label = (await screen.findByText('Ad')).closest('.pf-v6-c-label');
    expect(label).toHaveAttribute('title', 'Diwali sale');
  });

  it('noAdNoLabel', async () => {
    setup(WORKSPACE_MANAGER);
    await screen.findByText('Asha Rao');
    expect(screen.queryByText('Ad')).toBeNull();
  });
});
