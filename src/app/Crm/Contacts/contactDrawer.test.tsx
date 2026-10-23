import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleCrmContact, sampleDeal } from '../../../test/crm';
import { storeSession } from '../../../test/session';
import { BASE, boardRoutes } from '../../../test/crmBoard';

const SEARCH = `POST ${BASE}/contacts/search`;
const CONTACT = `GET ${BASE}/contacts/c1`;
const phones = [
  { phoneNumberId: 'pn1', number: '919800000001', label: 'Sales', canChat: true },
  { phoneNumberId: 'pn2', number: '919800000002', label: 'Support', canChat: true },
];
const settings = (o = {}) =>
  crmSettings({
    lifecycleStatuses: [
      { key: 'lead', label: 'Lead', color: null, position: 1, active: true, isDefault: true },
      { key: 'customer', label: 'Customer', color: null, position: 2, active: true, isDefault: false },
    ],
    ...o,
  });
const routes = (extra = {}, authorities = ['crm:view', 'crm:edit', 'crm:settings'], s = settings()) =>
  boardRoutes(
    {
      [SEARCH]: { status: 200, body: { items: [sampleCrmContact()], total: 1, page: 0 } },
      [CONTACT]: { status: 200, body: sampleCrmContact({ lifecycleStatus: 'lead', version: 3 }) },
      [`GET ${BASE}/settings`]: { status: 200, body: s },
      [`GET ${BASE}/activities`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      ...extra,
    },
    { authorities, phones },
  );

describe('CRM contact drawer', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lifecycleChangeSavesWithVersion', async () => {
    const f = mockFetch(
      routes({
        [`PUT ${BASE}/contacts/c1`]: { status: 200, body: sampleCrmContact({ lifecycleStatus: 'customer', version: 4 }) },
      }),
    );
    const { user } = renderApp('/crm/contacts/c1');
    await screen.findByRole('heading', { name: 'Priya Shah' });
    await user.selectOptions(await screen.findByLabelText('Lifecycle status'), 'Customer');
    await waitFor(() =>
      expect(requestTo(f, `PUT ${BASE}/contacts/c1`)?.body).toEqual({ lifecycleStatus: 'customer', version: 3 }),
    );
  });

  it('moveChannelHiddenWithoutSettings', async () => {
    mockFetch(routes({}, ['crm:view', 'crm:edit']));
    renderApp('/crm/contacts/c1');
    await screen.findByRole('heading', { name: 'Priya Shah' });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move channel…' })).toBeNull();
  });

  it('moveChannelHiddenWhenSettingOff', async () => {
    mockFetch(routes({}, undefined, settings({ allowChannelMove: false })));
    renderApp('/crm/contacts/c1');
    await screen.findByRole('heading', { name: 'Priya Shah' });
    await screen.findByRole('button', { name: 'Open chat' });
    expect(screen.queryByRole('button', { name: 'Move channel…' })).toBeNull();
  });

  it('moveChannelSendsTargetAndVersion', async () => {
    const f = mockFetch(
      routes({ [`POST ${BASE}/contacts/c1/move-channel`]: { status: 200, body: sampleCrmContact({ version: 4 }) } }),
    );
    const { user } = renderApp('/crm/contacts/c1');
    await user.click(await screen.findByRole('button', { name: 'Move channel…' }));
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText('Move to');
    expect(within(select).queryByText(/919800000001/)).toBeNull();
    await user.selectOptions(select, 'Support (919800000002)');
    await user.type(within(dialog).getByLabelText('Reason'), 'moved team');
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));
    await waitFor(() =>
      expect(requestTo(f, `POST ${BASE}/contacts/c1/move-channel`)?.body).toEqual({
        toPhoneNumberId: 'pn2',
        reason: 'moved team',
        version: 3,
      }),
    );
  });

  it('moveChannelTakenShowsMessage', async () => {
    mockFetch(
      routes({
        [`POST ${BASE}/contacts/c1/move-channel`]: { status: 409, body: { code: 'CHANNEL_TAKEN', message: 'x' } },
      }),
    );
    const { user } = renderApp('/crm/contacts/c1');
    await user.click(await screen.findByRole('button', { name: 'Move channel…' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Move' }));
    expect(await within(dialog).findByText('This person already has a CRM contact on that number.')).toBeInTheDocument();
  });

  it('deletedContactShowsNotice', async () => {
    mockFetch(routes({ [CONTACT]: { status: 200, body: sampleCrmContact({ contactDeleted: true }) } }));
    renderApp('/crm/contacts/c1');
    expect(
      await screen.findByText('This person was deleted from Contacts; the CRM keeps what it knew.'),
    ).toBeInTheDocument();
  });

  it('originLines', async () => {
    mockFetch(
      routes({
        [CONTACT]: {
          status: 200,
          body: sampleCrmContact({
            origin: {
              kind: 'INBOUND_CHAT',
              phoneNumberId: 'pn1',
              chatId: 'ch1',
              firstMessageAt: null,
              capturedBy: { id: 'o1', name: 'Asha Rao' },
            },
            creationTime: '2026-10-01T10:00:00Z',
          }),
        },
      }),
    );
    renderApp('/crm/contacts/c1');
    expect(await screen.findByText(/Captured from a chat by Asha Rao on 1 Oct 2026/)).toBeInTheDocument();
  });

  it('dealsTabListsContactDeals', async () => {
    const f = mockFetch(
      routes({
        [`POST ${BASE}/deals/search`]: {
          status: 200,
          body: { items: [sampleDeal({ id: 'd7', title: 'Bulk order' })], total: 1, page: 0 },
        },
      }),
    );
    const { user } = renderApp('/crm/contacts/c1');
    await screen.findByRole('heading', { name: 'Priya Shah' });
    await user.click(screen.getByRole('tab', { name: 'Deals' }));
    const link = await screen.findByRole('link', { name: 'Bulk order' });
    expect(link).toHaveAttribute('href', '/crm/deals/d7?pipelineId=p1');
    expect(requestTo(f, `POST ${BASE}/deals/search`)?.body).toMatchObject({ crmContactId: 'c1' });
  });
});
