import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { sampleBoard, sampleDeal } from '../../../test/crm';
import { storeSession } from '../../../test/session';
import { BASE, boardRoutes, queryOf } from '../../../test/crmBoard';

const Probe: React.FunctionComponent = () => {
  const l = useLocation();
  return <output aria-label="Where">{l.pathname + l.search}</output>;
};

const lane = (name: string) => screen.getByRole('region', { name });
const board = () => screen.findByRole('region', { name: 'Deals board' });

describe('Pipelines page', () => {
  const originalMatchMedia = window.matchMedia;
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  it('boardLoadsDefaultPipeline', async () => {
    const f = mockFetch(boardRoutes());
    renderApp('/crm');
    await board();
    expect(await screen.findByText('Acme order')).toBeInTheDocument();
    expect(within(lane('New')).getByText('Globex renewal')).toBeInTheDocument();
    expect(within(lane('Proposal')).getByText('Initech rollout')).toBeInTheDocument();
    const q = queryOf(f, `${BASE}/deals/board`);
    expect(q.get('pipelineId')).toBe('p1');
    expect(q.get('perStageLimit')).toBe('25');
    expect(within(lane('New')).getByText('₹2,500')).toBeInTheDocument();
    expect(within(lane('Proposal')).getByText('Over the WIP limit of 5')).toBeInTheDocument();
    expect(within(lane('New')).queryByText(/Over the WIP limit/)).toBeNull();
    expect(screen.getByRole('button', { name: 'New contact' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New deal' })).toBeInTheDocument();
  });

  it('switchingPipelineUpdatesUrlAndStorage', async () => {
    const f = mockFetch(boardRoutes());
    const { user } = renderApp('/crm', <Probe />);
    await board();
    await user.selectOptions(screen.getByLabelText('Pipeline'), 'Support');
    await waitFor(() => expect(queryOf(f, `${BASE}/deals/board`).get('pipelineId')).toBe('p2'));
    expect(screen.getByLabelText('Where')).toHaveTextContent('pipelineId=p2');
    expect(localStorage.getItem('crm.pipeline.u4.w1')).toBe('p2');
  });

  it('rememberedPipelineIsUsedWhenUrlHasNone', async () => {
    localStorage.setItem('crm.pipeline.u4.w1', 'p2');
    const f = mockFetch(boardRoutes());
    renderApp('/crm');
    await board();
    await waitFor(() => expect(queryOf(f, `${BASE}/deals/board`).get('pipelineId')).toBe('p2'));
  });

  it('tableViewSearchesDeals', async () => {
    const f = mockFetch(boardRoutes());
    const { user } = renderApp('/crm?view=table');
    expect(await screen.findByRole('link', { name: 'Acme order' })).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Title', 'Contact', 'Stage', 'Amount', 'Owner', 'Expected close', 'Last activity']);
    const row = screen.getByRole('row', { name: /Acme order/ });
    expect(within(row).getByText('Priya Shah')).toBeInTheDocument();
    expect(within(row).getByText('New')).toBeInTheDocument();
    expect(requestTo(f, `POST ${BASE}/deals/search`)?.body).toMatchObject({
      pipelineId: 'p1',
      sort: 'lastActivityAt,desc',
      page: 0,
    });
    await user.click(within(screen.getByRole('columnheader', { name: 'Amount' })).getByRole('button'));
    await waitFor(() =>
      expect(requestTo(f, `POST ${BASE}/deals/search`, 1)?.body).toMatchObject({ sort: 'amount,asc' }),
    );
    await user.type(screen.getByRole('textbox', { name: 'Search deals' }), 'acme');
    await waitFor(() => expect(f.mock.calls.length).toBeGreaterThan(0));
    await waitFor(
      () => {
        const n = callsTo(f, `POST ${BASE}/deals/search`);
        expect(requestTo(f, `POST ${BASE}/deals/search`, n - 1)?.body).toMatchObject({ q: 'acme' });
      },
      { timeout: 2000 },
    );
  });

  it('agentWithoutPipelinesSeesEmptyState', async () => {
    mockFetch(boardRoutes({ [`GET ${BASE}/pipelines`]: { status: 200, body: [] } }));
    renderApp('/crm');
    expect(await screen.findByText('No pipeline assigned to you. Ask your admin.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New contact' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New deal' })).toBeNull();
  });

  it('agentWithNoPipelineAccessSeesEmptyState', async () => {
    mockFetch(boardRoutes({}, { pipelineAccess: [] }));
    renderApp('/crm');
    expect(await screen.findByText('No pipeline assigned to you. Ask your admin.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New contact' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New deal' })).toBeNull();
    expect(screen.queryByLabelText('Pipeline')).toBeNull();
  });

  it('emptyPipelineSaysSo', async () => {
    const empty = sampleBoard();
    empty.lanes = empty.lanes.map((l) => ({ ...l, total: 0, sumAmount: 0, deals: [] }));
    mockFetch(boardRoutes({ [`GET ${BASE}/deals/board`]: { status: 200, body: empty } }));
    renderApp('/crm');
    expect(await screen.findByText('No deals in this pipeline yet')).toBeInTheDocument();
  });

  it('newDealHiddenForRestrictedAgent', async () => {
    mockFetch(boardRoutes({}, { pipelineAccess: ['p1'] }));
    renderApp('/crm');
    await board();
    expect(screen.getByRole('button', { name: 'New contact' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New deal' })).toBeNull();
    expect(screen.queryByLabelText('Pipeline')).not.toBeNull();
    expect(within(screen.getByLabelText('Pipeline')).queryByText('Support')).toBeNull();
  });

  it('newButtonsNeedEditAuthority', async () => {
    mockFetch(boardRoutes({}, { authorities: ['crm:view'] }));
    renderApp('/crm');
    await board();
    expect(screen.queryByRole('button', { name: 'New contact' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New deal' })).toBeNull();
  });

  function narrow() {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }
  const moveFirstCardToProposal = async (user: ReturnType<typeof renderApp>['user']) => {
    await screen.findByText('Acme order');
    await user.selectOptions(within(lane('New')).getAllByLabelText(/^Move .* to…$/)[0], 'Proposal');
  };

  it('moveSendsNeighboursAndKeepsCard', async () => {
    narrow();
    const f = mockFetch(
      boardRoutes({
        [`POST ${BASE}/deals/d1/move`]: { status: 200, body: sampleDeal({ stageId: 's2', position: 2000, version: 3 }) },
      }),
    );
    const { user } = renderApp('/crm');
    await moveFirstCardToProposal(user);
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/deals/d1/move`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/deals/d1/move`)?.body).toEqual({ stageId: 's2', beforeDealId: 'd3' });
    await waitFor(() => expect(within(lane('Proposal')).getByText('Acme order')).toBeInTheDocument());
    expect(within(lane('New')).queryByText('Acme order')).toBeNull();
    // The board is unlocked again once the saved move has been settled.
    await waitFor(() => {
      const selects = screen.getAllByLabelText(/^Move .* to…$/);
      expect(selects.length).toBeGreaterThan(0);
      selects.forEach((el) => expect(el).toBeEnabled());
    });
  });

  it('loadMoreAfterAMoveFetchesByWhatIsLoaded', async () => {
    narrow();
    const [s1, s2, s3] = sampleBoard().lanes.map((l) => l.stage);
    const deal = (n: number) => sampleDeal({ id: `n${n}`, title: `Deal n${n}`, position: n * 1000 });
    const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => deal(a + i));
    const big = sampleBoard({
      lanes: [
        { stage: s1, total: 30, sumAmount: 0, deals: range(1, 25) },
        { stage: s2, total: 0, sumAmount: 0, deals: [] },
        { stage: s3, total: 0, sumAmount: 0, deals: [] },
      ],
    });
    const f = mockFetch(
      boardRoutes({
        [`GET ${BASE}/deals/board`]: { status: 200, body: big },
        [`POST ${BASE}/deals/n1/move`]: { status: 200, body: { ...deal(1), stageId: 's2' } },
        // The server's New lane after n1 left: n2..n30.
        [`POST ${BASE}/deals/search`]: ({ body }: { body: { page: number } }) => ({
          status: 200,
          body: { items: body.page === 0 ? range(2, 26) : range(27, 30), total: 29, page: body.page },
        }),
      }),
    );
    const { user } = renderApp('/crm');
    await screen.findByText('Deal n1');
    await user.selectOptions(within(lane('New')).getAllByLabelText(/^Move .* to…$/)[0], 'Proposal');
    await waitFor(() => expect(within(lane('Proposal')).getByText('Deal n1')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByLabelText(/^Move .* to…$/)[0]).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Load more in New' }));
    expect(await within(lane('New')).findByText('Deal n26')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more in New' }));
    expect(await within(lane('New')).findByText('Deal n30')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more in New' })).toBeNull();
    expect(requestTo(f, `POST ${BASE}/deals/search`, 0)?.body).toMatchObject({ stageId: 's1', page: 0 });
    expect(requestTo(f, `POST ${BASE}/deals/search`, 1)?.body).toMatchObject({ stageId: 's1', page: 1 });
  });

  it('moveErrorShowsAlert', async () => {
    narrow();
    const f = mockFetch(
      boardRoutes({ [`POST ${BASE}/deals/d1/move`]: { status: 404, body: { code: 'NOT_FOUND' } } }),
    );
    const { user } = renderApp('/crm');
    await moveFirstCardToProposal(user);
    expect(await screen.findByText('This deal is no longer in a pipeline you can see.')).toBeInTheDocument();
    await waitFor(() => expect(within(lane('New')).getByText('Acme order')).toBeInTheDocument());
    expect(within(lane('Proposal')).queryByText('Acme order')).toBeNull();
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(2));
  });

  it('versionConflictShowsRefreshHint', async () => {
    narrow();
    mockFetch(
      boardRoutes({ [`POST ${BASE}/deals/d1/move`]: { status: 409, body: { code: 'VERSION_CONFLICT' } } }),
    );
    const { user } = renderApp('/crm');
    await moveFirstCardToProposal(user);
    expect(
      await screen.findByText('Someone else moved this deal. Refresh to see the board.'),
    ).toBeInTheDocument();
  });

  it('otherMoveErrorsShowTheServerMessage', async () => {
    narrow();
    mockFetch(
      boardRoutes({
        [`POST ${BASE}/deals/d1/move`]: { status: 400, body: { code: 'STAGE_CLOSED', message: 'That stage is closed.' } },
      }),
    );
    const { user } = renderApp('/crm');
    await moveFirstCardToProposal(user);
    expect(await screen.findByText('That stage is closed.')).toBeInTheDocument();
  });

  it('loadMoreAppendsNextPage', async () => {
    const f = mockFetch(
      boardRoutes({
        [`POST ${BASE}/deals/search`]: {
          status: 200,
          body: { items: [sampleDeal({ id: 'd9', title: 'Hooli deal', stageId: 's2' })], total: 6, page: 1 },
        },
      }),
    );
    const { user } = renderApp('/crm');
    await screen.findByText('Initech rollout');
    await user.click(screen.getByRole('button', { name: 'Load more in Proposal' }));
    expect(await screen.findByText('Hooli deal')).toBeInTheDocument();
    expect(requestTo(f, `POST ${BASE}/deals/search`)?.body).toMatchObject({
      pipelineId: 'p1',
      stageId: 's2',
      sort: 'position,asc',
      // One card loaded: still inside the first page (the next page starts at 25 loaded).
      page: 0,
    });
  });

  it('refreshButtonReloadsBoard', async () => {
    const f = mockFetch(boardRoutes());
    const { user } = renderApp('/crm');
    await screen.findByText('Acme order');
    expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(2));
  });

  it('focusRefetchesAtMostEveryFiveSeconds', async () => {
    const t0 = Date.now();
    vi.useFakeTimers({ toFake: ['Date'], now: t0 });
    const f = mockFetch(boardRoutes());
    renderApp('/crm');
    await screen.findByText('Acme order');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    const focus = () => act(() => void document.dispatchEvent(new Event('visibilitychange')));
    focus();
    expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(1);
    vi.setSystemTime(t0 + 6000);
    focus();
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(2));
    vi.setSystemTime(t0 + 8000);
    focus();
    expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(2);
    vi.setSystemTime(t0 + 12000);
    focus();
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(3));
  });

  it('rottingAndOverdueLabelsShow', async () => {
    mockFetch(boardRoutes());
    renderApp('/crm');
    await screen.findByText('Acme order');
    expect(within(lane('Proposal')).getByText('Rotting')).toBeInTheDocument();
    expect(within(lane('New')).getByText('Overdue')).toBeInTheDocument();
    expect(within(lane('New')).queryByText('Rotting')).toBeNull();
  });

  it('cardClickOpensDealRoute', async () => {
    mockFetch(boardRoutes());
    const { user } = renderApp('/crm', <Probe />);
    await user.click(await screen.findByText('Acme order'));
    expect(screen.getByLabelText('Where')).toHaveTextContent('/crm/deals/d1?pipelineId=p1');
    expect(await board()).toBeInTheDocument();
  });

  it('channelChipOnlyWithSeveralNumbers', async () => {
    const phones = [
      { phoneNumberId: 'pn1', number: '919800000001', label: 'Sales line', canChat: true },
      { phoneNumberId: 'pn2', number: '919800000002', label: null, canChat: true },
    ];
    mockFetch(boardRoutes({}, { phones }));
    renderApp('/crm');
    await screen.findByText('Acme order');
    expect(within(lane('New')).getAllByText('Sales line').length).toBeGreaterThan(0);
  });

  it('noChannelChipWithOneNumber', async () => {
    const phones = [{ phoneNumberId: 'pn1', number: '919800000001', label: 'Sales line', canChat: true }];
    mockFetch(boardRoutes({}, { phones }));
    renderApp('/crm');
    await screen.findByText('Acme order');
    expect(within(lane('New')).queryByText('Sales line')).toBeNull();
  });

  const where = () => screen.getByLabelText('Where').textContent ?? '';
  const searchOf = () => new URLSearchParams(where().split('?')[1] ?? '');

  it('openingAndClosingADealFromTheBoardKeepsViewAndFilters', async () => {
    mockFetch(boardRoutes());
    const { user } = renderApp('/crm?owner=u1&q=acme', <Probe />);
    await user.click(await screen.findByText('Acme order'));
    expect(where()).toMatch(/^\/crm\/deals\/d1\?/);
    expect(Object.fromEntries(searchOf())).toEqual({ owner: 'u1', q: 'acme', pipelineId: 'p1' });
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(where()).toMatch(/^\/crm\?/));
    expect(Object.fromEntries(searchOf())).toEqual({ owner: 'u1', q: 'acme', pipelineId: 'p1' });
  });

  it('openingAndClosingADealFromTheTableKeepsViewAndFilters', async () => {
    mockFetch(boardRoutes());
    const { user } = renderApp('/crm?view=table&owner=u1&q=acme', <Probe />);
    await user.click(await screen.findByRole('link', { name: 'Acme order' }));
    expect(where()).toMatch(/^\/crm\/deals\/d1\?/);
    expect(Object.fromEntries(searchOf())).toEqual({ view: 'table', owner: 'u1', q: 'acme', pipelineId: 'p1' });
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(where()).toMatch(/^\/crm\?/));
    expect(Object.fromEntries(searchOf())).toEqual({ view: 'table', owner: 'u1', q: 'acme', pipelineId: 'p1' });
  });

  it('searchBoxFollowsTheUrl', async () => {
    mockFetch(boardRoutes());
    let go: (to: string) => void = () => undefined;
    const Nav = (): null => {
      go = useNavigate();
      return null;
    };
    renderApp('/crm?q=acme', <Nav />);
    const box = await screen.findByLabelText('Search deals');
    expect(box).toHaveValue('acme');
    act(() => go('/crm?q=globex'));
    await waitFor(() => expect(box).toHaveValue('globex'));
    act(() => go('/crm'));
    await waitFor(() => expect(box).toHaveValue(''));
  });
});
