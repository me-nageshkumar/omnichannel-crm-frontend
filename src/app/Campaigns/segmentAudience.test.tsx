import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_A, BRAND_CODES, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { content, template } from '../../test/templates';
import { campaign, campaignDetail, sender } from '../../test/campaigns';
import { SEGMENTS } from '../../test/crmSegments';
import { crmStatus, sampleSegmentPreview } from '../../test/crm';

const B = '/api/workspaces/w1';
const C = `${B}/campaigns`;
const SEGMENTS_URL = `GET ${B}/crm/segments`;
const PREVIEW = `POST ${B}/crm/segments/s1/preview`;
const CREATE = `POST ${C}`;

const REMINDER = template({ id: 't3', name: 'Reminder', content: content({ body: 'See you soon' }) });
const P1 = sender({ phoneNumberId: 'p1', number: '919800000001', label: 'Sales line' });
const P2 = sender({ phoneNumberId: 'p2', number: '919800000002', label: 'Support line' });
const PREVIEW_BODY = sampleSegmentPreview({
  channelAccounts: [
    { channelAccountId: 'p1', kind: 'WHATSAPP_WEB', label: 'Sales line', count: 9 },
    { channelAccountId: 'p2', kind: 'WHATSAPP_WEB', label: 'Support line', count: 3 },
  ],
});
const CREATED = campaign({
  id: 'c9',
  name: 'Diwali',
  audience: {
    ...campaign().audience,
    kind: 'SEGMENT',
    filterId: null,
    filterName: null,
    segmentId: 's1',
    segmentName: 'Gold leads',
  },
});

function routes(extra = {}, user = WORKSPACE_MANAGER) {
  return {
    ...meAs(user),
    [`GET ${B}/contact-filters`]: { status: 200, body: [] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [] },
    [`GET ${B}/templates`]: { status: 200, body: [REMINDER] },
    [`GET ${C}/senders`]: { status: 200, body: [P1, P2] },
    [`GET ${B}/crm/status`]: { status: 200, body: crmStatus({ authorities: ['crm:view', 'crm:segments'] }) },
    [SEGMENTS_URL]: { status: 200, body: SEGMENTS },
    [PREVIEW]: { status: 200, body: PREVIEW_BODY },
    [CREATE]: { status: 201, body: CREATED },
    [`POST ${C}/c9/start`]: { status: 200, body: { ...CREATED, status: 'RUNNING' } },
    [`GET ${C}/c9`]: { status: 200, body: campaignDetail({ id: 'c9', name: 'Diwali' }) },
    [`GET ${C}/c9/recipients`]: { status: 200, body: { items: [], total: 0, page: 0 } },
    [`GET ${C}`]: { status: 200, body: { items: [CREATED], total: 1, page: 0, systemPaused: false } },
    ...extra,
  };
}

type User = ReturnType<typeof renderApp>['user'];
const next = () => screen.getByRole('button', { name: 'Next' });

async function chooseSegment(user: User) {
  await user.click(await screen.findByRole('radio', { name: 'CRM segment' }));
  const select = await screen.findByRole('combobox', { name: 'Segment' });
  await within(select).findByRole('option', { name: /Gold leads/ });
  await user.selectOptions(select, 's1');
}

async function toReview(user: User, senders = ['+919800000001']) {
  const name = await screen.findByRole('textbox', { name: 'Name' });
  await user.type(name, 'Diwali');
  await chooseSegment(user);
  await user.click(next());
  await user.click(await screen.findByRole('menuitem', { name: /^Reminder/ }));
  await user.click(next());
  await screen.findByRole('checkbox', { name: 'Select +919800000001' });
  for (const n of senders) await user.click(screen.getByRole('checkbox', { name: `Select ${n}` }));
  await user.click(next());
  await screen.findByRole('button', { name: 'Start campaign' });
}

describe('campaign wizard with a CRM segment audience', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('wizardHidesSegmentRadioWithoutAuthority', async () => {
    const f = mockFetch(
      routes(
        {},
        {
          ...WORKSPACE_MANAGER,
          workspaces: [{ ...BRAND_A, authorities: BRAND_CODES.filter((c) => c !== 'crm:segments') }],
        },
      ),
    );
    renderApp('/campaigns/new');
    await screen.findByRole('radio', { name: 'Saved contact filter' });
    expect(screen.queryByRole('radio', { name: 'CRM segment' })).toBeNull();
    expect(callsTo(f, SEGMENTS_URL)).toBe(0);
  });

  it('segmentRadioListsSegmentsWithCounts', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await chooseSegment(user);
    const select = screen.getByRole('combobox', { name: 'Segment' });
    expect(
      within(select).getByRole('option', { name: /^Gold leads — 1,240 CRM contacts, as of .+/ }),
    ).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Quiet contacts — not counted yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage segments' })).toHaveAttribute('href', '/crm/segments');
  });

  it('aSegmentOfOneReadsInTheSingularInTheSelect', async () => {
    const one = {
      ...SEGMENTS[0],
      cachedCounts: { total: 1, people: 1, truncated: false, channelAccounts: [], at: '2026-10-31T03:35:00Z' },
    };
    mockFetch(routes({ [SEGMENTS_URL]: { status: 200, body: [one] } }));
    const { user } = renderApp('/campaigns/new');
    await chooseSegment(user);
    const select = screen.getByRole('combobox', { name: 'Segment' });
    expect(within(select).getByRole('option', { name: /^Gold leads — 1 CRM contact, as of .+/ })).toBeInTheDocument();
  });

  it('reviewOfOneReadsInTheSingular', async () => {
    const preview = sampleSegmentPreview({
      total: 2,
      people: 1,
      channelAccounts: [
        { channelAccountId: 'p1', kind: 'WHATSAPP_WEB', label: 'Sales line', count: 1 },
        { channelAccountId: 'p2', kind: 'WHATSAPP_WEB', label: 'Support line', count: 1 },
      ],
    });
    mockFetch(routes({ [PREVIEW]: { status: 200, body: preview } }));
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    expect(await screen.findByText('Segment Gold leads · 2 CRM contacts (1 person)')).toBeInTheDocument();
    expect(screen.getByText('Sales line: 1 contact')).toBeInTheDocument();
    expect(screen.getByText(/^1 contact landed on Support line, which is not a chosen sender/)).toBeInTheDocument();
  });

  it('reviewOfOneContactReadsInTheSingular', async () => {
    const preview = sampleSegmentPreview({
      total: 1,
      people: 1,
      channelAccounts: [{ channelAccountId: 'p1', kind: 'WHATSAPP_WEB', label: 'Sales line', count: 1 }],
    });
    mockFetch(routes({ [PREVIEW]: { status: 200, body: preview } }));
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    expect(await screen.findByText('Segment Gold leads · 1 CRM contact')).toBeInTheDocument();
  });

  it('segmentIdInTheUrlPreselects', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new?segmentId=s1');
    expect(await screen.findByRole('radio', { name: 'CRM segment' })).toBeChecked();
    const select = await screen.findByRole('combobox', { name: 'Segment' });
    await waitFor(() => expect(select).toHaveValue('s1'));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Diwali');
    expect(next()).toBeEnabled();
    // straight through to Review without touching the select: the segment is named there
    await user.click(next());
    await user.click(await screen.findByRole('menuitem', { name: /^Reminder/ }));
    await user.click(next());
    await user.click(await screen.findByRole('checkbox', { name: 'Select +919800000001' }));
    await user.click(next());
    expect(await screen.findByText(/^Segment Gold leads/)).toBeInTheDocument();
  });

  it('segmentRadioHiddenWhenTheCrmIsOff', async () => {
    mockFetch(routes({ [`GET ${B}/crm/status`]: { status: 200, body: crmStatus({ enabled: false }) } }));
    renderApp('/campaigns/new');
    await screen.findByRole('radio', { name: 'Saved contact filter' });
    await waitFor(() => expect(screen.queryByRole('radio', { name: 'CRM segment' })).toBeNull());
  });

  it('reviewShowsSegmentLineAndAccountWarnings', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    expect(await screen.findByText('Segment Gold leads · 12 CRM contacts (11 people)')).toBeInTheDocument();
    expect(screen.getByText(/3 contacts landed on Support line, which is not a chosen sender/)).toBeInTheDocument();
    expect(screen.queryByText(/9 contacts landed on Sales line/)).toBeNull();
  });

  it('truncatedSegmentBlocksStart', async () => {
    mockFetch(
      routes({
        [PREVIEW]: { status: 200, body: sampleSegmentPreview({ total: 60000, people: 60000, truncated: true }) },
      }),
    );
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    expect(await screen.findByText(/more than 50,000 contacts for you/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start campaign' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });

  it('createSendsSegmentAudience', async () => {
    const f = mockFetch(routes());
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    await screen.findByText(/Segment Gold leads/);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(callsTo(f, CREATE)).toBe(1));
    expect(requestTo(f, CREATE)?.body).toMatchObject({
      name: 'Diwali',
      audience: { kind: 'SEGMENT', segmentId: 's1' },
    });
  });

  it('serverErrorOnSegmentLandsOnTheAudienceLine', async () => {
    mockFetch(
      routes({
        [CREATE]: {
          status: 400,
          body: {
            code: 'VALIDATION',
            message: 'audience.segmentId unknown segment',
            fields: { 'audience.segmentId': 'unknown segment' },
          },
        },
      }),
    );
    const { user } = renderApp('/campaigns/new');
    await toReview(user);
    await screen.findByText(/Segment Gold leads/);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    const term = (await screen.findAllByRole('term')).find((dt) => dt.textContent === 'Audience') as HTMLElement;
    const group = term.closest('.pf-v6-c-description-list__group') as HTMLElement;
    expect(await within(group).findByText('unknown segment')).toBeInTheDocument();
  });

  it('listSaysSegment', async () => {
    mockFetch(routes());
    renderApp('/campaigns');
    expect(await screen.findByText('Segment: Gold leads')).toBeInTheDocument();
  });
});
