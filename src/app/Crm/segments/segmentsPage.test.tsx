import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { BRAND_A, BRAND_CODES, WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { SEGMENTS_BASE, segmentRoutes } from '../../../test/crmSegments';
import { sampleSegment } from '../../../test/crm';

/** A manager whose brand role lacks the Segments authority. */
const noSegments = meAs({
  ...WORKSPACE_MANAGER,
  workspaces: [{ ...BRAND_A, authorities: BRAND_CODES.filter((c) => c !== 'crm:segments') }],
});

describe('CRM segments page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('navShowsSegmentsWithAuthority', async () => {
    mockFetch(segmentRoutes());
    renderApp('/crm');
    const segments = await screen.findByRole('link', { name: 'Segments', hidden: true });
    expect(segments).toHaveAttribute('href', '/crm/segments');
    const links = screen.getAllByRole('link', { hidden: true }).map((l) => l.textContent);
    expect(links.indexOf('Companies')).toBeLessThan(links.indexOf('Segments'));
    expect(links.indexOf('Segments')).toBeLessThan(links.indexOf('Reports'));
  });

  it('withoutSegmentsAuthorityNothingSegmentIsShown', async () => {
    const f = mockFetch(segmentRoutes(noSegments, { authorities: ['crm:view', 'crm:edit'] }));
    renderApp('/crm/segments');
    expect(await screen.findByText('You need the Segments permission')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Segments', hidden: true })).toBeNull();
    expect(screen.getByRole('link', { name: 'Reports', hidden: true })).toBeInTheDocument();
    expect(callsTo(f, `GET ${SEGMENTS_BASE}`)).toBe(0);
  });

  it('listsSegmentsWithCountsAndLastSent', async () => {
    mockFetch(segmentRoutes());
    renderApp('/crm/segments');
    const table = await screen.findByRole('grid', { name: 'Segments' });
    expect(within(table).getByRole('link', { name: 'Gold leads' })).toHaveAttribute('href', '/crm/segments/s1');
    expect(within(table).getByText('Leads with a gold-tier deal')).toBeInTheDocument();
    expect(within(table).getByText(/1,240 CRM contacts \(1,180 people\)/)).toBeInTheDocument();
    expect(within(table).getByText(/as of/)).toBeInTheDocument();
    expect(within(table).getByText('Not counted yet')).toBeInTheDocument();
    expect(within(table).getByText('Never')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Diwali offer' })).toHaveAttribute('href', '/campaigns/k1');
  });

  it('aSegmentOfOneReadsInTheSingular', async () => {
    const one = sampleSegment({
      cachedCounts: { total: 1, people: 1, truncated: false, channelAccounts: [], at: '2026-10-31T03:35:00Z' },
    });
    mockFetch(segmentRoutes({ [`GET ${SEGMENTS_BASE}`]: { status: 200, body: [one] } }));
    renderApp('/crm/segments');
    const table = await screen.findByRole('grid', { name: 'Segments' });
    expect(within(table).getByText('1 CRM contact')).toBeInTheDocument();
  });

  it('audiencePopoverListsChannelAccounts', async () => {
    mockFetch(segmentRoutes());
    const { user } = renderApp('/crm/segments');
    const table = await screen.findByRole('grid', { name: 'Segments' });
    const trigger = within(table).getByRole('button', { name: '2 channel accounts in Gold leads' });
    expect(trigger).toHaveTextContent('2 channel accounts');
    await user.click(trigger);
    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByText('Sales line')).toBeInTheDocument();
    expect(within(popover).getByText('900')).toBeInTheDocument();
    expect(within(popover).getByText('+91 98765 00002')).toBeInTheDocument();
    expect(within(popover).getByText('340')).toBeInTheDocument();
  });

  it('sendCampaignLinksToTheWizard', async () => {
    mockFetch(segmentRoutes());
    renderApp('/crm/segments');
    const table = await screen.findByRole('grid', { name: 'Segments' });
    const send = within(table).getByRole('link', { name: 'Send campaign to Gold leads' });
    expect(send).toHaveAttribute('href', '/campaigns/new?segmentId=s1');
    expect(within(table).getByRole('link', { name: 'Edit Gold leads' })).toHaveAttribute('href', '/crm/segments/s1');
  });

  it('aSearchWithNoMatchSaysSo', async () => {
    mockFetch(segmentRoutes());
    const { user } = renderApp('/crm/segments');
    await screen.findByRole('grid', { name: 'Segments' });
    await user.type(screen.getByRole('textbox', { name: 'Search segments' }), 'zzz');
    expect(await screen.findByText('No segments match your search')).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'Segments' })).toBeNull();
  });

  it('sendCampaignNeedsCampaignManage', async () => {
    mockFetch(
      segmentRoutes(
        meAs({
          ...WORKSPACE_MANAGER,
          workspaces: [{ ...BRAND_A, authorities: BRAND_CODES.filter((c) => c !== 'campaign:manage') }],
        }),
      ),
    );
    renderApp('/crm/segments');
    const table = await screen.findByRole('grid', { name: 'Segments' });
    expect(within(table).queryByRole('link', { name: /^Send campaign/ })).toBeNull();
    expect(within(table).getAllByRole('link', { name: /^Edit/ })).toHaveLength(2);
  });

  it('deleteConfirmsAndRefreshes', async () => {
    const f = mockFetch(segmentRoutes({ [`DELETE ${SEGMENTS_BASE}/s1`]: { status: 204, body: null } }));
    const { user } = renderApp('/crm/segments');
    const table = await screen.findByRole('grid', { name: 'Segments' });
    await user.click(within(table).getByRole('button', { name: 'Delete Gold leads' }));
    const dialog = await screen.findByRole('dialog', { name: /Delete segment\?/ });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(callsTo(f, `DELETE ${SEGMENTS_BASE}/s1`)).toBe(1));
    await waitFor(() => expect(callsTo(f, `GET ${SEGMENTS_BASE}`)).toBe(2));
    expect(requestTo(f, `DELETE ${SEGMENTS_BASE}/s1`)).toBeTruthy();
  });

  it('deleteInUseShowsTheCampaigns', async () => {
    mockFetch(
      segmentRoutes({
        [`DELETE ${SEGMENTS_BASE}/s1`]: {
          status: 409,
          body: { code: 'SEGMENT_IN_USE', message: 'Used by campaigns: Diwali offer', campaignIds: 'k1' },
        },
      }),
    );
    const { user } = renderApp('/crm/segments');
    const table = await screen.findByRole('grid', { name: 'Segments' });
    await user.click(within(table).getByRole('button', { name: 'Delete Gold leads' }));
    const dialog = await screen.findByRole('dialog', { name: /Delete segment\?/ });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText('Used by campaigns: Diwali offer')).toBeInTheDocument();
  });
});
