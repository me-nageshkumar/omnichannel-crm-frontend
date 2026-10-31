import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { storeSession } from '../../../test/session';
import { SEGMENTS, SEGMENTS_BASE, segmentRoutes } from '../../../test/crmSegments';
import { sampleSegment, sampleSegmentPreview } from '../../../test/crm';
import { gate } from '../../../test/gate';

const PREVIEW = `POST ${SEGMENTS_BASE}/preview`;
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const rule = (n: string) => within(screen.getByRole('group', { name: n }));

describe('CRM segment editor', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function openNew(extra = {}) {
    const f = mockFetch(segmentRoutes(extra));
    const rendered = renderApp('/crm/segments/new');
    await screen.findByRole('heading', { name: 'New segment' });
    await screen.findByLabelText('Field');
    return { f, ...rendered };
  }

  /** Fills the one empty rule with "lifecycle is lead". */
  async function fillLifecycle(user: ReturnType<typeof renderApp>['user']) {
    await user.selectOptions(rule('Rule 1').getByLabelText('Field'), 'Lifecycle');
    await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'Lead');
  }

  it('newSegmentSavesAndReturnsToTheList', async () => {
    const { f, user } = await openNew({
      [`POST ${SEGMENTS_BASE}`]: { status: 201, body: sampleSegment({ id: 's9', name: 'Fresh leads' }) },
    });
    await user.type(screen.getByLabelText(/^Name/), '  Fresh leads ');
    await user.type(screen.getByLabelText('Description'), ' the newest ');
    await fillLifecycle(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(f, `POST ${SEGMENTS_BASE}`)).toBe(1));
    expect(requestTo(f, `POST ${SEGMENTS_BASE}`)?.body).toEqual({
      name: 'Fresh leads',
      description: 'the newest',
      rules: {
        combinator: 'and',
        not: false,
        rules: [{ field: 'contact.lifecycleStatus', operator: 'is', value: 'lead' }],
      },
    });
    expect(await screen.findByRole('grid', { name: 'Segments' })).toBeInTheDocument();
  });

  it('editLoadsAndSavesWithVersion', async () => {
    const f = mockFetch(segmentRoutes({ [`PUT ${SEGMENTS_BASE}/s2`]: { status: 200, body: SEGMENTS[1] } }));
    const { user } = renderApp('/crm/segments/s2');
    await screen.findByRole('heading', { name: 'Edit segment' });
    expect(await screen.findByLabelText(/^Name/)).toHaveValue('Quiet contacts');
    expect(rule('Rule 1').getByLabelText('Field')).toHaveValue('contact.lifecycleStatus');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(f, `PUT ${SEGMENTS_BASE}/s2`)).toBe(1));
    expect(requestTo(f, `PUT ${SEGMENTS_BASE}/s2`)?.body).toMatchObject({ name: 'Quiet contacts', version: 3 });
  });

  it('nameTakenLandsOnTheNameField', async () => {
    const { user } = await openNew({
      [`POST ${SEGMENTS_BASE}`]: {
        status: 409,
        body: { code: 'SEGMENT_NAME_TAKEN', field: 'name', message: 'A segment with this name already exists' },
      },
    });
    await user.type(screen.getByLabelText(/^Name/), 'Gold leads');
    await fillLifecycle(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('A segment with this name already exists')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('invalidRulesLandOnTheirRules', async () => {
    const { user } = await openNew({
      [`POST ${SEGMENTS_BASE}`]: {
        status: 400,
        body: { code: 'INVALID_SEGMENT', message: 'The segment has 1 problem', 'rules[0].value': 'must be a text' },
      },
    });
    await user.type(screen.getByLabelText(/^Name/), 'Bad');
    await fillLifecycle(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await rule('Rule 1').findByText('must be a text')).toBeInTheDocument();
  });

  it('versionConflictOffersReload', async () => {
    let gets = 0;
    let puts = 0;
    const newer = sampleSegment({ name: 'Gold leads v2', version: 4 });
    const f = mockFetch(
      segmentRoutes({
        [`GET ${SEGMENTS_BASE}/s1`]: () => ({ status: 200, body: ++gets === 1 ? SEGMENTS[0] : newer }),
        [`PUT ${SEGMENTS_BASE}/s1`]: () =>
          ++puts === 1
            ? { status: 409, body: { code: 'VERSION_CONFLICT', message: 'changed' } }
            : { status: 200, body: newer },
      }),
    );
    const { user } = renderApp('/crm/segments/s1');
    await screen.findByRole('heading', { name: 'Edit segment' });
    expect(await screen.findByLabelText(/^Name/)).toHaveValue('Gold leads');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Someone changed this segment/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    // the other person's version is what the form now shows, and what the next save builds on
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue('Gold leads v2'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(f, `PUT ${SEGMENTS_BASE}/s1`)).toBe(2));
    expect(requestTo(f, `PUT ${SEGMENTS_BASE}/s1`, 1)?.body).toMatchObject({ name: 'Gold leads v2', version: 4 });
  });

  it('previewRuleErrorsLandOnTheirRules', async () => {
    const { user } = await openNew({
      [PREVIEW]: {
        status: 400,
        body: { code: 'INVALID_SEGMENT', message: 'The segment has 1 problem', 'rules[0].value': 'must be a text' },
      },
    });
    await fillLifecycle(user);
    expect(await rule('Rule 1').findByText('must be a text')).toBeInTheDocument();
    const card = screen.getByRole('region', { name: 'Who matches' });
    expect(within(card).queryByText('The segment has 1 problem')).toBeNull();
  });

  it('editorMakesNoSegmentCallsWithoutAuthority', async () => {
    const f = mockFetch(segmentRoutes({}, { authorities: ['crm:view', 'crm:edit'] }));
    renderApp('/crm/segments/new');
    expect(await screen.findByText('You need the Segments permission')).toBeInTheDocument();
    expect(callsTo(f, `GET ${SEGMENTS_BASE}/fields`)).toBe(0);
  });

  it('labelsFailureDoesNotBlockTheBuilder', async () => {
    mockFetch(segmentRoutes({ 'GET /api/workspaces/w1/contact-labels': { status: 500, body: { message: 'down' } } }));
    renderApp('/crm/segments/new');
    await screen.findByRole('heading', { name: 'New segment' });
    expect(await screen.findByLabelText('Field')).toBeInTheDocument();
  });

  it('previewWaits600msAndSendsCleanRules', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { f, user } = await openNew();
    await fillLifecycle(user);
    expect(callsTo(f, PREVIEW)).toBe(0);
    await advance(300);
    expect(callsTo(f, PREVIEW)).toBe(0);
    await advance(400);
    await waitFor(() => expect(callsTo(f, PREVIEW)).toBe(1));
    expect(requestTo(f, PREVIEW)?.body).toEqual({
      rules: {
        combinator: 'and',
        not: false,
        rules: [{ field: 'contact.lifecycleStatus', operator: 'is', value: 'lead' }],
      },
    });
  });

  it('previewShowsCountsPeopleAndAccounts', async () => {
    const { user } = await openNew();
    await fillLifecycle(user);
    const card = await screen.findByRole('region', { name: 'Who matches' });
    expect(await within(card).findByText('12 CRM contacts (11 people)')).toBeInTheDocument();
    expect(within(card).getByText('Sales line')).toBeInTheDocument();
    expect(within(card).getByText('9')).toBeInTheDocument();
    expect(within(card).getByText('+91 98765 00002')).toBeInTheDocument();
    expect(within(card).getByText('3')).toBeInTheDocument();
  });

  it('previewSaysTruncated', async () => {
    const { user } = await openNew({
      [PREVIEW]: { status: 200, body: sampleSegmentPreview({ total: 60000, people: 60000, truncated: true }) },
    });
    await fillLifecycle(user);
    const card = await screen.findByRole('region', { name: 'Who matches' });
    expect(await within(card).findByText('60,000 CRM contacts')).toBeInTheDocument();
    expect(within(card).getByText(/first 50,000 only/)).toBeInTheDocument();
  });

  it('stalePreviewAnswerIsDropped', async () => {
    let n = 0;
    const { f, user } = await openNew({
      [PREVIEW]: () => ({ status: 200, body: sampleSegmentPreview({ total: ++n, people: n }) }),
    });
    const first = gate(f, PREVIEW, 1);
    await fillLifecycle(user);
    await waitFor(() => expect(callsTo(f, PREVIEW)).toBe(1));
    await user.selectOptions(rule('Rule 1').getByLabelText('Value'), 'Customer');
    await waitFor(() => expect(callsTo(f, PREVIEW)).toBe(2));
    const card = await screen.findByRole('region', { name: 'Who matches' });
    await within(card).findByText('2 CRM contacts');
    first.release();
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(within(card).getByText('2 CRM contacts')).toBeInTheDocument();
    expect(within(card).queryByText('1 CRM contacts')).toBeNull();
  });

  it('incompleteRulesShowTheHint', async () => {
    const { f } = await openNew();
    const card = await screen.findByRole('region', { name: 'Who matches' });
    expect(within(card).getByText('Finish the rules to see who matches')).toBeInTheDocument();
    expect(callsTo(f, PREVIEW)).toBe(0);
  });

  it('flaggedRulesAreShownAndRemovable', async () => {
    const flagged = sampleSegment({
      id: 's3',
      name: 'Old pipeline',
      rules: {
        combinator: 'and',
        not: false,
        rules: [
          { field: 'contact.lifecycleStatus', operator: 'is', value: 'lead' },
          { field: 'deal.pipelineId', operator: 'is', value: 'p7', inaccessible: true },
        ],
      },
    });
    const f = mockFetch(
      segmentRoutes({
        [`GET ${SEGMENTS_BASE}/s3`]: { status: 200, body: flagged },
        [`PUT ${SEGMENTS_BASE}/s3`]: { status: 200, body: flagged },
      }),
    );
    const { user } = renderApp('/crm/segments/s3');
    await screen.findByRole('heading', { name: 'Edit segment' });
    expect(await screen.findByText("A pipeline you can't access")).toBeInTheDocument();
    await user.click(rule('Rule 2').getByRole('button', { name: 'Remove rule' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(f, `PUT ${SEGMENTS_BASE}/s3`)).toBe(1));
    expect(requestTo(f, `PUT ${SEGMENTS_BASE}/s3`)?.body).toMatchObject({
      rules: {
        combinator: 'and',
        not: false,
        rules: [{ field: 'contact.lifecycleStatus', operator: 'is', value: 'lead' }],
      },
    });
  });

  it('previewErrorsAreInline', async () => {
    const { user } = await openNew({
      [PREVIEW]: {
        status: 400,
        body: {
          code: 'SEGMENT_TOO_BROAD',
          message: 'The segment matches too many contacts to resolve; narrow its rules',
        },
      },
    });
    await fillLifecycle(user);
    const card = await screen.findByRole('region', { name: 'Who matches' });
    expect(await within(card).findByText(/too many contacts/)).toBeInTheDocument();
    expect(rule('Rule 1').getByLabelText('Field')).toBeEnabled();
  });

  it('builderComesBeforeThePreviewInTheDocument', async () => {
    await openNew();
    const builder = screen.getByRole('group', { name: 'Filter rules' });
    const card = screen.getByRole('region', { name: 'Who matches' });
    expect(builder.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
