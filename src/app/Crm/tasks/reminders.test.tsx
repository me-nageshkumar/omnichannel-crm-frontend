import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings } from '../../../test/crm';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import { storeSession } from '../../../test/session';

const LIST = `GET ${BASE}/reminders`;
const reminder = (over = {}) => ({
  taskId: 't1',
  title: 'Call back',
  dueAt: '2026-10-24T09:30:00Z',
  target: { type: 'DEAL', id: 'd1', name: 'Acme order' },
  ...over,
});

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('CRM reminders', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setVisibility('visible');
  });

  it('pollsEverySixtySecondsWhileVisible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = mockFetch(boardRoutes({ [LIST]: { status: 200, body: [] } }));
    renderApp('/');
    await waitFor(() => expect(callsTo(f, LIST)).toBe(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await waitFor(() => expect(callsTo(f, LIST)).toBe(2));
  });

  it('pausesWhenHidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = mockFetch(boardRoutes({ [LIST]: { status: 200, body: [] } }));
    renderApp('/');
    await waitFor(() => expect(callsTo(f, LIST)).toBe(1));
    act(() => setVisibility('hidden'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    expect(callsTo(f, LIST)).toBe(1);
    act(() => setVisibility('visible'));
    await waitFor(() => expect(callsTo(f, LIST)).toBe(2));
  });

  it('toastShowsAndMarksSeenOnClose', async () => {
    const f = mockFetch(
      boardRoutes({
        [LIST]: { status: 200, body: [reminder()] },
        [`POST ${BASE}/reminders/t1/seen`]: { status: 204 },
      }),
    );
    const { user } = renderApp('/');
    const toast = await screen.findByText('Follow-up due: Call back');
    const alert = toast.closest('.pf-v6-c-alert') as HTMLElement;
    expect(within(alert).getByText(/^due \d{2}:\d{2}$/)).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: /Close/ }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/reminders/t1/seen`)).toBeDefined());
    expect(screen.queryByText('Follow-up due: Call back')).toBeNull();
  });

  it('noPollWhenCrmOff', async () => {
    const f = mockFetch(boardRoutes({ [LIST]: { status: 200, body: [] } }, { enabled: false }));
    renderApp('/');
    await new Promise((r) => setTimeout(r, 50));
    expect(callsTo(f, LIST)).toBe(0);
  });

  it('navLabelShowsCount', async () => {
    mockFetch(boardRoutes({ [LIST]: { status: 200, body: [reminder(), reminder({ taskId: 't2', title: 'Quote' })] } }));
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Tasks (2)', hidden: true })).toHaveAttribute('href', '/crm/tasks');
  });

  it('reminderLinkToHiddenRecordMarksSeen', async () => {
    const f = mockFetch(
      boardRoutes({
        [LIST]: { status: 200, body: [reminder({ taskId: 't9', target: { type: 'DEAL', id: 'd9', name: null } })] },
        [`POST ${BASE}/reminders/t9/seen`]: { status: 204 },
        [`GET ${BASE}/deals/d9`]: { status: 404, body: { code: 'NOT_FOUND', message: 'Deal not found' } },
        [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
      }),
    );
    const { user } = renderApp('/');
    const toast = (await screen.findByText('Follow-up due: Call back')).closest('.pf-v6-c-alert') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/reminders/t9/seen`)).toBeDefined());
    expect(await screen.findByText(/no longer available|not available/i)).toBeInTheDocument();
    expect(screen.queryByText('Follow-up due: Call back')).toBeNull();
  });
});
