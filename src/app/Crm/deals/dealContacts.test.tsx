import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { gate } from '../../../test/gate';
import { crmSettings, sampleCrmContact, sampleDeal, sampleDealContact } from '../../../test/crm';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import { storeSession } from '../../../test/session';

const Probe: React.FunctionComponent = () => {
  const l = useLocation();
  return <output aria-label="Where">{l.pathname + l.search}</output>;
};

const AUTH = ['crm:view', 'crm:edit', 'crm:delete'];
const DAVE = sampleCrmContact({
  id: 'c2',
  firstName: 'Dave',
  lastName: 'Ray',
  name: 'Dave Ray',
  phone: '919822222201',
});
const MIRA = sampleCrmContact({ id: 'c3', firstName: 'Mira', lastName: null, name: 'Mira', phone: '919822222202' });
const search = (items = [sampleCrmContact(), DAVE, MIRA]) => ({
  status: 200,
  body: { items, total: items.length, page: 0 },
});
const LINKED = [
  sampleDealContact(),
  sampleDealContact({ id: 'c2', name: 'Dave Ray', phone: '919822222201', jobTitle: 'Buyer', primary: false }),
];

const routes = (extra = {}) =>
  boardRoutes(
    {
      [`GET ${BASE}/deals/d1`]: { status: 200, body: sampleDeal({ crmContactIds: ['c1', 'c2'] }) },
      [`GET ${BASE}/deals/d1/contacts`]: { status: 200, body: LINKED },
      [`GET ${BASE}/activities`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
      [`POST ${BASE}/contacts/search`]: search(),
      [`PUT ${BASE}/deals/d1`]: { status: 200, body: sampleDeal() },
      [`POST ${BASE}/deals`]: { status: 200, body: sampleDeal({ id: 'd9' }) },
      ...extra,
    },
    { authorities: AUTH },
  );

async function openEdit(extra = {}) {
  const f = mockFetch(routes(extra));
  const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
  await screen.findByRole('heading', { name: 'Acme order' });
  await user.click(screen.getByRole('button', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
  return { f, user, dialog };
}

async function openCreate(extra = {}) {
  const f = mockFetch(routes(extra));
  const { user } = renderApp('/crm');
  await screen.findByText('Acme order');
  await user.click(screen.getByRole('button', { name: 'New deal' }));
  const dialog = await screen.findByRole('dialog', { name: 'New deal' });
  await user.type(within(dialog).getByLabelText(/^Title/), 'Big order');
  return { f, user, dialog };
}

describe('Contacts on a deal', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('tabListsContactsPrimaryFirst', async () => {
    mockFetch(routes());
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await user.click(await screen.findByRole('tab', { name: 'Contacts' }));
    const rows = await screen.findAllByRole('listitem');
    expect(within(rows[0]).getByRole('link', { name: 'Priya Shah' })).toHaveAttribute('href', '/crm/contacts/c1');
    expect(within(rows[0]).getByText('Primary')).toBeInTheDocument();
    expect(within(rows[1]).getByRole('link', { name: 'Dave Ray' })).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Primary')).toBeNull();
    expect(within(rows[1]).getByText(/Buyer/)).toBeInTheDocument();
  });

  it('tabRefreshesAfterAnEdit', async () => {
    let saved = false;
    mockFetch(
      routes({
        [`GET ${BASE}/deals/d1/contacts`]: () => ({ status: 200, body: saved ? [sampleDealContact()] : LINKED }),
        [`PUT ${BASE}/deals/d1`]: () => {
          saved = true;
          return { status: 200, body: sampleDeal({ crmContactIds: ['c1'], version: 3 }) };
        },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await user.click(await screen.findByRole('tab', { name: 'Contacts' }));
    expect(await screen.findByRole('link', { name: 'Dave Ray' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    await user.click(await within(dialog).findByRole('button', { name: 'Remove Dave Ray' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Dave Ray' })).toBeNull());
    expect(screen.getByRole('link', { name: 'Priya Shah' })).toBeInTheDocument();
  });

  it('chatOpensThatContactsOwnChat', async () => {
    const f = mockFetch(
      routes({
        [`GET ${BASE}/contacts/c2/communication`]: {
          status: 200,
          body: { phoneNumberId: 'pn1', number: '919800000001', phone: '919822222201', chatId: 'chat7', canChat: true },
        },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1', <Probe />);
    await user.click(await screen.findByRole('tab', { name: 'Contacts' }));
    await user.click(await screen.findByRole('button', { name: 'Open chat with Dave Ray' }));
    await waitFor(() => expect(screen.getByLabelText('Where')).toHaveTextContent('/inbox/chats/chat7'));
    const asked = f.mock.calls.map(([u]) => String(u)).find((u) => u.includes('/contacts/c2/communication'));
    expect(asked).not.toContain('phoneNumberId');
  });

  it('pickerOffersOnlyTheDealsChannelAccount', async () => {
    const { f, dialog } = await openEdit();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Remove Dave Ray' })).toBeInTheDocument());
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/contacts/search`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/contacts/search`)?.body.channelAccountId).toBe('pn1');
  });

  it('addsAndRemovesOtherContactsOnEdit', async () => {
    const { f, user, dialog } = await openEdit();
    await user.click(await within(dialog).findByRole('button', { name: 'Remove Dave Ray' }));
    await within(dialog).findByRole('option', { name: 'Mira (919822222202)' });
    await user.selectOptions(within(dialog).getByLabelText('Other contacts'), 'c3');
    expect(within(dialog).getByRole('button', { name: /Remove Mira/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: 'Mira (919822222202)' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/deals/d1`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/deals/d1`)?.body.crmContactIds).toEqual(['c1', 'c3']);
  });

  it('theTwoContactSearchesHaveTheirOwnNames', async () => {
    const { user, dialog } = await openCreate();
    await within(dialog).findByRole('option', { name: 'Priya Shah (919812345678)' });
    await user.selectOptions(within(dialog).getByLabelText(/^Primary contact/), 'c1');
    expect(within(dialog).getAllByRole('textbox', { name: 'Search contacts' })).toHaveLength(1);
    expect(within(dialog).getByRole('textbox', { name: 'Search other contacts' })).toBeInTheDocument();
  });

  it('saysSoWhileTheEditFormsContactsLoad', async () => {
    const f = mockFetch(routes());
    const key = `GET ${BASE}/deals/d1/contacts`;
    const held = [gate(f, key, 1), gate(f, key, 2)];
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await screen.findByRole('heading', { name: 'Acme order' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit deal' });
    expect(await within(dialog).findByText("Loading this deal's contacts…")).toBeInTheDocument();
    held.forEach((h) => h.release());
    await waitFor(() => expect(within(dialog).queryByText("Loading this deal's contacts…")).toBeNull());
    expect(await within(dialog).findByRole('button', { name: /Remove Dave Ray/ })).toBeInTheDocument();
  });

  it('failedContactsLoadLeavesThemAlone', async () => {
    const { f, user, dialog } = await openEdit({
      [`GET ${BASE}/deals/d1/contacts`]: { status: 500, body: { code: 'INTERNAL', message: 'Nope' } },
    });
    expect(
      await within(dialog).findByText("Couldn't load this deal's contacts. They stay as they are."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Other contacts')).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/deals/d1`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/deals/d1`)?.body).not.toHaveProperty('crmContactIds');
  });

  it('disabledUntilPrimaryChosen', async () => {
    const { user, dialog } = await openCreate();
    expect(within(dialog).getByLabelText('Other contacts')).toBeDisabled();
    expect(within(dialog).getByText('Choose the primary contact first.')).toBeInTheDocument();
    await within(dialog).findByRole('option', { name: 'Priya Shah (919812345678)' });
    await user.selectOptions(within(dialog).getByLabelText(/^Primary contact/), 'c1');
    await waitFor(() => expect(within(dialog).getByLabelText('Other contacts')).toBeEnabled());
  });

  it('changingPrimaryClearsOtherContacts', async () => {
    const { user, dialog } = await openCreate();
    await within(dialog).findByRole('option', { name: 'Priya Shah (919812345678)' });
    await user.selectOptions(within(dialog).getByLabelText(/^Primary contact/), 'c1');
    await within(dialog).findAllByRole('option', { name: 'Dave Ray (919822222201)' });
    await user.selectOptions(within(dialog).getByLabelText('Other contacts'), 'c2');
    expect(within(dialog).getByRole('button', { name: /Remove Dave Ray/ })).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText(/^Primary contact/), 'c3');
    expect(within(dialog).queryByRole('button', { name: /Remove Dave Ray/ })).toBeNull();
  });

  it('createSendsPrimaryFirst', async () => {
    const { f, user, dialog } = await openCreate();
    await within(dialog).findByRole('option', { name: 'Priya Shah (919812345678)' });
    await user.selectOptions(within(dialog).getByLabelText(/^Primary contact/), 'c1');
    await within(dialog).findAllByRole('option', { name: 'Dave Ray (919822222201)' });
    await user.selectOptions(within(dialog).getByLabelText('Other contacts'), 'c2');
    await user.click(within(dialog).getByRole('button', { name: 'Create deal' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/deals`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/deals`)?.body.crmContactIds).toEqual(['c1', 'c2']);
  });

  it('channelMismatchShowsUnderTheField', async () => {
    const { user, dialog } = await openEdit({
      [`PUT ${BASE}/deals/d1`]: { status: 409, body: { code: 'CHANNEL_MISMATCH', message: 'Other number' } },
    });
    await within(dialog).findByRole('button', { name: 'Remove Dave Ray' });
    await user.click(within(dialog).getByRole('button', { name: 'Save deal' }));
    expect(await within(dialog).findByText("All of a deal's contacts must be on the same number.")).toBeInTheDocument();
  });

  it('capAt49Others', async () => {
    const many = [
      sampleDealContact(),
      ...Array.from({ length: 49 }, (_u, i) => sampleDealContact({ id: `x${i}`, name: `P${i}`, primary: false })),
    ];
    const { dialog } = await openEdit({ [`GET ${BASE}/deals/d1/contacts`]: { status: 200, body: many } });
    expect(await within(dialog).findByText('At most 49 other contacts.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Other contacts')).toBeDisabled();
  });
});
