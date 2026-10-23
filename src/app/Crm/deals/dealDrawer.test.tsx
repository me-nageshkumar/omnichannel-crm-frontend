import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleBoard, sampleDeal } from '../../../test/crm';
import { storeSession } from '../../../test/session';
import { BASE, boardRoutes } from '../../../test/crmBoard';

const Probe: React.FunctionComponent = () => {
  const l = useLocation();
  return <output aria-label="Where">{l.pathname + l.search}</output>;
};

const AUTH = ['crm:view', 'crm:edit', 'crm:delete'];
const reasons = [
  { key: 'price', label: 'Too expensive', color: null, position: 1, active: true, isDefault: false },
  { key: 'old', label: 'Retired reason', color: null, position: 2, active: false, isDefault: false },
];
const routes = (extra = {}, authorities = AUTH) =>
  boardRoutes(
    {
      [`GET ${BASE}/deals/d1`]: { status: 200, body: sampleDeal() },
      [`GET ${BASE}/activities`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      [`GET ${BASE}/settings`]: { status: 200, body: crmSettings({ lostReasons: reasons }) },
      ...extra,
    },
    { authorities },
  );

describe('Deal drawer', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opensFromUrlAndShowsDetails', async () => {
    mockFetch(routes());
    renderApp('/crm/deals/d1?pipelineId=p1');
    const title = await screen.findByRole('heading', { name: 'Acme order' });
    expect(title).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Priya Shah' })).toHaveAttribute('href', '/crm/contacts/c1');
    expect(screen.getByText('919800000001')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,500').length).toBeGreaterThan(0);
    expect(screen.getByText('Amount').closest('.pf-v6-c-description-list__group')).toHaveTextContent('₹1,500');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
  });

  it('stageSelectSendsOnlyTheStageAndRefreshesTheBoard', async () => {
    const f = mockFetch(
      routes({ [`POST ${BASE}/deals/d1/move`]: { status: 200, body: sampleDeal({ stageId: 's2', version: 3 }) } }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.selectOptions(screen.getByLabelText('Stage'), 'Proposal');
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/deals/d1/move`)?.body).toEqual({ stageId: 's2' }));
  });

  it('drawerChangeRefetchesBoardAndMovesTheCard', async () => {
    const moved = sampleBoard();
    moved.lanes[0].deals = moved.lanes[0].deals.filter((d) => d.id !== 'd1');
    moved.lanes[1].deals = [sampleDeal({ stageId: 's2', version: 3 }), ...moved.lanes[1].deals];
    let boards = 0;
    const f = mockFetch(
      routes({
        [`GET ${BASE}/deals/board`]: () => ({ status: 200, body: ++boards === 1 ? sampleBoard() : moved }),
        [`POST ${BASE}/deals/d1/move`]: { status: 200, body: sampleDeal({ stageId: 's2', version: 3 }) },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await screen.findByRole('heading', { name: 'Acme order' });
    const lane = (n: string) => screen.getByRole('region', { name: n });
    await waitFor(() => expect(within(lane('New')).getByText('Acme order')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Stage'), 'Proposal');
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(2));
    await waitFor(() => expect(within(lane('Proposal')).getByText('Acme order')).toBeInTheDocument());
    expect(within(lane('New')).queryByText('Acme order')).toBeNull();
  });

  it('deepLinkShowsDealWhenSettingsFailWithoutRemountingBoard', async () => {
    const f = mockFetch(
      routes({ [`GET ${BASE}/settings`]: { status: 500, body: { code: 'INTERNAL', message: 'x' } } }),
    );
    renderApp('/crm/deals/d1?pipelineId=p1');
    expect(await screen.findByRole('heading', { name: 'Acme order' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open chat' })).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Deals board' });
    expect(callsTo(f, `GET ${BASE}/deals/board`)).toBe(1);
  });

  it('closeLostSendsReason', async () => {
    const f = mockFetch(
      routes({ [`POST ${BASE}/deals/d1/close`]: { status: 200, body: sampleDeal({ status: 'LOST', stageId: 's3' }) } }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.click(screen.getByRole('button', { name: 'Close deal' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Lost' }));
    const select = within(dialog).getByLabelText('Lost reason');
    expect(within(select).queryByText('Retired reason')).toBeNull();
    await user.selectOptions(select, 'Too expensive');
    await user.click(within(dialog).getByRole('button', { name: 'Close deal' }));
    await waitFor(() =>
      expect(requestTo(f, `POST ${BASE}/deals/d1/close`)?.body).toEqual({ outcome: 'LOST', lostReason: 'price' }),
    );
  });

  it('openChatNavigatesToInboxChat', async () => {
    mockFetch(
      routes({
        [`GET ${BASE}/contacts/c1/communication`]: {
          status: 200,
          body: { phoneNumberId: 'pn1', number: '919800000001', phone: '919812345678', chatId: 'ch9', canChat: true },
        },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1', <Probe />);
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await waitFor(() => expect(screen.getByLabelText('Where')).toHaveTextContent('/inbox/chats/ch9'));
  });

  it('openChatWithoutChatOpensNewChat', async () => {
    mockFetch(
      routes({
        [`GET ${BASE}/contacts/c1/communication`]: {
          status: 200,
          body: { phoneNumberId: 'pn1', number: '919800000001', phone: '919812345678', chatId: null, canChat: true },
        },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1', <Probe />);
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Where')).toHaveTextContent('/inbox?newChat=pn1&phone=919812345678'),
    );
  });

  it('openChatShowsAlertWhenNumberNotWorked', async () => {
    mockFetch(
      routes({
        [`GET ${BASE}/contacts/c1/communication`]: {
          status: 200,
          body: { phoneNumberId: 'pn1', number: '919800000001', phone: '919812345678', chatId: null, canChat: false },
        },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(
      await screen.findByText("You don't work this WhatsApp number, so the inbox won't open this chat."),
    ).toBeInTheDocument();
  });

  it('deleteNeedsAuthority', async () => {
    mockFetch(routes({}, ['crm:view', 'crm:edit']));
    renderApp('/crm/deals/d1?pipelineId=p1');
    await screen.findByRole('heading', { name: 'Acme order' });
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('deleteConfirmsThenRemoves', async () => {
    const f = mockFetch(routes({ [`DELETE ${BASE}/deals/d1`]: { status: 204 } }));
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1', <Probe />);
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(requestTo(f, `DELETE ${BASE}/deals/d1`)).toBeDefined());
    await waitFor(() => expect(screen.getByLabelText('Where')).toHaveTextContent(/^\/crm\?pipelineId=p1$/));
  });

  it('missingDealShowsUnavailable', async () => {
    mockFetch(
      routes({ [`GET ${BASE}/deals/d1`]: { status: 404, body: { code: 'NOT_FOUND', message: 'No such deal' } } }),
    );
    renderApp('/crm/deals/d1?pipelineId=p1');
    expect(
      await screen.findByText(
        "This deal is not available. It may have been deleted or moved to a pipeline you can't see.",
      ),
    ).toBeInTheDocument();
  });

  const CONFLICT = { status: 409, body: { code: 'VERSION_CONFLICT', message: 'x' } };

  it('editConflictReloadsTheDealAndReopenSendsTheFreshVersion', async () => {
    const get = vi
      .fn()
      .mockReturnValueOnce({ status: 200, body: sampleDeal({ version: 2 }) })
      .mockReturnValue({ status: 200, body: sampleDeal({ version: 5 }) });
    const put = vi.fn().mockReturnValueOnce(CONFLICT).mockReturnValue({ status: 200, body: sampleDeal({ version: 6 }) });
    const f = mockFetch(routes({ [`GET ${BASE}/deals/d1`]: () => get(), [`PUT ${BASE}/deals/d1`]: () => put() }));
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    let dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await within(dialog).findByText(/Someone else changed this deal/);
    expect(requestTo(f, `PUT ${BASE}/deals/d1`)?.body).toMatchObject({ version: 2 });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/deals/d1`, 1)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/deals/d1`, 1)?.body).toMatchObject({ version: 5 });
  });

  it('stageSelectConflictReloadsTheDeal', async () => {
    const f = mockFetch(routes({ [`POST ${BASE}/deals/d1/move`]: CONFLICT }));
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.selectOptions(screen.getByLabelText('Stage'), 'Proposal');
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/deals/d1`)).toBe(2));
  });

  it('moveErrorOfOneDealIsNotShownOnAnother', async () => {
    mockFetch(
      routes({
        [`GET ${BASE}/deals/d2`]: { status: 200, body: sampleDeal({ id: 'd2', title: 'Globex renewal' }) },
        [`POST ${BASE}/deals/d1/move`]: { status: 500, body: { code: 'BOOM', message: 'Boom happened' } },
      }),
    );
    let go: (to: string) => void = () => undefined;
    const Nav = (): null => {
      go = useNavigate();
      return null;
    };
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1', <Nav />);
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.selectOptions(screen.getByLabelText('Stage'), 'Proposal');
    expect((await screen.findAllByText(/Boom happened/)).length).toBeGreaterThan(0);
    act(() => go('/crm/deals/d2?pipelineId=p1'));
    await screen.findByRole('heading', { name: 'Globex renewal' });
    expect(screen.queryByText(/Boom happened/)).toBeNull();
  });
});
