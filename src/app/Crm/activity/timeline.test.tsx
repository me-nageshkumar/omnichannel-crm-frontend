import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { sampleDeal } from '../../../test/crm';
import { storeSession } from '../../../test/session';
import { BASE, boardRoutes } from '../../../test/crmBoard';

const act = (over: Record<string, unknown>) => ({
  id: 'a1',
  type: 'SYSTEM',
  target: { type: 'DEAL', id: 'd1' },
  summary: null,
  payload: null,
  actor: { id: 'u4', name: 'Asha Rao' },
  actorType: 'USER',
  happenedAt: '2026-10-22T10:00:00Z',
  ...over,
});

const routes = (items: unknown[], extra = {}) =>
  boardRoutes(
    {
      [`GET ${BASE}/deals/d1`]: { status: 200, body: sampleDeal() },
      [`GET ${BASE}/activities`]: { status: 200, body: { items, total: items.length, page: 0 } },
      ...extra,
    },
    { authorities: ['crm:view', 'crm:edit'] },
  );

const openTimeline = async (user: ReturnType<typeof renderApp>['user']) => {
  await screen.findByRole('heading', { name: 'Acme order' });
  await user.click(screen.getByRole('tab', { name: 'Timeline' }));
};

describe('CRM timeline', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rendersStageChangeWithStageNames', async () => {
    const f = mockFetch(
      routes([
        act({
          id: 'a1',
          type: 'STAGE_CHANGED',
          payload: { fromStageId: 's1', toStageId: 's2', fromStageName: 'New', toStageName: 'Proposal' },
        }),
        act({ id: 'a2', type: 'DEAL_LOST', payload: { lostReason: 'price' }, happenedAt: '2026-10-21T10:00:00Z' }),
        act({
          id: 'a3',
          type: 'FIELD_CHANGED',
          payload: { changes: [{ field: 'amount', from: 1000, to: 1500 }] },
          happenedAt: '2026-10-20T10:00:00Z',
        }),
      ]),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openTimeline(user);
    expect(await screen.findByText('Stage changed from New to Proposal')).toBeInTheDocument();
    expect(screen.getByText('Lost — price')).toBeInTheDocument();
    expect(screen.getByText('Changed amount')).toBeInTheDocument();
    const url = String(f.mock.calls.find(([u]) => String(u).includes('/activities'))?.[0]);
    expect(url).toContain('targetType=DEAL');
    expect(url).toContain('targetId=d1');
    expect(url).toContain('size=50');
  });

  it('legacyNotesShownAsContactNotes', async () => {
    mockFetch(routes([act({ id: 'n1', type: 'LEGACY_NOTE', summary: 'Called twice, no answer' })]));
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openTimeline(user);
    expect(await screen.findByText('Note (from Contacts)')).toBeInTheDocument();
    expect(screen.getByText('Called twice, no answer')).toBeInTheDocument();
  });

  it('logCallPostsAndPrepends', async () => {
    const f = mockFetch(
      routes([act({ id: 'a1', type: 'EMAIL_LOGGED', summary: 'Sent quote' })], {
        [`POST ${BASE}/activities/log`]: {
          status: 200,
          body: act({ id: 'a9', type: 'CALL_LOGGED', summary: 'Spoke to Priya', happenedAt: new Date().toISOString() }),
        },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openTimeline(user);
    await screen.findByText('Sent quote');
    await user.selectOptions(screen.getByLabelText('Type'), 'Call');
    await user.type(screen.getByLabelText('Summary'), 'Spoke to Priya');
    expect(screen.getByText('14 / 2000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log activity' }));
    await waitFor(() =>
      expect(requestTo(f, `POST ${BASE}/activities/log`)?.body).toMatchObject({
        target: { type: 'DEAL', id: 'd1' },
        type: 'CALL',
        summary: 'Spoke to Priya',
      }),
    );
    expect(await screen.findByText('Spoke to Priya')).toBeInTheDocument();
    const titles = screen.getAllByTestId('timeline-title').map((e) => e.textContent);
    expect(titles).toEqual(['Call', 'Email']);
  });

  it('futureTimeRejectedClientSide', async () => {
    const f = mockFetch(routes([]));
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await openTimeline(user);
    await user.type(await screen.findByLabelText('Summary'), 'Later');
    fireEvent.change(screen.getByLabelText('When it happened'), { target: { value: '2999-01-01T10:00' } });
    await user.click(screen.getByRole('button', { name: 'Log activity' }));
    expect(await screen.findByText('Choose a time that has already happened.')).toBeInTheDocument();
    expect(requestTo(f, `POST ${BASE}/activities/log`)).toBeUndefined();
  });
});
