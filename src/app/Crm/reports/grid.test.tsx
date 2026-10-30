import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SessionProvider } from '@app/session/SessionContext';
import { resetFieldDefinitions } from '@app/Crm/fields/useFieldDefinitions';
import { GridTab } from '@app/Crm/reports/GridTab';
import type { GridRow } from '@app/api/crm';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { storeSession } from '../../../test/session';
import { BASE } from '../../../test/crmBoard';
import { reportPath, reportRoutes } from '../../../test/crmReports';
import { sampleField, sampleGridReport } from '../../../test/crm';

const GRID = reportPath('grid');
const FIELDS = [
  sampleField({ id: 'f1', entityType: 'DEAL', key: 'budget', label: 'Budget', type: 'CURRENCY' }),
  sampleField({
    id: 'f2',
    entityType: 'DEAL',
    key: 'tier',
    label: 'Tier',
    type: 'SELECT',
    options: [{ key: 'gold', label: 'Gold', color: null, position: 1, active: true }],
  }),
  sampleField({ id: 'f3', entityType: 'DEAL', key: 'old', label: 'Old field', type: 'TEXT', active: false }),
];
const routes = (extra = {}) => reportRoutes({ [`GET ${BASE}/fields`]: { status: 200, body: FIELDS }, ...extra });
const SearchProbe: React.FunctionComponent = () => <output aria-label="Search">{useLocation().search}</output>;
const lastGrid = (f: ReturnType<typeof mockFetch>) => requestTo(f, GRID, callsTo(f, GRID) - 1)?.body;
const select = (name: string) => screen.getByRole('combobox', { name });
const card = () => screen.getByRole('group', { name: 'View of Grid' }).closest('.crm-report-card') as HTMLElement;

async function openGrid(path = '/crm/reports') {
  const r = renderApp(path, <SearchProbe />);
  await r.user.click(await screen.findByRole('tab', { name: 'Grid' }));
  await screen.findByRole('combobox', { name: 'Record type' });
  return r;
}

describe('CRM grid report', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
    resetFieldDefinitions();
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: 'Asia/Kolkata' };
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('defaultsToDealCountByPipeline', async () => {
    const f = mockFetch(routes());
    await openGrid();
    await waitFor(() => expect(callsTo(f, GRID)).toBe(1));
    const body = lastGrid(f);
    expect(body).toMatchObject({
      entityType: 'DEAL',
      groupBy: 'pipeline',
      metric: 'COUNT',
      pipelineId: 'p1',
      tz: 'Asia/Kolkata',
    });
    expect(body).not.toHaveProperty('field');
    expect(body).not.toHaveProperty('dateBucket');
    expect(select('Record type')).toHaveValue('DEAL');
    expect(select('Group by')).toHaveValue('pipeline');
    expect(select('Metric')).toHaveValue('COUNT');
    expect(select('Date bucket')).toHaveValue('');
    expect(screen.queryByRole('combobox', { name: 'Field' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Date field' })).toBeNull();
    await waitFor(() =>
      expect(Array.from(card().querySelectorAll('text.crm-chart__label')).map((t) => t.textContent)).toEqual([
        'New',
        'Proposal',
      ]),
    );
    expect(within(card()).getByRole('img', { name: /^Grid, / })).toBeInTheDocument();
  });

  it('stageNeedsPipelineHint', async () => {
    const f = mockFetch(routes());
    render(
      <MemoryRouter initialEntries={['/crm/reports?g.by=stage']}>
        <SessionProvider>
          <GridTab
            ws="w1"
            body={{ from: '2026-08-01T18:30:00.000Z', to: '2026-10-30T18:30:00.000Z', tz: 'Asia/Kolkata' }}
            tick={0}
            period="1 Aug – 29 Oct 2026"
            currency="INR"
          />
        </SessionProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Stage needs a pipeline.')).toBeInTheDocument();
    expect(callsTo(f, GRID)).toBe(0);
  });

  it('sumShowsFieldPicker', async () => {
    const f = mockFetch(routes());
    const { user } = await openGrid();
    await waitFor(() => expect(within(select('Group by')).getByRole('option', { name: 'Tier' })).toBeInTheDocument());
    expect(within(select('Group by')).getByRole('group', { name: 'Custom fields' })).toBeInTheDocument();
    expect(within(select('Group by')).queryByRole('option', { name: 'Budget' })).toBeNull();
    expect(within(select('Group by')).queryByRole('option', { name: 'Old field' })).toBeNull();
    await user.selectOptions(select('Metric'), 'SUM');
    const field = select('Field');
    expect(
      within(field)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Amount', 'Budget']);
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ metric: 'SUM', field: 'amount' }));
    await user.selectOptions(field, 'custom:budget');
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ metric: 'SUM', field: 'custom:budget' }));
    await user.selectOptions(select('Metric'), 'COUNT');
    expect(screen.queryByRole('combobox', { name: 'Field' })).toBeNull();
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ metric: 'COUNT' }));
    expect(lastGrid(f)).not.toHaveProperty('field');
  });

  it('switchingEntityResetsGroupBy', async () => {
    const f = mockFetch(routes());
    const { user } = await openGrid();
    await user.selectOptions(select('Group by'), 'owner');
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ entityType: 'DEAL', groupBy: 'owner' }));
    await user.selectOptions(select('Record type'), 'CONTACT');
    expect(select('Group by')).toHaveValue('owner');
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ entityType: 'CONTACT', groupBy: 'owner' }));
    await user.selectOptions(select('Group by'), 'lifecycle');
    await user.selectOptions(select('Record type'), 'COMPANY');
    expect(select('Group by')).toHaveValue('industry');
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ entityType: 'COMPANY', groupBy: 'industry' }));
    expect(
      within(select('Group by'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Industry', 'Size', 'Owner']);
  });

  it('bucketedResultDrawsLines', async () => {
    const rows: GridRow[] = [];
    const months = ['2026-07-31T18:30:00Z', '2026-08-31T18:30:00Z', '2026-09-30T18:30:00Z'];
    for (let g = 1; g <= 10; g++) {
      months.forEach((m, i) =>
        rows.push({ key: `g${g}`, label: `Group ${g}`, bucket: m, value: (11 - g) * (i + 1), count: 1 }),
      );
    }
    const f = mockFetch(
      routes({
        [GRID]: (req) =>
          req.body.dateBucket
            ? { status: 200, body: sampleGridReport({ groupBy: 'source', dateBucket: 'MONTH', rows }) }
            : { status: 200, body: sampleGridReport() },
      }),
    );
    const { user } = await openGrid();
    await user.selectOptions(select('Date bucket'), 'MONTH');
    expect(select('Date field')).toHaveValue('creationTime');
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ dateBucket: 'MONTH', dateField: 'creationTime' }));
    await waitFor(() => expect(card().querySelectorAll('path.crm-chart__line')).toHaveLength(8));
    const legend = card().querySelector('.crm-chart__legend') as HTMLElement;
    const names = within(legend)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(names).toHaveLength(8);
    expect(names[0]).toBe('Group 1');
    expect(names[7]).toBe('Other');
    await user.selectOptions(select('Date field'), 'closedAt');
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ dateField: 'closedAt' }));
    await user.click(within(card()).getByRole('button', { name: 'Table' }));
    const header = within(within(card()).getByRole('grid', { name: 'Grid' }))
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(header).toEqual(['Group', 'Period', 'Value', 'Count']);
  });

  it('otherRowWhenTruncated', async () => {
    mockFetch(
      routes({
        [GRID]: {
          status: 200,
          body: sampleGridReport({
            truncated: true,
            rows: [
              { key: 's1', label: 'New', value: 4, count: 4 },
              { key: '__other', label: 'Other', value: 7, count: 7 },
            ],
          }),
        },
      }),
    );
    const { user } = await openGrid();
    await screen.findByRole('group', { name: 'View of Grid' });
    await user.click(within(card()).getByRole('button', { name: 'Table' }));
    const table = await within(card()).findByRole('grid', { name: 'Grid' });
    const rows = within(table).getAllByRole('row');
    expect(rows[2]).toHaveTextContent('Other');
    expect(rows[2]).toHaveTextContent('7');
    expect(card()).toHaveTextContent('Showing the 100 largest groups; the rest are in Other.');
  });

  it('gridBuilderIsKeyboardOperable', async () => {
    mockFetch(routes());
    const { user } = await openGrid('/crm/reports?g.metric=SUM&g.bucket=MONTH');
    await screen.findByRole('group', { name: 'View of Grid' });
    select('Record type').focus();
    const order = ['Record type', 'Group by', 'Metric', 'Field', 'Date bucket', 'Date field'];
    for (let i = 1; i < order.length; i++) {
      await user.tab();
      expect(select(order[i])).toHaveFocus();
    }
    await user.tab();
    expect(within(card()).getByRole('button', { name: 'Chart' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    await user.tab();
    expect(within(card()).getByRole('button', { name: 'Table' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(within(card()).getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('gridStateInUrl', async () => {
    const f = mockFetch(routes());
    const { user } = await openGrid();
    await user.selectOptions(select('Group by'), 'owner');
    await user.selectOptions(select('Metric'), 'SUM');
    await waitFor(() => expect(screen.getByLabelText('Search')).toHaveTextContent('g.by=owner'));
    expect(screen.getByLabelText('Search')).toHaveTextContent('g.metric=SUM');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Range' }), 'last7');
    await waitFor(() => expect(screen.getByLabelText('Search')).toHaveTextContent('range=last7'));
    expect(screen.getByLabelText('Search')).toHaveTextContent('g.by=owner');
    await waitFor(() => expect(lastGrid(f)).toMatchObject({ groupBy: 'owner', metric: 'SUM', field: 'amount' }));
    expect(Date.parse(lastGrid(f).to) - Date.parse(lastGrid(f).from)).toBe(7 * 86_400_000);
  });

  it('gridStateRestoredFromUrl', async () => {
    const f = mockFetch(routes());
    await openGrid('/crm/reports?range=last7&g.entity=CONTACT&g.by=origin&g.bucket=WEEK');
    expect(select('Record type')).toHaveValue('CONTACT');
    expect(select('Group by')).toHaveValue('origin');
    expect(select('Date bucket')).toHaveValue('WEEK');
    expect(screen.queryByRole('combobox', { name: 'Date field' })).toBeNull();
    await waitFor(() =>
      expect(lastGrid(f)).toMatchObject({ entityType: 'CONTACT', groupBy: 'origin', dateBucket: 'WEEK' }),
    );
    expect(lastGrid(f)).not.toHaveProperty('dateField');
  });
});
