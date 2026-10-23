import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, BRAND_VIEWER, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { rowAction, rowWith, urlsOf } from '../../test/admin';
import { campaign } from '../../test/campaigns';
import type { CampaignPage, CampaignView } from '@app/api/campaigns';
import { SYSTEM_PAUSE_TEXT } from '@app/Campaigns/CampaignsPage';

const B = '/api/workspaces/w1/campaigns';
const SEND_REFUSED_TEXT = 'A campaign was paused by the system. Open it to see why, then resume it.';

const RUNNING = campaign({
  id: 'c1',
  name: 'Diwali leads',
  status: 'RUNNING',
  counts: { total: 10, pending: 5, sent: 3, delivered: 0, read: 0, replied: 1, skipped: 2, failed: 0 },
  startedAt: '2026-10-20T05:30:00Z',
});

function page(items: CampaignView[], over: Partial<CampaignPage> = {}): { status: number; body: CampaignPage } {
  return { status: 200, body: { items, total: items.length, page: 0, systemPaused: false, ...over } };
}

function routes(items: CampaignView[] = [RUNNING], extra = {}, user = WORKSPACE_MANAGER, over: Partial<CampaignPage> = {}) {
  return { ...meAs(user), [`GET ${B}`]: page(items, over), ...extra };
}

const dialog = () => screen.findByRole('dialog');

describe('campaigns list', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsCampaignsWithProgress', async () => {
    const fetch = mockFetch(routes());
    renderApp('/campaigns');
    const row = await rowWith('Diwali leads');
    expect(within(row).getByRole('link', { name: 'Diwali leads' })).toHaveAttribute('href', '/campaigns/c1');
    expect(within(row).getByText('Running')).toBeVisible();
    expect(within(row).getByText('3 / 10')).toBeVisible();
    expect(within(row).getByRole('progressbar', { name: 'Progress of Diwali leads' })).toBeVisible();
    expect(within(row).getByText('Saved filter: Delhi leads')).toBeVisible();
    const cells = within(row).getAllByRole('cell');
    expect(cells.map((c) => c.getAttribute('data-label'))).toContain('Replied');
    expect(within(row).getByText('1')).toBeVisible();
    expect(within(row).getByText('2')).toBeVisible();
    expect(urlsOf(fetch, `GET ${B}`)[0]).toBe(`${B}?page=0`);
  });

  it('describesACsvAudienceAndShowsEmptyState', async () => {
    const csv = campaign({
      id: 'c2',
      name: 'From sheet',
      audience: { ...campaign().audience, kind: 'CSV', filterId: null, filterName: null, csvFileName: 'leads.csv', csvRows: 40 },
    });
    mockFetch(routes([csv]));
    renderApp('/campaigns');
    expect(await screen.findByText('CSV: leads.csv (40 rows)')).toBeVisible();
  });

  it('showsEmptyText', async () => {
    mockFetch(routes([]));
    renderApp('/campaigns');
    expect(await screen.findByText('No campaigns yet.')).toBeVisible();
  });

  it('pagesThroughCampaigns', async () => {
    const fetch = mockFetch(routes([RUNNING], {}, WORKSPACE_MANAGER, { total: 120 }));
    const { user } = renderApp('/campaigns');
    await rowWith('Diwali leads');
    await user.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
    await vi.waitFor(() => expect(urlsOf(fetch, `GET ${B}`)[1]).toBe(`${B}?page=1`));
  });

  it('showsTheSystemPauseBanner', async () => {
    const paused = campaign({ id: 'c3', name: 'Paused one', status: 'PAUSED', pausedBy: 'SYSTEM', pauseReason: 'TWO_LOGOUTS' });
    mockFetch(routes([paused], {}, WORKSPACE_MANAGER, { systemPaused: true }));
    renderApp('/campaigns');
    expect(await screen.findByText(SYSTEM_PAUSE_TEXT)).toBeVisible();
  });

  it('namesTheGenericReasonWhenNoItemWasPausedByLogouts', async () => {
    const refused = campaign({ id: 'c3', name: 'Refused', status: 'PAUSED', pausedBy: 'SYSTEM', pauseReason: 'SEND_REFUSED' });
    mockFetch(routes([refused], {}, WORKSPACE_MANAGER, { systemPaused: true }));
    renderApp('/campaigns');
    expect(await screen.findByText(SEND_REFUSED_TEXT)).toBeVisible();
    expect(screen.queryByText(SYSTEM_PAUSE_TEXT)).toBeNull();
  });

  it('hasNoBannerWhenNothingIsPausedBySystem', async () => {
    mockFetch(routes());
    renderApp('/campaigns');
    await rowWith('Diwali leads');
    expect(screen.queryByText(SYSTEM_PAUSE_TEXT)).toBeNull();
    expect(screen.queryByText(SEND_REFUSED_TEXT)).toBeNull();
  });

  it('rowActionsFollowTheStatus', async () => {
    const items = [
      campaign({ id: 'd', name: 'A draft', status: 'DRAFT' }),
      campaign({ id: 'r', name: 'A running', status: 'RUNNING' }),
      campaign({ id: 'p', name: 'A paused', status: 'PAUSED' }),
      campaign({ id: 'x', name: 'A completed', status: 'COMPLETED' }),
    ];
    mockFetch(routes(items));
    const { user } = renderApp('/campaigns');
    const expected: Array<[string, string[]]> = [
      ['A draft', ['Start', 'Delete']],
      ['A running', ['Pause', 'Terminate']],
      ['A paused', ['Resume', 'Terminate']],
    ];
    for (const [name, actions] of expected) {
      const row = await rowWith(name);
      await user.click(within(row).getByRole('button', { name: 'Kebab toggle' }));
      const menu = await screen.findAllByRole('menuitem');
      expect(menu.map((m) => m.textContent)).toEqual(actions);
      await user.keyboard('{Escape}');
    }
    const done = await rowWith('A completed');
    expect(within(done).queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });

  it('startPostsAndReloads', async () => {
    const fetch = mockFetch(
      routes([campaign({ id: 'c1', name: 'Diwali leads', status: 'DRAFT' })], {
        [`POST ${B}/c1/start`]: { status: 200, body: RUNNING },
      }),
    );
    const { user } = renderApp('/campaigns');
    await rowAction(user, 'Diwali leads', 'Start');
    await vi.waitFor(() => expect(callsTo(fetch, `POST ${B}/c1/start`)).toBe(1));
    await vi.waitFor(() => expect(callsTo(fetch, `GET ${B}`)).toBe(2));
  });

  it('terminateConfirmsFirst', async () => {
    const fetch = mockFetch(routes([RUNNING], { [`POST ${B}/c1/terminate`]: { status: 200, body: RUNNING } }));
    const { user } = renderApp('/campaigns');
    await rowAction(user, 'Diwali leads', 'Terminate');
    const d = await dialog();
    expect(within(d).getByText('Terminate campaign?')).toBeVisible();
    expect(within(d).getByText('Pending messages of Diwali leads will not be sent. This cannot be undone.')).toBeVisible();
    await user.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(callsTo(fetch, `POST ${B}/c1/terminate`)).toBe(0);

    await rowAction(user, 'Diwali leads', 'Terminate');
    await user.click(within(await dialog()).getByRole('button', { name: 'Terminate' }));
    await vi.waitFor(() => expect(callsTo(fetch, `POST ${B}/c1/terminate`)).toBe(1));
  });

  it('deleteConfirmsFirst', async () => {
    const fetch = mockFetch(
      routes([campaign({ id: 'c1', name: 'Diwali leads', status: 'DRAFT' })], { [`DELETE ${B}/c1`]: { status: 204 } }),
    );
    const { user } = renderApp('/campaigns');
    await rowAction(user, 'Diwali leads', 'Delete');
    const d = await dialog();
    expect(within(d).getByText('Delete draft?')).toBeVisible();
    expect(within(d).getByText('Delete Diwali leads? This cannot be undone.')).toBeVisible();
    expect(callsTo(fetch, `DELETE ${B}/c1`)).toBe(0);
    await user.click(within(d).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(callsTo(fetch, `DELETE ${B}/c1`)).toBe(1));
    expect(requestTo(fetch, `DELETE ${B}/c1`)).toBeDefined();
  });

  it('actionConflictNamesTheAction', async () => {
    mockFetch(
      routes([campaign({ id: 'c1', name: 'Diwali leads', status: 'PAUSED' })], {
        [`POST ${B}/c1/resume`]: { status: 409, body: { code: 'CAMPAIGN_STATE' } },
      }),
    );
    const { user } = renderApp('/campaigns');
    await rowAction(user, 'Diwali leads', 'Resume');
    expect(await screen.findByText('This campaign cannot be resumed now.')).toBeVisible();
  });

  it('toolbarFollowsAuthorities', async () => {
    mockFetch(routes());
    const first = renderApp('/campaigns');
    await rowWith('Diwali leads');
    expect(screen.getByRole('link', { name: 'New campaign' })).toHaveAttribute('href', '/campaigns/new');
    expect(screen.getByRole('link', { name: 'Senders' })).toHaveAttribute('href', '/campaigns/senders');
    expect(screen.getByRole('link', { name: 'Campaign settings' })).toHaveAttribute('href', '/campaigns/settings');
    first.unmount();

    mockFetch(routes([RUNNING], {}, BRAND_VIEWER));
    const lead = renderApp('/campaigns');
    await rowWith('Diwali leads');
    expect(screen.getByRole('link', { name: 'New campaign' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Campaign settings' })).toBeNull();
    lead.unmount();

    mockFetch(routes([RUNNING], {}, AGENT_IN_BRAND));
    renderApp('/campaigns');
    await rowWith('Diwali leads');
    expect(screen.getByRole('link', { name: 'Senders' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'New campaign' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Campaign settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });
});
