import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { HistoryChatView, HistoryImportView } from '@app/api/historyImports';
import { renderApp } from '../../test/renderApp';
import { MockRoute, callsTo, mockFetch } from '../../test/fetchMock';
import { phoneNumber } from '../../test/phoneNumbers';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const B = '/api/workspaces/w1/inbox';
const LIST = `GET ${B}/history-imports`;
const CHATS = `GET ${B}/history-imports/h1/chats`;
const CANCEL = `POST ${B}/history-imports/h1/cancel`;
const NUMBER = '+919928088743';

function view(over: Partial<HistoryImportView> = {}): HistoryImportView {
  return {
    id: 'h1',
    phoneNumber: { id: 'p1', number: '919928088743', label: null },
    scope: { kind: 'ALL', phones: [], chatCount: 0 },
    range: { from: null, to: null },
    status: 'RUNNING',
    waiting: null,
    counts: {
      chatsTotal: 4,
      chatsDone: 2,
      chatsSkipped: 0,
      chatsFailed: 0,
      messagesSeen: 30,
      messagesInserted: 12,
      messagesUpdated: 3,
    },
    requestedBy: { id: 'u4', name: 'Meera Manager' },
    creationTime: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    progressPercent: 50,
    error: null,
    ...over,
  };
}

function chat(over: Partial<HistoryChatView> = {}): HistoryChatView {
  return {
    id: 'hc1',
    remoteId: '919900000001@c.us',
    requestedPhone: '919900000001',
    chatName: null,
    chatId: null,
    status: 'SKIPPED',
    skipReason: 'NO_CHAT',
    error: null,
    counts: { seen: 0, inserted: 0, updated: 0 },
    capped: false,
    attemptedAt: null,
    finishedAt: null,
    ...over,
  };
}

/** The import's row in the imports table (the number also shows in the number filter). */
async function importRow(): Promise<HTMLElement> {
  const table = await screen.findByRole('grid', { name: 'History imports' });
  const row = (await within(table).findByText(NUMBER)).closest('tr');
  if (!row) throw new Error('no import row');
  return row;
}

const page = (...items: HistoryImportView[]) => ({ status: 200, body: { items, total: items.length, page: 0 } });

/** Answers the n-th request with the n-th list; the last one repeats. */
function inTurn(...lists: HistoryImportView[][]): MockRoute {
  let n = 0;
  return () => page(...lists[Math.min(n++, lists.length - 1)]);
}

function routes(list: MockRoute, extra: Record<string, MockRoute> = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${B}/phone-numbers`]: { status: 200, body: [phoneNumber({ id: 'p1', number: '919928088743' })] },
    [LIST]: list,
    ...extra,
  };
}

describe('history imports page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('listsImportsWithStatusAndProgress', async () => {
    mockFetch(routes(page(view({ waiting: 'NO_DEVICE' }))));
    renderApp('/inbox/history-imports');
    expect(await screen.findByRole('heading', { name: 'History imports' })).toBeVisible();
    const row = await importRow();
    expect(within(row).getByText('Running')).toBeVisible();
    expect(within(row).getByText('Waiting for the extension to connect')).toBeVisible();
    expect(within(row).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(within(row).getByText('All chats')).toBeVisible();
    expect(within(row).getByText('All time')).toBeVisible();
    expect(within(row).getByText('12 new · 3 updated · 30 seen')).toBeVisible();
  });

  it('showsEmptyState', async () => {
    mockFetch(routes(page()));
    renderApp('/inbox/history-imports');
    expect(await screen.findByText('No history imports yet.')).toBeVisible();
  });

  it('pollsWhileActiveThenStops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = mockFetch(routes(inTurn([view()], [view({ status: 'COMPLETED', progressPercent: 100 })])));
    renderApp('/inbox/history-imports', undefined, { advanceTimers: vi.advanceTimersByTime });
    const row = await importRow();
    expect(within(row).getByText('Running')).toBeVisible();
    expect(callsTo(fetch, LIST)).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(await within(await importRow()).findByText('Completed')).toBeVisible();
    expect(callsTo(fetch, LIST)).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(callsTo(fetch, LIST)).toBe(2);
  });

  it('cancelAsksThenPosts', async () => {
    const fetch = mockFetch(
      routes(inTurn([view()], [view({ status: 'CANCELLED' })]), {
        [CANCEL]: { status: 200, body: view({ status: 'CANCELLED' }) },
      }),
    );
    const { user } = renderApp('/inbox/history-imports');
    await user.click(within(await importRow()).getByRole('button', { name: 'Kebab toggle' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Cancel import' }));
    const dialog = await screen.findByRole('dialog');
    expect(callsTo(fetch, CANCEL)).toBe(0);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel import' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(callsTo(fetch, CANCEL)).toBe(1);
    expect(await within(await importRow()).findByText('Cancelled')).toBeVisible();
    expect(callsTo(fetch, LIST)).toBe(2);
  });

  it('expandLoadsChatItems', async () => {
    const fetch = mockFetch(
      routes(page(view({ status: 'COMPLETED' })), {
        [CHATS]: { status: 200, body: { items: [chat()], total: 1, page: 0 } },
      }),
    );
    const { user } = renderApp('/inbox/history-imports');
    const row = await importRow();
    expect(callsTo(fetch, CHATS)).toBe(0);
    await user.click(within(row).getByRole('button', { name: 'Details' }));
    expect(await screen.findByText('919900000001@c.us')).toBeVisible();
    expect(screen.getByText('No chat on the phone')).toBeVisible();
    await user.click(within(row).getByRole('button', { name: 'Details' }));
    await user.click(within(row).getByRole('button', { name: 'Details' }));
    expect(callsTo(fetch, CHATS)).toBe(1);
  });
});
