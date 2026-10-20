import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { InboxEvent } from '@app/api/inbox';
import { useInboxStream } from '@app/Inbox/useInboxStream';
import { SessionProvider, useSession } from '@app/session/SessionContext';
import { ThemeProvider } from '@app/theme/ThemeContext';
import { callsTo, mockFetch } from '../../test/fetchMock';
import { frame, streamMock } from '../../test/inbox';
import { AGENT_IN_BRAND, meAs, storeSession } from '../../test/session';

const STREAM = 'GET /api/workspaces/w1/inbox/phone-numbers/p1/stream';
const events: InboxEvent[] = [];
const onReconnect = vi.fn();

const Probe: React.FunctionComponent = () => {
  const { state } = useInboxStream('p1', (e) => events.push(e), onReconnect);
  return <output aria-label="State">{state}</output>;
};

const Host: React.FunctionComponent = () => {
  const { status } = useSession();
  return status === 'signedIn' ? <Probe /> : null;
};

function renderStream() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <Host />
      </SessionProvider>
    </ThemeProvider>,
  );
}

/** A stream that ends the moment it is opened, having sent nothing. */
const dropped = () =>
  new Response(new ReadableStream<Uint8Array>({ start: (c) => c.close() }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

/** A stream that sends a ping and ends. */
const pinged = () =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(': ping\n\n'));
        c.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const state = () => screen.getByLabelText('State').textContent;

describe('useInboxStream', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    events.length = 0;
    onReconnect.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts connecting, then is open', async () => {
    const stream = streamMock();
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [STREAM]: stream.response });
    renderStream();
    await waitFor(() => expect(callsTo(fetch, STREAM)).toBe(1));
    await waitFor(() => expect(state()).toBe('open'));
  });

  it('puts a frame split across two chunks together', async () => {
    const stream = streamMock();
    mockFetch({ ...meAs(AGENT_IN_BRAND), [STREAM]: stream.response });
    renderStream();
    await waitFor(() => expect(state()).toBe('open'));
    const whole = frame('action', {
      chatId: 'c1',
      action: { type: 'CLOSED', by: null, toUser: null, toTeam: null, at: '2026-10-21T10:00:00Z' },
    });
    const cut = whole.indexOf('"chatId"') + 4;

    await act(async () => stream.push(whole.slice(0, cut)));
    expect(events).toHaveLength(0);
    await act(async () => stream.push(whole.slice(cut)));

    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({ type: 'action', chatId: 'c1', action: { type: 'CLOSED' } });
  });

  it('backs off 1 s, 2 s, 4 s while the server accepts and drops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [STREAM]: dropped });
    renderStream();
    await waitFor(() => expect(callsTo(fetch, STREAM)).toBe(1));
    await advance(900);
    expect(callsTo(fetch, STREAM)).toBe(1);
    await advance(300); // 1.2 s: the second attempt after 1 s
    expect(callsTo(fetch, STREAM)).toBe(2);
    await advance(1700); // 2.9 s: the third is due after another 2 s
    expect(callsTo(fetch, STREAM)).toBe(2);
    await advance(400); // 3.3 s
    expect(callsTo(fetch, STREAM)).toBe(3);
    await advance(3500); // 6.8 s: the fourth is due after another 4 s
    expect(callsTo(fetch, STREAM)).toBe(3);
    await advance(600); // 7.4 s
    expect(callsTo(fetch, STREAM)).toBe(4);
  });

  it('starts again at 1 s once a connection has been healthy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let n = 0;
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [STREAM]: () => (++n === 3 ? pinged() : n < 3 ? dropped() : streamMock().response),
    });
    renderStream();
    await waitFor(() => expect(callsTo(fetch, STREAM)).toBe(1));
    await advance(1200); // second attempt, after 1 s
    await advance(2200); // third, after 2 s: it pings and ends
    expect(callsTo(fetch, STREAM)).toBe(3);
    // The ping showed it healthy, so the next wait is 1 s again, not 4 s.
    await advance(1200);
    expect(callsTo(fetch, STREAM)).toBe(4);
  });

  it('also counts a connection that stayed open for 10 s as healthy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const streams: Array<ReturnType<typeof streamMock>> = [];
    let n = 0;
    const fetch = mockFetch({
      ...meAs(AGENT_IN_BRAND),
      [STREAM]: () => {
        if (++n < 3) return dropped();
        const s = streamMock();
        streams.push(s);
        return s.response;
      },
    });
    renderStream();
    await waitFor(() => expect(callsTo(fetch, STREAM)).toBe(1));
    await advance(1200);
    await advance(2200);
    expect(callsTo(fetch, STREAM)).toBe(3);
    await advance(11_000); // open and silent for 11 s
    act(() => streams[0].close());
    await advance(1200);
    expect(callsTo(fetch, STREAM)).toBe(4);
  });

  it('reports retrying while it waits to reconnect', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [STREAM]: dropped });
    renderStream();
    await waitFor(() => expect(callsTo(fetch, STREAM)).toBe(1));
    await waitFor(() => expect(state()).toBe('retrying'));
  });

  it('on 401 ends the session and stops', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [STREAM]: { status: 401 } });
    renderStream();
    // The app's own handler signs the user out, which takes the page (and so the hook) away.
    await waitFor(() => expect(callsTo(fetch, STREAM)).toBe(1));
    await waitFor(() => expect(screen.queryByLabelText('State')).toBeNull());
    await advance(120_000);
    expect(callsTo(fetch, STREAM)).toBe(1);
  });

  it.each([403, 404])('on %i stops retrying and reports failed', async (status) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = mockFetch({ ...meAs(AGENT_IN_BRAND), [STREAM]: { status } });
    renderStream();
    await waitFor(() => expect(state()).toBe('failed'));
    await advance(120_000);
    expect(callsTo(fetch, STREAM)).toBe(1);
    expect(onReconnect).not.toHaveBeenCalled();
  });
});
