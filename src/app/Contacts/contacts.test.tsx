import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, TEAM_LEAD, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill, rowWith } from '../../test/admin';
import { attribute, contact, label } from '../../test/contacts';
import type { CurrentUser } from '@app/api/users';

const B = '/api/workspaces/w1';
const VIP = label({ id: 'l1', name: 'VIP', color: 'purple' });
const LEAD = label({ id: 'l2', name: 'Lead', color: 'blue' });
const CITY = attribute({ id: 'a1', name: 'City' });
const ASHA = contact({
  id: 'c1',
  name: 'Asha Rao',
  phone: '919900000001',
  labels: ['l1'],
  attributes: { a1: 'Jaipur' },
  lastMessageAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
});
const HIDDEN = contact({ id: 'c2', name: 'Meena', numberHidden: true, source: 'IMPORT' });
const NOTE = {
  id: 'n1',
  contactId: 'c1',
  text: 'Prefers morning calls',
  createdBy: { username: 'meera', name: 'Meera Manager' },
  creationTime: '2026-10-20T09:30:00Z',
  lastUpdateTime: '2026-10-20T09:30:00Z',
  mine: true,
};
const page = (items: unknown[], total = items.length, n = 0) => ({ status: 200, body: { items, total, page: n } });

function routes(user: CurrentUser = WORKSPACE_MANAGER, extra = {}) {
  return {
    ...meAs(user),
    [`POST ${B}/contacts/search`]: page([ASHA, HIDDEN]),
    [`GET ${B}/contact-labels`]: { status: 200, body: [VIP, LEAD] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [CITY] },
    [`GET ${B}/contacts/c1`]: { status: 200, body: ASHA },
    [`GET ${B}/contacts/c1/notes`]: { status: 200, body: [NOTE] },
    ...extra,
  };
}

describe('contacts page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsContacts', async () => {
    mockFetch(routes());
    renderApp('/contacts');
    const row = await rowWith('Asha Rao');
    expect(within(row).getByText('+919900000001')).toBeVisible();
    expect(within(row).getByText('VIP')).toBeVisible();
    expect(within(row).getByText('Chat')).toBeVisible();
    expect(within(row).getByText('2 hours ago')).toBeVisible();
  });

  it('showsEmptyMessage', async () => {
    mockFetch(routes(WORKSPACE_MANAGER, { [`POST ${B}/contacts/search`]: page([]) }));
    renderApp('/contacts');
    expect(await screen.findByText('No contacts match.')).toBeVisible();
  });

  it('hiddenNumberShown', async () => {
    mockFetch(routes());
    renderApp('/contacts');
    expect(within(await rowWith('Meena')).getByText('Number hidden')).toBeVisible();
  });

  it('searchSendsQ', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.type(screen.getByRole('textbox', { name: 'Search contacts' }), 'asha');
    await waitFor(() => {
      const bodies = [0, 1, 2].map((n) => requestTo(fetch, `POST ${B}/contacts/search`, n)?.body);
      expect(bodies.some((b) => b?.filter?.q === 'asha' && b.page === 0)).toBe(true);
    });
  });

  it('sortSendsSort', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Sort: Last message' }));
    await user.click(screen.getByRole('option', { name: 'Name' }));
    await waitFor(() => expect(requestTo(fetch, `POST ${B}/contacts/search`, 1)?.body.sort).toBe('NAME'));
  });

  it('paging', async () => {
    const fetch = mockFetch(routes(WORKSPACE_MANAGER, { [`POST ${B}/contacts/search`]: page([ASHA], 120) }));
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
    await waitFor(() => expect(requestTo(fetch, `POST ${B}/contacts/search`, 1)?.body.page).toBe(1));
  });

  it('openDetailShowsLabelsAttributesNotes', async () => {
    mockFetch(routes());
    const { user } = renderApp('/contacts');
    await user.click(await screen.findByRole('link', { name: 'Asha Rao' }));
    expect(await screen.findByText('Prefers morning calls')).toBeVisible();
    expect(screen.getByText('VIP')).toBeVisible();
    expect(screen.getByText('Jaipur')).toBeVisible();
    expect(screen.getByText('City')).toBeVisible();
    expect(screen.getByText('+919900000001')).toBeVisible();
  });

  it('agentTagsAndAddsNote', async () => {
    const tagged = { ...ASHA, labels: ['l1', 'l2'] };
    const newNote = { ...NOTE, id: 'n2', text: 'Called back', creationTime: '2026-10-20T11:00:00Z' };
    const fetch = mockFetch(
      routes(AGENT_IN_BRAND, {
        [`POST ${B}/contacts/c1/labels/l2`]: { status: 200, body: tagged },
        [`POST ${B}/contacts/c1/notes`]: { status: 201, body: newNote },
      }),
    );
    const { user } = renderApp('/contacts/c1');
    await user.click(await screen.findByRole('button', { name: 'Add label' }));
    await user.click(await screen.findByRole('option', { name: 'Lead' }));
    await waitFor(() => expect(callsTo(fetch, `POST ${B}/contacts/c1/labels/l2`)).toBe(1));
    expect(await screen.findByText('Lead')).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'New note' }), 'Called back');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Called back')).toBeVisible();
    expect(requestTo(fetch, `POST ${B}/contacts/c1/notes`)?.body).toEqual({ text: 'Called back' });
  });

  it('agentRemovesLabel', async () => {
    const fetch = mockFetch(
      routes(AGENT_IN_BRAND, { [`DELETE ${B}/contacts/c1/labels/l1`]: { status: 200, body: { ...ASHA, labels: [] } } }),
    );
    const { user } = renderApp('/contacts/c1');
    await user.click(await screen.findByRole('button', { name: 'Remove VIP' }));
    await waitFor(() => expect(callsTo(fetch, `DELETE ${B}/contacts/c1/labels/l1`)).toBe(1));
    await screen.findByText('No labels.');
  });

  it('agentSeesViewTagAndNotesOnly', async () => {
    mockFetch(routes(AGENT_IN_BRAND));
    renderApp('/contacts/c1');
    await screen.findByText('Prefers morning calls');
    expect(screen.getByRole('button', { name: 'Add label' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add note' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete contact' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeVisible();
  });

  it('agentCannotDeleteOthersNote', async () => {
    mockFetch(
      routes(AGENT_IN_BRAND, {
        [`GET ${B}/contacts/c1/notes`]: { status: 200, body: [{ ...NOTE, mine: false }] },
      }),
    );
    renderApp('/contacts/c1');
    await screen.findByText('Prefers morning calls');
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit note' })).toBeNull();
  });

  it('agentSeesNoAddContact', async () => {
    mockFetch(routes(AGENT_IN_BRAND));
    renderApp('/contacts');
    await rowWith('Asha Rao');
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
  });

  it('teamLeadEditsAttribute', async () => {
    const fetch = mockFetch(
      routes(TEAM_LEAD, {
        [`PUT ${B}/contacts/c1`]: { status: 200, body: { ...ASHA, attributes: { a1: 'Delhi' } } },
      }),
    );
    const { user } = renderApp('/contacts/c1');
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await fill(user, 'City', 'Delhi');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Delhi')).toBeVisible();
    // The name was not touched, so it is not sent (it would count as typed by a person).
    expect(requestTo(fetch, `PUT ${B}/contacts/c1`)?.body).toEqual({ attributes: { a1: 'Delhi' } });
  });

  it('addContactValidatesPhone', async () => {
    const fetch = mockFetch(routes(WORKSPACE_MANAGER, { [`POST ${B}/contacts`]: { status: 201, body: ASHA } }));
    const { user } = renderApp('/contacts');
    await user.click(await screen.findByRole('button', { name: 'Add contact' }));
    await fill(user, 'Phone number', '12345');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Use 8 to 15 digits, country code first.')).toBeVisible();
    expect(callsTo(fetch, `POST ${B}/contacts`)).toBe(0);
    await fill(user, 'Phone number', '+91 99000-00009');
    await fill(user, 'Name', 'New One');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(callsTo(fetch, `POST ${B}/contacts`)).toBe(1));
    expect(requestTo(fetch, `POST ${B}/contacts`)?.body).toEqual({ name: 'New One', phone: '919900000009' });
  });

  it('addContactDuplicatePhoneShowsError', async () => {
    mockFetch(
      routes(WORKSPACE_MANAGER, {
        [`POST ${B}/contacts`]: { status: 409, body: { code: 'DUPLICATE', field: 'phone' } },
      }),
    );
    const { user } = renderApp('/contacts');
    await user.click(await screen.findByRole('button', { name: 'Add contact' }));
    await fill(user, 'Phone number', '919900000001');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('A contact with this number already exists.')).toBeVisible();
  });

  it('deleteContact', async () => {
    const fetch = mockFetch(routes(WORKSPACE_MANAGER, { [`DELETE ${B}/contacts/c1`]: { status: 204 } }));
    const { user } = renderApp('/contacts/c1');
    await user.click(await screen.findByRole('button', { name: 'Delete contact' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Their notes are deleted too\. This cannot be undone\./)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(callsTo(fetch, `DELETE ${B}/contacts/c1`)).toBe(1));
    expect(await screen.findByRole('heading', { name: 'Contacts' })).toBeVisible();
  });
});
