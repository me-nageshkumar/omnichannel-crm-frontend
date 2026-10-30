import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { storeSession } from '../../../test/session';
import { OVERVIEW, REPORTS, reportPath, reportRoutes } from '../../../test/crmReports';

const DAY = 86_400_000;
const KOLKATA_OFFSET = 5.5 * 3_600_000;

/** Shows the router's current query string. */
const SearchProbe: React.FunctionComponent = () => <output aria-label="Search">{useLocation().search}</output>;

const lastBody = (f: ReturnType<typeof mockFetch>, name: (typeof REPORTS)[number]) =>
  requestTo(f, reportPath(name), callsTo(f, reportPath(name)) - 1)?.body;

describe('CRM reports page', () => {
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

  it('navShowsReportsWhenCrmOn', async () => {
    mockFetch(reportRoutes());
    renderApp('/crm');
    expect(await screen.findByRole('link', { name: 'Reports', hidden: true })).toHaveAttribute('href', '/crm/reports');
  });

  it('defaultsToLast90AndDefaultPipeline', async () => {
    const f = mockFetch(reportRoutes());
    renderApp('/crm/reports');
    await waitFor(() => OVERVIEW.forEach((r) => expect(callsTo(f, reportPath(r))).toBe(1)));
    for (const r of OVERVIEW) {
      const body = requestTo(f, reportPath(r))!.body;
      expect(body, r).toMatchObject({ tz: 'Asia/Kolkata', pipelineId: 'p1' });
      const from = Date.parse(body.from);
      const to = Date.parse(body.to);
      expect(to - from, r).toBe(90 * DAY);
      expect((to + KOLKATA_OFFSET) % DAY, r).toBe(0);
    }
    expect(callsTo(f, reportPath('grid'))).toBe(0);
    expect(screen.getByRole('combobox', { name: 'Range' })).toHaveValue('last90');
    expect(screen.getByRole('combobox', { name: 'Pipeline' })).toHaveValue('p1');
    expect(screen.getByRole('button', { name: 'Numbers' })).toHaveTextContent('All numbers');
  });

  it('filtersLiveInTheUrl', async () => {
    const f = mockFetch(reportRoutes());
    const { user } = renderApp('/crm/reports', <SearchProbe />);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Range' }), 'last7');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pipeline' }), 'p2');
    await waitFor(() => expect(screen.getByLabelText('Search')).toHaveTextContent('range=last7'));
    expect(screen.getByLabelText('Search')).toHaveTextContent('pipelineId=p2');
    await waitFor(() => expect(lastBody(f, 'pipeline-summary')).toMatchObject({ pipelineId: 'p2' }));
    const body = lastBody(f, 'pipeline-summary');
    expect(Date.parse(body.to) - Date.parse(body.from)).toBe(7 * DAY);
    cleanup();

    const g = mockFetch(reportRoutes());
    renderApp('/crm/reports?range=last7&pipelineId=p2');
    expect(await screen.findByRole('combobox', { name: 'Range' })).toHaveValue('last7');
    expect(screen.getByRole('combobox', { name: 'Pipeline' })).toHaveValue('p2');
    await waitFor(() => expect(requestTo(g, reportPath('by-owner'))?.body).toMatchObject({ pipelineId: 'p2' }));
    const again = requestTo(g, reportPath('by-owner'))!.body;
    expect(Date.parse(again.to) - Date.parse(again.from)).toBe(7 * DAY);
  });

  it('numbersFilterSendsPhoneNumberIds', async () => {
    const f = mockFetch(reportRoutes());
    const { user } = renderApp('/crm/reports', <SearchProbe />);
    await user.click(await screen.findByRole('button', { name: 'Numbers' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sales line' }));
    expect(screen.getByRole('button', { name: 'Numbers' })).toHaveTextContent('1 number');
    await waitFor(() => expect(lastBody(f, 'by-number')).toMatchObject({ phoneNumberIds: ['n1'] }));
    expect(screen.getByLabelText('Search')).toHaveTextContent('numbers=n1');
    await user.click(screen.getByRole('checkbox', { name: '+91 98765 00002' }));
    expect(screen.getByRole('button', { name: 'Numbers' })).toHaveTextContent('2 numbers');
    await waitFor(() => expect(lastBody(f, 'by-number')).toMatchObject({ phoneNumberIds: ['n1', 'n2'] }));
  });

  it('customRangeIsValidatedBeforeAnyCall', async () => {
    const f = mockFetch(reportRoutes());
    const { user } = renderApp('/crm/reports');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Range' }), 'custom');
    expect(screen.getByText('Pick both dates.')).toBeInTheDocument();
    const before = callsTo(f, reportPath('pipeline-summary'));
    await user.type(screen.getByLabelText('From'), '2024-01-01');
    await user.type(screen.getByLabelText('To'), '2026-10-29');
    expect(await screen.findByText('Pick a range of at most two years.')).toBeInTheDocument();
    expect(callsTo(f, reportPath('pipeline-summary'))).toBe(before);
    await user.clear(screen.getByLabelText('From'));
    await user.type(screen.getByLabelText('From'), '2026-08-01');
    await waitFor(() => expect(lastBody(f, 'pipeline-summary')).toMatchObject({ from: '2026-07-31T18:30:00.000Z' }));
    expect(lastBody(f, 'pipeline-summary').to).toBe('2026-10-29T18:30:00.000Z');
    expect(screen.getAllByText('1 Aug – 29 Oct 2026').length).toBeGreaterThan(0);
  });

  it('ownerPickerOnlyWithViewAll', async () => {
    const f = mockFetch(reportRoutes({}, { authorities: ['crm:view', 'crm:view-all'] }));
    const { user } = renderApp('/crm/reports');
    const owner = await screen.findByRole('combobox', { name: 'Owner' });
    expect(within(owner).getByRole('option', { name: 'Everyone' })).toBeInTheDocument();
    expect(within(owner).getByRole('option', { name: 'Me' })).toBeInTheDocument();
    await waitFor(() => expect(within(owner).getByRole('option', { name: 'Ravi Kumar' })).toBeInTheDocument());
    expect(within(owner).queryByRole('option', { name: 'Meera Manager' })).toBeNull();
    expect(within(owner).queryByRole('option', { name: 'Gone Person' })).toBeNull();
    await user.selectOptions(owner, 'Me');
    await waitFor(() => expect(lastBody(f, 'by-owner')).toMatchObject({ ownerIds: ['u4'] }));
    cleanup();

    mockFetch(reportRoutes());
    renderApp('/crm/reports');
    await screen.findByRole('combobox', { name: 'Range' });
    expect(screen.queryByRole('combobox', { name: 'Owner' })).toBeNull();
  });

  it('noPipelineMakesNoReportCalls', async () => {
    const f = mockFetch(reportRoutes({}, { pipelineAccess: [] }));
    renderApp('/crm/reports');
    expect(await screen.findByText('No pipeline assigned to you. Ask your admin.')).toBeInTheDocument();
    REPORTS.forEach((r) => expect(callsTo(f, reportPath(r))).toBe(0));
    expect(screen.queryByRole('combobox', { name: 'Range' })).toBeNull();
  });

  it('refreshRefetchesEveryCard', async () => {
    const f = mockFetch(reportRoutes());
    const { user } = renderApp('/crm/reports');
    await waitFor(() => OVERVIEW.forEach((r) => expect(callsTo(f, reportPath(r))).toBe(1)));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => OVERVIEW.forEach((r) => expect(callsTo(f, reportPath(r))).toBe(2)));
  });

  it('cardRemembersTheTableView', async () => {
    mockFetch(reportRoutes());
    const { user } = renderApp('/crm/reports');
    const toggle = await screen.findByRole('group', { name: 'View of Pipeline summary' });
    await user.click(within(toggle).getByRole('button', { name: 'Table' }));
    expect(localStorage.getItem('crm.reports.view.pipeline-summary')).toBe('table');
    cleanup();

    mockFetch(reportRoutes());
    renderApp('/crm/reports');
    const again = await screen.findByRole('group', { name: 'View of Pipeline summary' });
    expect(within(again).getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
  });
});
