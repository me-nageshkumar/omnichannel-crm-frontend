import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../../test/renderApp';
import { callsTo, mockFetch } from '../../../../test/fetchMock';
import { storeSession } from '../../../../test/session';
import { reportPath, reportRoutes } from '../../../../test/crmReports';
import {
  sampleByOwner,
  sampleCampaignsReport,
  sampleLifecycleFunnel,
  samplePipelineSummary,
  sampleStageDuration,
} from '../../../../test/crm';
import { formatMoney } from '@app/Crm/common/money';

const inr = (n: number) => formatMoney(n, null, 'INR');

/** The card whose Chart/Table toggle is named after {@code title}. */
const card = (title: string) =>
  screen.getByRole('group', { name: `View of ${title}` }).closest('.crm-report-card') as HTMLElement;
const labelsIn = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('text.crm-chart__label')).map((t) => t.textContent);
const tile = (label: string) => screen.getByText(label).closest('.crm-stat') as HTMLElement;

describe('CRM report overview', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: 'Asia/Kolkata' };
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('kpiRowShowsMoneyAndRate', async () => {
    mockFetch(reportRoutes());
    renderApp('/crm/reports');
    await screen.findByText('Open pipeline');
    expect(tile('Open pipeline')).toHaveTextContent(inr(200000));
    expect(tile('Open pipeline')).toHaveTextContent('6 deals');
    expect(tile('Won in period')).toHaveTextContent(inr(150000));
    expect(tile('Won in period')).toHaveTextContent('3 deals');
    expect(tile('Win rate')).toHaveTextContent('75%');
    expect(tile('Average won deal')).toHaveTextContent(inr(50000));
    cleanup();

    mockFetch(
      reportRoutes({
        [reportPath('pipeline-summary')]: {
          status: 200,
          body: samplePipelineSummary({ won: { count: 0, amount: 0 }, winRate: null, averageWonAmount: null }),
        },
      }),
    );
    renderApp('/crm/reports');
    await screen.findByText('Open pipeline');
    expect(tile('Win rate')).toHaveTextContent('—');
    expect(tile('Average won deal')).toHaveTextContent('—');
    expect(tile('Won in period')).toHaveTextContent('0 deals');
  });

  it('pipelineByStageKeepsLaneOrder', async () => {
    mockFetch(
      reportRoutes({
        [reportPath('pipeline-summary')]: {
          status: 200,
          body: samplePipelineSummary({
            stages: [
              { stageId: 's1', name: 'New', type: 'OPEN', openCount: 2, openAmount: 50000, weightedAmount: 5000 },
              {
                stageId: 's2',
                name: 'Proposal',
                type: 'OPEN',
                openCount: 4,
                openAmount: 150000,
                weightedAmount: 75000,
              },
              { stageId: 's3', name: 'Won', type: 'WON', openCount: 0, openAmount: 0, weightedAmount: 0 },
            ],
          }),
        },
      }),
    );
    const { user } = renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of Pipeline by stage' });
    await waitFor(() => expect(labelsIn(card('Pipeline by stage'))).toEqual(['New', 'Proposal', 'Won']));
    expect(within(card('Pipeline by stage')).getByRole('img', { name: /^Pipeline by stage, / })).toBeInTheDocument();
    await user.click(within(card('Pipeline by stage')).getByRole('button', { name: 'Table' }));
    const table = within(card('Pipeline by stage')).getByRole('grid', { name: 'Pipeline by stage' });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('New');
    expect(rows[1]).toHaveTextContent(inr(50000));
    expect(rows[1]).toHaveTextContent(inr(5000));
    expect(rows[2]).toHaveTextContent('Proposal');
  });

  it('dealsOverTimeHasThreeSeriesAndLegend', async () => {
    mockFetch(reportRoutes());
    renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of Deals over time' });
    const el = card('Deals over time');
    await waitFor(() => expect(el.querySelectorAll('path.crm-chart__line')).toHaveLength(3));
    const legend = el.querySelector('.crm-chart__legend') as HTMLElement;
    expect(within(legend).getByText('Created')).toBeInTheDocument();
    expect(within(legend).getByText('Won')).toBeInTheDocument();
    expect(within(legend).getByText('Lost')).toBeInTheDocument();
    expect(el).toHaveTextContent('by week');
  });

  it('byOwnerTableMatchesRows', async () => {
    mockFetch(reportRoutes());
    const { user } = renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of By owner' });
    await waitFor(() => expect(labelsIn(card('By owner'))).toEqual(['Meera Manager', 'Ravi Kumar']));
    await user.click(within(card('By owner')).getByRole('button', { name: 'Table' }));
    const table = within(card('By owner')).getByRole('grid', { name: 'By owner' });
    const header = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(header).toEqual(['Owner', 'Open', 'Open amount', 'Won', 'Won amount', 'Lost', 'Win rate']);
    const cells = within(within(table).getAllByRole('row')[1])
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells).toEqual(['Meera Manager', '3', inr(100000), '2', inr(90000), '1', '67%']);
  });

  it('bySourceShowsContactOrigins', async () => {
    mockFetch(reportRoutes());
    renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of By source' });
    const el = card('By source');
    await waitFor(() => expect(labelsIn(el)).toEqual(['Inbound chat', 'Manual']));
    const origins = within(el).getByRole('grid', { name: 'Contacts by origin' });
    const rows = within(origins).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Inbound chat');
    expect(rows[1]).toHaveTextContent('12');
    expect(rows[2]).toHaveTextContent('Added by hand');
    expect(rows[2]).toHaveTextContent('3');
  });

  it('lifecycleFunnelSaysSnapshot', async () => {
    mockFetch(
      reportRoutes({
        [reportPath('lifecycle-funnel')]: {
          status: 200,
          body: sampleLifecycleFunnel({
            rows: [
              { key: 'lead', label: 'Lead', active: true, count: 5 },
              { key: 'customer', label: 'Customer', active: true, count: 20 },
              { key: 'churned', label: 'Churned', active: false, count: 1 },
            ],
            total: 26,
          }),
        },
      }),
    );
    renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of Lifecycle funnel' });
    const el = card('Lifecycle funnel');
    await waitFor(() => expect(labelsIn(el)).toEqual(['Lead', 'Customer', 'Churned (inactive)']));
    expect(el).toHaveTextContent('Snapshot of contacts now; the date range does not apply.');
  });

  it('stageDurationSaysSince', async () => {
    mockFetch(reportRoutes());
    renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of Stage duration' });
    const el = card('Stage duration');
    await waitFor(() => expect(labelsIn(el)).toEqual(['New', 'Proposal']));
    expect(el).toHaveTextContent('Based on moves since 1 Aug 2026');
    cleanup();

    mockFetch(
      reportRoutes({
        [reportPath('stage-duration')]: { status: 200, body: sampleStageDuration({ since: null }) },
      }),
    );
    renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of Stage duration' });
    await waitFor(() => expect(card('Stage duration')).toHaveTextContent('No moves recorded yet.'));
  });

  it('campaignsCardShowsTheSegmentColumn', async () => {
    const report = sampleCampaignsReport();
    report.rows[0] = { ...report.rows[0], segmentId: 'seg-1', segmentName: 'Gold tier' };
    report.rows.push({ ...report.rows[0], campaignId: 'c2', name: 'Plain blast', segmentId: null, segmentName: null });
    mockFetch(reportRoutes({ [reportPath('campaigns')]: { status: 200, body: report } }));
    renderApp('/crm/reports');
    const table = await screen.findByRole('grid', { name: 'Campaigns' });
    const header = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(header.indexOf('Segment')).toBe(header.indexOf('Campaign') + 1);
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Gold tier');
    expect(within(rows[2]).getAllByRole('cell')[1]).toHaveTextContent('—');
  });

  it('campaignsRowShowsDeliveryFigures', async () => {
    mockFetch(
      reportRoutes({
        [reportPath('campaigns')]: { status: 200, body: sampleCampaignsReport({ truncated: true }) },
      }),
    );
    renderApp('/crm/reports');
    const table = await screen.findByRole('grid', { name: 'Campaigns' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Diwali sale');
    expect(row).toHaveTextContent('20 Oct 2026');
    expect(row).toHaveTextContent('Sales line');
    expect(row).toHaveTextContent('200');
    expect(within(row).getByRole('img', { name: 'Delivery of Diwali sale' })).toBeInTheDocument();
    expect(row).toHaveTextContent('198 sent');
    expect(row).toHaveTextContent('190 delivered');
    expect(row).toHaveTextContent('120 read');
    expect(row).toHaveTextContent('2 failed');
    expect(row).toHaveTextContent('40');
    expect(screen.getByText('Showing the latest 200')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'View of Campaigns' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'View of Activity by person' })).toBeNull();
    const activity = screen.getByRole('grid', { name: 'Activity by person' });
    expect(within(activity).getAllByRole('row')[1]).toHaveTextContent('Meera Manager');
  });

  it('otherCurrencyNoteShown', async () => {
    mockFetch(
      reportRoutes({
        [reportPath('by-owner')]: { status: 200, body: sampleByOwner({ otherCurrencyDeals: 2 }) },
      }),
    );
    renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of By owner' });
    await waitFor(() => expect(card('By owner')).toHaveTextContent('+ 2 deals in other currencies'));
    expect(card('By number')).not.toHaveTextContent('other currenc');
  });

  it('oneFailingCardDoesNotBlankTheOthers', async () => {
    let calls = 0;
    const f = mockFetch(
      reportRoutes({
        [reportPath('by-owner')]: () =>
          ++calls === 1
            ? { status: 500, body: { code: 'INTERNAL', message: 'Something went wrong.' } }
            : { status: 200, body: sampleByOwner() },
      }),
    );
    const { user } = renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of By owner' });
    const retry = await within(card('By owner')).findByRole('button', { name: 'Retry' });
    expect(card('By owner')).toHaveTextContent('Something went wrong.');
    await waitFor(() => expect(labelsIn(card('Pipeline by stage'))).toHaveLength(3));
    await user.click(retry);
    await waitFor(() => expect(callsTo(f, reportPath('by-owner'))).toBe(2));
    await waitFor(() => expect(labelsIn(card('By owner'))).toEqual(['Meera Manager', 'Ravi Kumar']));
  });

  it('fastFilterChangeShowsLatestOnly', async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let n = 0;
    mockFetch(
      reportRoutes({
        [reportPath('pipeline-summary')]: () => {
          if (++n > 1) return { status: 200, body: samplePipelineSummary({ openAmount: 222222 }) };
          const stream = new ReadableStream({
            start(c) {
              held.then(() => {
                c.enqueue(new TextEncoder().encode(JSON.stringify(samplePipelineSummary({ openAmount: 111111 }))));
                c.close();
              });
            },
          });
          return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/json' } });
        },
      }),
    );
    const { user } = renderApp('/crm/reports');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Range' }), 'last7');
    await waitFor(() => expect(tile('Open pipeline')).toHaveTextContent(inr(222222)));
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(tile('Open pipeline')).toHaveTextContent(inr(222222));
    expect(screen.queryByText(inr(111111))).toBeNull();
  });

  it('refreshKeepsTheFiguresOnScreen', async () => {
    // The second answer is held back, so the page is caught mid-refresh.
    let n = 0;
    const f = mockFetch(
      reportRoutes({
        [reportPath('pipeline-summary')]: () => {
          if (++n === 1) return { status: 200, body: samplePipelineSummary() };
          const stream = new ReadableStream({ start() {} });
          return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/json' } });
        },
      }),
    );
    const { user } = renderApp('/crm/reports');
    await screen.findByText('Open pipeline');
    await waitFor(() => expect(tile('Open pipeline')).toHaveTextContent(inr(200000)));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(callsTo(f, reportPath('pipeline-summary'))).toBe(2));
    // The old figures stay while the new ones load: no spinner replaces them.
    expect(tile('Open pipeline')).toHaveTextContent(inr(200000));
    expect(screen.queryByLabelText('Loading summary')).toBeNull();
  });

  it('toggleHasAccessibleName', async () => {
    mockFetch(reportRoutes());
    renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of By owner' });
    const groups = screen.getAllByRole('group', { name: /^View of / });
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
      'View of Pipeline by stage',
      'View of Deals over time',
      'View of By owner',
      'View of By source',
      'View of By number',
      'View of Lifecycle funnel',
      'View of Stage duration',
    ]);
  });

  it('tableViewIsRememberedPerCard', async () => {
    mockFetch(reportRoutes());
    const { user } = renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of By owner' });
    await user.click(within(card('By owner')).getByRole('button', { name: 'Table' }));
    expect(localStorage.getItem('crm.reports.view.by-owner')).toBe('table');
    cleanup();

    mockFetch(reportRoutes());
    renderApp('/crm/reports');
    await screen.findByRole('group', { name: 'View of By owner' });
    expect(within(card('By owner')).getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card('By number')).getByRole('button', { name: 'Chart' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(within(card('By owner')).getByRole('grid', { name: 'By owner' })).toBeInTheDocument());
  });
});
