import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { renderApp } from '../../test/renderApp';
import { MockResponse, MockRoute, callsTo, mockFetch } from '../../test/fetchMock';
import { gate } from '../../test/gate';
import { AGENT_IN_BRAND, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { rowWith, urlsOf } from '../../test/admin';
import { campaignDetail, recipient, sender } from '../../test/campaigns';
import type { CampaignDetail, RecipientView } from '@app/api/campaigns';
import { MESSAGES } from '@app/api/messages';
import { SYSTEM_PAUSE_TEXT } from '@app/Campaigns/CampaignsPage';

const B = '/api/workspaces/w1/campaigns';
const GET = `GET ${B}/c1`;
const REC = `GET ${B}/c1/recipients`;
const REFUSED_TEXT =
  'Sending was refused for this campaign, for example because a template was archived. Fix the campaign, then resume it.';

const RUNNING = campaignDetail({
  status: 'RUNNING',
  counts: { total: 10, pending: 4, sent: 3, delivered: 2, read: 1, replied: 1, skipped: 1, failed: 1 },
  estimate: { remaining: 120, perDay: 45, days: 3, finishBy: '2026-10-24' },
  senders: [sender({ state: 'WARMING', capToday: 5, usedToday: 2 })],
});
const PAUSED = campaignDetail({ ...RUNNING, status: 'PAUSED', pausedBy: 'USER' });
const withSent = (c: CampaignDetail, sent: number) => ({ ...c, counts: { ...c.counts, sent } });

/** Answers the n-th request with the n-th of {@code answers}; the last one repeats. */
function inTurn(...answers: Array<CampaignDetail | MockResponse>): MockRoute {
  let n = 0;
  return () => {
    const a = answers[Math.min(n++, answers.length - 1)];
    return 'id' in a ? { status: 200, body: a } : a;
  };
}

function routes(get: CampaignDetail | MockRoute, extra = {}, items: RecipientView[] = [], total = items.length) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [GET]: 'id' in get ? { status: 200, body: get } : get,
    [REC]: { status: 200, body: { items, total, page: 0 } },
    ...extra,
  };
}

const open = (path = '/campaigns/c1') => renderApp(path, undefined, { advanceTimers: vi.advanceTimersByTime });
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const countdown = (name: string) => screen.findByRole('progressbar', { name });

const lastUrl = (fetch: ReturnType<typeof mockFetch>) => urlsOf(fetch, REC).slice(-1)[0];

/** The count shown under {@code term}. */
function countOf(term: string): string | null | undefined {
  const dt = screen.getAllByRole('term').find((d) => d.textContent === term);
  return dt?.nextElementSibling?.textContent;
}

async function dangerAlert(text: string) {
  const alert = (await screen.findByText(text)).closest('.pf-v6-c-alert');
  expect(alert).toHaveClass('pf-m-danger');
}

describe('campaign detail', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('showsCountsEstimateAndSendersToday', async () => {
    mockFetch(routes(RUNNING));
    open();
    expect(await screen.findByRole('heading', { name: 'Diwali offer' })).toBeVisible();
    await screen.findByText('About 3 working days (by Sat 24 Oct)');
    expect(countOf('Sent')).toBe('3');
    expect(countOf('Failed')).toBe('1');
    expect(countOf('Total')).toBe('10');
    const row = await rowWith('+919800000001');
    for (const text of ['Warming', '5', '2', 'Connected']) expect(within(row).getByText(text)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to campaigns' })).toHaveAttribute('href', '/campaigns');
  });

  it('countdownDrainsAndRefetchesEveryFiveSeconds', async () => {
    const fetch = mockFetch(routes(RUNNING));
    const second = gate(fetch, GET, 2);
    open();
    expect(await countdown('Refreshing in 5 s')).toHaveAttribute('aria-valuenow', '100');
    await advance(1000);
    expect(screen.getByRole('progressbar', { name: 'Refreshing in 4 s' })).toHaveAttribute('aria-valuenow', '80');
    await advance(3000);
    expect(screen.getByRole('progressbar', { name: 'Refreshing in 1 s' })).toHaveAttribute('aria-valuenow', '20');
    await advance(1000);
    expect(screen.getByRole('progressbar', { name: 'Refreshing…' })).toHaveAttribute('aria-valuenow', '100');
    expect(callsTo(fetch, GET)).toBe(2);
    second.release();
    expect(await countdown('Refreshing in 5 s')).toHaveAttribute('aria-valuenow', '100');
    await waitFor(() => expect(callsTo(fetch, REC)).toBe(2));
  });

  it('backLinkKeepsFocusWhilePolling', async () => {
    mockFetch(routes(RUNNING));
    open();
    await countdown('Refreshing in 5 s');
    const back = screen.getByRole('link', { name: 'Back to campaigns' });
    act(() => back.focus());
    expect(document.activeElement).toBe(back);
    await advance(2000);
    expect(screen.getByRole('progressbar', { name: 'Refreshing in 3 s' })).toBeVisible();
    expect(document.activeElement).toBe(back);
  });

  it('fetchErrorKeepsNumbersAndKeepsCounting', async () => {
    const fetch = mockFetch(routes(inTurn(RUNNING, { status: 500 }, RUNNING)));
    open();
    await countdown('Refreshing in 5 s');
    await advance(5000);
    await dangerAlert(MESSAGES.generic);
    expect(countOf('Sent')).toBe('3');
    expect(screen.getByRole('progressbar', { name: 'Refreshing in 5 s' })).toBeVisible();
    await advance(5000);
    expect(callsTo(fetch, GET)).toBe(3);
  });

  it('stopsCountingWhenTheRunnerCompletesIt', async () => {
    const fetch = mockFetch(routes(inTurn(RUNNING, { ...RUNNING, status: 'COMPLETED' })));
    const { user } = open();
    await countdown('Refreshing in 5 s');
    await advance(5000);
    expect(await screen.findByText(/^Refreshed /)).toBeVisible();
    expect(screen.queryByRole('progressbar')).toBeNull();
    await advance(10_000);
    expect(callsTo(fetch, GET)).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(callsTo(fetch, GET)).toBe(3));
  });

  it('pausedCampaignDoesNotPoll', async () => {
    const fetch = mockFetch(routes(PAUSED));
    open();
    expect(await screen.findByText(/^Refreshed /)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
    expect(screen.queryByRole('progressbar')).toBeNull();
    await advance(10_000);
    expect(callsTo(fetch, GET)).toBe(1);
  });

  it('aStaleAnswerIsDropped', async () => {
    const fetch = mockFetch(routes(inTurn(withSent(PAUSED, 1), withSent(PAUSED, 3), withSent(PAUSED, 7))));
    const second = gate(fetch, GET, 2);
    const { user } = open();
    await screen.findByText(/^Refreshed /);
    expect(countOf('Sent')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(countOf('Sent')).toBe('7'));
    expect(callsTo(fetch, GET)).toBe(3);
    second.release();
    await advance(100);
    expect(countOf('Sent')).toBe('7');
  });

  it('stopsPollingOnUnmount', async () => {
    const fetch = mockFetch(routes(RUNNING));
    const { unmount } = open();
    await countdown('Refreshing in 5 s');
    unmount();
    await advance(20_000);
    expect(callsTo(fetch, GET)).toBe(1);
  });

  it('filtersAndPagesRecipients', async () => {
    const skipped = recipient({
      status: 'SKIPPED',
      skipReason: 'NOT_ON_WHATSAPP',
      senderId: 'p1',
      senderNumber: '919800000001',
    });
    const fetch = mockFetch(routes(PAUSED, {}, [skipped], 120));
    const { user } = open();
    await rowWith('+919800000002');
    expect(urlsOf(fetch, REC)[0]).toBe(`${B}/c1/recipients?page=0`);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Skipped');
    await waitFor(() => expect(lastUrl(fetch)).toBe(`${B}/c1/recipients?status=SKIPPED&page=0`));
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    await waitFor(() => expect(lastUrl(fetch)).toBe(`${B}/c1/recipients?status=SKIPPED&page=1`));
    const row = await rowWith('Not on WhatsApp');
    expect(within(row).getByText('+919800000001')).toBeVisible();
    expect(within(row).getByText('+919800000002')).toBeVisible();
  });

  it('actionsFollowTheStatus', async () => {
    const all = ['Start', 'Pause', 'Resume', 'Terminate', 'Delete'];
    const buttons = () => all.filter((name) => screen.queryByRole('button', { name }));
    const cases: Array<[CampaignDetail, string[], typeof WORKSPACE_MANAGER]> = [
      [campaignDetail({ status: 'DRAFT' }), ['Start', 'Delete'], WORKSPACE_MANAGER],
      [campaignDetail({ status: 'COMPLETED' }), [], WORKSPACE_MANAGER],
      [campaignDetail({ status: 'PAUSED' }), [], AGENT_IN_BRAND],
    ];
    for (const [c, expected, who] of cases) {
      mockFetch({ ...routes(c), ...meAs(who) });
      const view = open();
      await screen.findByText(/^Refreshed /);
      expect(buttons()).toEqual(expected);
      view.unmount();
    }

    const fetch = mockFetch(routes(RUNNING, { [`POST ${B}/c1/pause`]: { status: 200, body: PAUSED } }));
    const { user } = open();
    await countdown('Refreshing in 5 s');
    expect(buttons()).toEqual(['Pause', 'Terminate']);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(callsTo(fetch, GET)).toBe(2));
    expect(callsTo(fetch, `POST ${B}/c1/pause`)).toBe(1);
  });

  it('stateConflictNamesTheAction', async () => {
    mockFetch(routes(RUNNING, { [`POST ${B}/c1/pause`]: { status: 409, body: { code: 'CAMPAIGN_STATE' } } }));
    const { user } = open();
    await countdown('Refreshing in 5 s');
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await dangerAlert('This campaign cannot be paused now.');
  });

  it('systemPauseShowsTheBanner', async () => {
    mockFetch(routes(campaignDetail({ status: 'PAUSED', pausedBy: 'SYSTEM', pauseReason: 'TWO_LOGOUTS' })));
    const first = open();
    expect(await screen.findByText(SYSTEM_PAUSE_TEXT)).toBeVisible();
    first.unmount();

    mockFetch(routes(campaignDetail({ status: 'PAUSED', pausedBy: 'SYSTEM', pauseReason: 'SEND_REFUSED' })));
    open();
    expect(await screen.findByText(REFUSED_TEXT)).toBeVisible();
    expect(screen.queryByText(SYSTEM_PAUSE_TEXT)).toBeNull();
  });

  it('noBannerWhenTheUserPaused', async () => {
    mockFetch(routes(PAUSED));
    open();
    await screen.findByText(/^Refreshed /);
    expect(screen.queryByText(SYSTEM_PAUSE_TEXT)).toBeNull();
    expect(screen.queryByText(REFUSED_TEXT)).toBeNull();
  });

  it('deleteOpensTheList', async () => {
    const fetch = mockFetch(
      routes(campaignDetail({ status: 'DRAFT' }), {
        [`DELETE ${B}/c1`]: { status: 204 },
        [`GET ${B}`]: { status: 200, body: { items: [], total: 0, page: 0, systemPaused: false } },
      }),
    );
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: 'Campaigns' })).toBeVisible();
    expect(callsTo(fetch, `DELETE ${B}/c1`)).toBe(1);
  });

  it('showsTheStartErrorHandedOver', async () => {
    const Probe: React.FunctionComponent = () => {
      const navigate = useNavigate();
      return (
        <button onClick={() => navigate('/campaigns/c1', { state: { startError: 'Could not start it.' } })}>Go</button>
      );
    };
    mockFetch(routes(campaignDetail({ status: 'DRAFT' })));
    const { user } = renderApp('/', <Probe />, { advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Go' }));
    await dangerAlert('Could not start it.');
  });
});
