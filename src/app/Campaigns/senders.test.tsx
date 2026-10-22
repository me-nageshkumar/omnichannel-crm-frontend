import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { mockFetch, requestTo } from '../../test/fetchMock';
import { TEAM_LEAD, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { rowAction, rowWith } from '../../test/admin';
import { sender } from '../../test/campaigns';
import type { SenderView } from '@app/api/campaigns';

const S = 'GET /api/workspaces/w1/campaigns/senders';
const PUT = 'PUT /api/workspaces/w1/campaigns/senders/p1';
const future = () => new Date(Date.now() + 3_600_000).toISOString();

function routes(items: SenderView[], extra = {}, user = WORKSPACE_MANAGER) {
  return { ...meAs(user), [S]: { status: 200, body: items }, ...extra };
}

const WARMING = sender({
  state: 'WARMING',
  label: 'Main',
  ageDay: 3,
  capToday: 5,
  usedToday: 2,
  runsOn: 'Office PC, profile 3',
});

describe('senders', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsSendersWithStateAndCapacity', async () => {
    mockFetch(routes([WARMING]));
    renderApp('/campaigns/senders');
    const row = await rowWith('+919800000001');
    for (const text of ['Main', 'Connected', 'Warming', 'Day 3', '5', '2', 'Office PC, profile 3']) {
      expect(within(row).getByText(text)).toBeVisible();
    }
    expect(screen.getByRole('link', { name: 'Back to campaigns' })).toHaveAttribute('href', '/campaigns');
  });

  it('restingShowsRestsUntil', async () => {
    mockFetch(routes([sender({ state: 'RESTING', restUntil: '2026-10-28T10:00:00Z' })]));
    renderApp('/campaigns/senders');
    const row = await rowWith('+919800000001');
    expect(within(row).getByText(/rests until/)).toBeVisible();
  });

  it('showsPauseReasons', async () => {
    mockFetch(routes([sender({ pausedUntil: future(), pauseReason: 'UNDELIVERED_RUN', lowReplyRate: true })]));
    renderApp('/campaigns/senders');
    const row = await rowWith('+919800000001');
    expect(within(row).getByText('Paused: last messages not delivered · Low reply rate, cap halved')).toBeVisible();
  });

  it('actionsFollowTheState', async () => {
    const items = [
      sender({ phoneNumberId: 'a', number: '919800000011', state: 'WARMING' }),
      sender({ phoneNumberId: 'b', number: '919800000012', state: 'RETIRED' }),
      sender({ phoneNumberId: 'c', number: '919800000013', state: 'WARMING', pausedUntil: future() }),
    ];
    mockFetch(routes(items));
    const { user } = renderApp('/campaigns/senders');
    const expected: Array<[string, string[]]> = [
      ['+919800000011', ['Rest', 'Retire']],
      ['+919800000012', ['Reactivate']],
      ['+919800000013', ['Rest', 'Retire', 'Resume pause']],
    ];
    for (const [number, actions] of expected) {
      const row = await rowWith(number);
      await user.click(within(row).getByRole('button', { name: 'Kebab toggle' }));
      const menu = await screen.findAllByRole('menuitem');
      expect(menu.map((m) => m.textContent)).toEqual(actions);
      await user.keyboard('{Escape}');
    }
  });

  it('restSendsTheActionAndUpdatesTheRow', async () => {
    const fetch = mockFetch(
      routes([WARMING], { [PUT]: { status: 200, body: { ...WARMING, state: 'RESTING', restUntil: null } } }),
    );
    const { user } = renderApp('/campaigns/senders');
    await rowAction(user, '+919800000001', 'Rest');
    await vi.waitFor(() => expect(requestTo(fetch, PUT)?.body).toEqual({ action: 'REST' }));
    expect(await within(await rowWith('+919800000001')).findByText('Resting')).toBeVisible();
  });

  it('retireConfirmsFirst', async () => {
    const fetch = mockFetch(
      routes([WARMING], { [PUT]: { status: 200, body: { ...WARMING, state: 'RETIRED' } } }),
    );
    const { user } = renderApp('/campaigns/senders');
    await rowAction(user, '+919800000001', 'Retire');
    const d = await screen.findByRole('dialog', { name: /Retire this number\?/ });
    expect(within(d).getByText('It will send no campaign messages until reactivated.')).toBeVisible();
    expect(requestTo(fetch, PUT)).toBeUndefined();
    await user.click(within(d).getByRole('button', { name: 'Retire' }));
    await vi.waitFor(() => expect(requestTo(fetch, PUT)?.body).toEqual({ action: 'RETIRE' }));
    expect(await within(await rowWith('+919800000001')).findByText('Retired')).toBeVisible();
  });

  it('editsRunsOnInline', async () => {
    const fetch = mockFetch(
      routes([WARMING], { [PUT]: { status: 200, body: { ...WARMING, runsOn: 'Laptop, profile 1' } } }),
    );
    const { user } = renderApp('/campaigns/senders');
    const row = await rowWith('+919800000001');
    await user.click(within(row).getByRole('button', { name: 'Edit runs on' }));
    const input = within(row).getByRole('textbox', { name: 'Runs on' });
    await user.clear(input);
    await user.type(input, 'Laptop, profile 1{Enter}');
    await vi.waitFor(() => expect(requestTo(fetch, PUT)?.body).toEqual({ runsOn: 'Laptop, profile 1' }));
    expect(await within(await rowWith('+919800000001')).findByText('Laptop, profile 1')).toBeVisible();

    await user.click(within(await rowWith('+919800000001')).getByRole('button', { name: 'Edit runs on' }));
    await user.clear(screen.getByRole('textbox', { name: 'Runs on' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(requestTo(fetch, PUT, 1)?.body).toEqual({ runsOn: null }));
  });

  it('viewerSeesNoActions', async () => {
    mockFetch(routes([WARMING], {}, TEAM_LEAD));
    renderApp('/campaigns/senders');
    const row = await rowWith('+919800000001');
    expect(within(row).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Edit runs on' })).toBeNull();
  });
});
