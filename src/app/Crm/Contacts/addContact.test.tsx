import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleCrmContact } from '../../../test/crm';
import { BRAND_A, WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import type { CrmPhone, CrmStatus } from '@app/api/crm';

const ADD = `POST ${BASE}/contacts/add`;
const HOST_SEARCH = 'POST /api/workspaces/w1/contacts/search';
const phones: CrmPhone[] = [
  { phoneNumberId: 'pn1', number: '919800000001', label: 'Sales', canChat: true },
  { phoneNumberId: 'pn2', number: '919800000002', label: 'Support', canChat: true },
  { phoneNumberId: 'pn3', number: '919800000003', label: 'Elsewhere', canChat: false },
];
const asha = { id: 'k9', name: 'Asha Rao', phone: '919811122233' };
const added = sampleCrmContact({ id: 'c9', contactId: 'k9', name: 'Asha Rao' });
const hostPage = (items: object[] = [asha]) => ({ status: 200, body: { items, total: items.length, page: 0 } });
const routes = (extra = {}, status: Partial<CrmStatus> = {}) =>
  boardRoutes(
    {
      [`POST ${BASE}/contacts/search`]: { status: 200, body: { items: [sampleCrmContact()], total: 1, page: 0 } },
      [`GET ${BASE}/contacts/c9`]: { status: 200, body: added },
      [`GET ${BASE}/activities`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
      [HOST_SEARCH]: hostPage(),
      ...extra,
    },
    { phones, ...status },
  );

async function chooseAsha(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Add contact' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add contact' });
  await user.type(within(dialog).getByRole('textbox', { name: 'Search contacts' }), 'ash');
  const select = within(dialog).getByRole('combobox', { name: 'Contact' });
  await within(select).findByRole('option', { name: 'Asha Rao (919811122233)' });
  await user.selectOptions(select, 'Asha Rao (919811122233)');
  return dialog;
}

describe('Add contact on the CRM Contacts page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('addsAChannelContactOnTheChosenNumberAndOpensIt', async () => {
    const f = mockFetch(routes({ [ADD]: { status: 200, body: { contact: added, created: true } } }));
    const { user } = renderApp('/crm/contacts');
    const dialog = await chooseAsha(user);
    expect(requestTo(f, HOST_SEARCH)?.body).toMatchObject({ filter: { q: 'ash' } });
    await user.selectOptions(within(dialog).getByLabelText(/Channel number/), 'Support (919800000002)');
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add contact' })).toBeNull());
    expect(requestTo(f, ADD)?.body).toEqual({ contactId: 'k9', channelAccountId: 'pn2' });
    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, `POST ${BASE}/contacts/search`)).toBeGreaterThan(1));
    expect(screen.queryByText(/already in the CRM/)).toBeNull();
  });

  it('opensTheContactAlreadyOnThatNumberAndSaysSo', async () => {
    mockFetch(routes({ [ADD]: { status: 200, body: { contact: added, created: false } } }));
    const { user } = renderApp('/crm/contacts');
    const dialog = await chooseAsha(user);
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    expect(await screen.findByText('Asha Rao is already in the CRM.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Close Info alert/ }));
    await waitFor(() => expect(screen.queryByText('Asha Rao is already in the CRM.')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
  });

  it('offersOnlyNumbersTheUserCanChatFrom', async () => {
    mockFetch(routes());
    const { user } = renderApp('/crm/contacts');
    await user.click(await screen.findByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add contact' });
    const options = within(within(dialog).getByLabelText(/Channel number/)).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Sales (919800000001)', 'Support (919800000002)']);
  });

  it('cannotAddBeforeAContactIsChosen', async () => {
    const f = mockFetch(routes());
    const { user } = renderApp('/crm/contacts');
    await user.click(await screen.findByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add contact' });
    expect(within(dialog).getByRole('button', { name: 'Add contact' })).toBeDisabled();
    expect(callsTo(f, HOST_SEARCH)).toBe(0);
  });

  it('dropsTheChoiceWhenTheSearchChanges', async () => {
    mockFetch(routes());
    const { user } = renderApp('/crm/contacts');
    const dialog = await chooseAsha(user);
    const add = within(dialog).getByRole('button', { name: 'Add contact' });
    expect(add).toBeEnabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Search contacts' }), 'x');
    expect(add).toBeDisabled();
  });

  it('showsAContactWithAHiddenNumberByName', async () => {
    mockFetch(routes({ [HOST_SEARCH]: hostPage([{ id: 'k8', name: 'Hidden One', phone: null }]) }));
    const { user } = renderApp('/crm/contacts');
    await user.click(await screen.findByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add contact' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Search contacts' }), 'hid');
    expect(await within(dialog).findByRole('option', { name: 'Hidden One' })).toBeInTheDocument();
  });

  it('saysWhenNothingMatches', async () => {
    mockFetch(routes({ [HOST_SEARCH]: hostPage([]) }));
    const { user } = renderApp('/crm/contacts');
    await user.click(await screen.findByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add contact' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Search contacts' }), 'zzz');
    expect(await within(dialog).findByRole('option', { name: 'No contacts match' })).toBeInTheDocument();
  });

  it('showsAFailedSearch', async () => {
    mockFetch(routes({ [HOST_SEARCH]: { status: 500, body: { message: 'Contacts are unavailable' } } }));
    const { user } = renderApp('/crm/contacts');
    await user.click(await screen.findByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add contact' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Search contacts' }), 'ash');
    expect(await within(dialog).findByRole('option', { name: 'Search failed' })).toBeInTheDocument();
  });

  it('showsAFailedAdd', async () => {
    const f = mockFetch(routes({ [ADD]: { status: 404, body: { code: 'NOT_FOUND' } } }));
    const { user } = renderApp('/crm/contacts');
    const dialog = await chooseAsha(user);
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));
    await waitFor(() => expect(within(dialog).getByRole('heading', { name: /^Danger alert/ })).toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Add contact' })).toBeInTheDocument();
    expect(callsTo(f, ADD)).toBe(1);
  });

  it('isHiddenWithoutEdit', async () => {
    mockFetch(routes({}, { authorities: ['crm:view'] }));
    renderApp('/crm/contacts');
    await screen.findByRole('link', { name: 'Priya Shah' });
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
  });

  it('isHiddenForAUserLimitedToPipelines', async () => {
    mockFetch(routes({}, { pipelineAccess: ['p1'] }));
    renderApp('/crm/contacts');
    await screen.findByRole('link', { name: 'Priya Shah' });
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
  });

  it('isHiddenWithoutSeeingContacts', async () => {
    const noContacts = { ...BRAND_A, authorities: BRAND_A.authorities.filter((a) => a !== 'contact:view') };
    mockFetch({ ...routes(), ...meAs({ ...WORKSPACE_MANAGER, workspaces: [noContacts] }) });
    renderApp('/crm/contacts');
    await screen.findByRole('link', { name: 'Priya Shah' });
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
  });

  it('namesItInTheEmptyStateOnlyForThoseWhoCanUseIt', async () => {
    const none = { [`POST ${BASE}/contacts/search`]: { status: 200, body: { items: [], total: 0, page: 0 } } };
    mockFetch(routes(none));
    const first = renderApp('/crm/contacts');
    expect(await screen.findByText(/Add one from your contacts/)).toBeInTheDocument();
    first.unmount();
    vi.unstubAllGlobals();
    mockFetch(routes(none, { pipelineAccess: ['p1'] }));
    renderApp('/crm/contacts');
    expect(
      await screen.findByText('No CRM contacts yet. Capture one from the inbox or add one from Pipelines.'),
    ).toBeInTheDocument();
  });
});
