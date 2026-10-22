import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { LocationProbe, renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, TEAM_LEAD, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { fill, rowWith } from '../../test/admin';
import { advancedFilter, attribute, contact, label, savedFilter } from '../../test/contacts';
import type { CurrentUser } from '@app/api/users';

const B = '/api/workspaces/w1';
const SEARCH = `POST ${B}/contacts/search`;
const COUNT = `POST ${B}/contacts/count`;
const BULK = `POST ${B}/contacts/bulk`;
const VIP = label({ id: 'l1', name: 'VIP', color: 'purple' });
const LEAD = label({ id: 'l2', name: 'Lead', color: 'blue' });
const CITY = attribute({ id: 'a1', name: 'City' });
const ASHA = contact({ id: 'c1', name: 'Asha Rao', phone: '919900000001', labels: ['l1'] });
const RAVI = contact({ id: 'c2', name: 'Ravi Shah', phone: '919900000002' });
const SAVED = savedFilter({ id: 'f1', name: 'Jaipur VIPs', filter: { labelsAny: ['l1'] } });
const ADV = advancedFilter({ id: 'f2', name: 'Lapsed VIPs' });
const page = (items: unknown[], total = items.length, n = 0) => ({ status: 200, body: { items, total, page: n } });

function routes(user: CurrentUser = WORKSPACE_MANAGER, extra = {}) {
  return {
    ...meAs(user),
    [SEARCH]: page([ASHA, RAVI]),
    [`GET ${B}/contact-labels`]: { status: 200, body: [VIP, LEAD] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [CITY] },
    [`GET ${B}/contact-filters`]: { status: 200, body: [SAVED, ADV] },
    ...extra,
  };
}
const lastSearch = (fetch: ReturnType<typeof mockFetch>) => {
  const n = fetch.mock.calls.filter(
    ([i, init]) => String(i).endsWith('/contacts/search') && init?.method === 'POST',
  ).length;
  return requestTo(fetch, SEARCH, n - 1)?.body;
};
const pick = async (user: ReturnType<typeof renderApp>['user'], name: string) => {
  await user.click(screen.getByRole('button', { name: /^Saved filter: / }));
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${name}`) }));
};
const openFilters = async (user: ReturnType<typeof renderApp>['user']) => {
  await rowWith('Asha Rao');
  await user.click(screen.getByRole('button', { name: 'Filters' }));
};

describe('contact filters and bulk actions', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('filterPanelSendsFilter', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: 'Chat' }));
    await user.click(screen.getByRole('checkbox', { name: 'Number hidden only' }));
    await user.click(screen.getByRole('button', { name: /^Any of these labels/ }));
    await user.click(await screen.findByRole('checkbox', { name: /VIP/ }));
    await user.click(screen.getByRole('button', { name: 'Add attribute condition' }));
    await user.selectOptions(screen.getByLabelText('Attribute'), 'City');
    await user.selectOptions(screen.getByLabelText('Condition'), 'EQUALS');
    await user.type(screen.getByLabelText('Value'), 'Jaipur');
    await waitFor(() =>
      expect(lastSearch(fetch).filter).toEqual({
        source: ['CHAT'],
        numberHidden: true,
        labelsAny: ['l1'],
        attributes: [{ attributeId: 'a1', op: 'EQUALS', value: 'Jaipur' }],
      }),
    );
  });

  it('doNotContactFilterIsTriState', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await openFilters(user);
    const select = screen.getByLabelText('Do not contact');
    await user.selectOptions(select, 'Only');
    await waitFor(() => expect(lastSearch(fetch).filter?.doNotContact).toBe(true));
    await user.selectOptions(select, 'Exclude');
    await waitFor(() => expect(lastSearch(fetch).filter?.doNotContact).toBe(false));
    await user.selectOptions(select, 'Any');
    await waitFor(() => expect(lastSearch(fetch).filter ?? {}).not.toHaveProperty('doNotContact'));
  });

  const attributeConditionsSent = (fetch: ReturnType<typeof mockFetch>) =>
    Array.from({ length: callsTo(fetch, SEARCH) }, (_v, n) => requestTo(fetch, SEARCH, n)?.body.filter?.attributes);

  it('incompleteAttributeRowIsNotSent', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await openFilters(user);
    const before = callsTo(fetch, SEARCH);
    await user.click(screen.getByRole('button', { name: 'Add attribute condition' }));
    await user.selectOptions(screen.getByLabelText('Attribute'), 'City');
    await new Promise((r) => setTimeout(r, 500));
    expect(attributeConditionsSent(fetch).every((a) => a === undefined)).toBe(true);
    expect(callsTo(fetch, SEARCH)).toBe(before);
    // "has a value" needs no value, so the row is complete.
    await user.selectOptions(screen.getByLabelText('Condition'), 'EXISTS');
    await waitFor(() =>
      expect(lastSearch(fetch).filter).toEqual({ attributes: [{ attributeId: 'a1', op: 'EXISTS' }] }),
    );
  });

  it('attributeValueIsDebounced', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await openFilters(user);
    await user.click(screen.getByRole('button', { name: 'Add attribute condition' }));
    await user.selectOptions(screen.getByLabelText('Attribute'), 'City');
    await user.type(screen.getByLabelText('Value'), 'Jaipur');
    await waitFor(() =>
      expect(lastSearch(fetch).filter).toEqual({ attributes: [{ attributeId: 'a1', op: 'EQUALS', value: 'Jaipur' }] }),
    );
    const sent = attributeConditionsSent(fetch).filter((a) => a !== undefined);
    expect(sent).toHaveLength(1);
  });

  it('savedFilterApplies', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Saved filter: None' }));
    await user.click(await screen.findByRole('option', { name: 'Jaipur VIPs' }));
    await waitFor(() => expect(lastSearch(fetch)).toMatchObject({ filterId: 'f1' }));
    expect(lastSearch(fetch).filter).toBeUndefined();
  });

  it('saveFilter', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [`POST ${B}/contact-filters`]: {
          status: 201,
          body: savedFilter({ id: 'f2', name: 'Chat people', filter: { source: ['CHAT'] } }),
        },
      }),
    );
    const { user } = renderApp('/contacts');
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: 'Chat' }));
    await user.click(screen.getByRole('button', { name: 'Save filter' }));
    await fill(user, 'Filter name', 'Chat people');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saved filter: Chat people' })).toBeVisible();
    expect(requestTo(fetch, `POST ${B}/contact-filters`)?.body).toEqual({
      name: 'Chat people',
      filter: { source: ['CHAT'] },
    });
  });

  it('deleteSavedFilter', async () => {
    const fetch = mockFetch(routes(WORKSPACE_MANAGER, { [`DELETE ${B}/contact-filters/f1`]: { status: 204 } }));
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Saved filter: None' }));
    await user.click(await screen.findByRole('option', { name: 'Jaipur VIPs' }));
    await user.click(screen.getByRole('button', { name: 'Delete filter' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('button', { name: 'Saved filter: None' })).toBeVisible();
    expect(callsTo(fetch, `DELETE ${B}/contact-filters/f1`)).toBe(1);
  });

  it('agentCannotSaveFilterOrSelect', async () => {
    mockFetch(routes(AGENT_IN_BRAND));
    const { user } = renderApp('/contacts');
    await openFilters(user);
    expect(screen.queryByRole('button', { name: 'Save filter' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Saved filter: None' })).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: 'Select row 0' })).toBeNull();
  });

  it('bulkOnSelectedIdsSendsIds', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [COUNT]: { status: 200, body: { count: 1 } },
        [BULK]: { status: 200, body: { matched: 1, changed: 1 } },
      }),
    );
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('checkbox', { name: 'Select row 0' }));
    expect(screen.getByText('1 selected')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add labels' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Lead' }));
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(dialog).findByText('Add labels to 1 contact?')).toBeVisible();
    expect(requestTo(fetch, COUNT)?.body).toEqual({ selection: { ids: ['c1'] } });
    await user.click(within(dialog).getByRole('button', { name: 'Add labels' }));
    await waitFor(() => expect(callsTo(fetch, BULK)).toBe(1));
    expect(requestTo(fetch, BULK)?.body).toEqual({
      selection: { ids: ['c1'] },
      action: 'ADD_LABELS',
      labelIds: ['l2'],
    });
    expect(await screen.findByText('Updated 1 of 1 contacts.')).toBeVisible();
    expect(screen.queryByText('1 selected')).toBeNull();
  });

  it('bulkAllMatchingSendsFilter', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [SEARCH]: page([ASHA, RAVI], 1234),
        [COUNT]: { status: 200, body: { count: 1234 } },
        [BULK]: { status: 200, body: { matched: 1234, changed: 1200 } },
      }),
    );
    const { user } = renderApp('/contacts');
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: 'Chat' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(screen.getByText('2 selected')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Select all 1,234 matching' }));
    expect(screen.getByText('All 1,234 matching selected')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove labels' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox', { name: 'VIP' }));
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(dialog).findByText('Remove labels from 1,234 contacts?')).toBeVisible();
    expect(requestTo(fetch, COUNT)?.body).toEqual({ selection: { filter: { source: ['CHAT'] } } });
    await user.click(within(dialog).getByRole('button', { name: 'Remove labels' }));
    await waitFor(() => expect(callsTo(fetch, BULK)).toBe(1));
    expect(requestTo(fetch, BULK)?.body).toEqual({
      selection: { filter: { source: ['CHAT'] } },
      action: 'REMOVE_LABELS',
      labelIds: ['l1'],
    });
  });

  it('advancedFilterIsLabelled', async () => {
    mockFetch(routes());
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Saved filter: None' }));
    expect(await screen.findByRole('option', { name: /^Lapsed VIPs/ })).toHaveTextContent('Advanced');
    expect(screen.getByRole('option', { name: 'Jaipur VIPs' })).not.toHaveTextContent('Advanced');
  });

  it('advancedFilterSendsItsId', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await pick(user, 'Lapsed VIPs');
    await waitFor(() => expect(lastSearch(fetch)).toEqual({ filterId: 'f2', sort: 'LAST_MESSAGE', page: 0 }));
  });

  it('panelEditsKeepTheAdvancedFilter', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await pick(user, 'Lapsed VIPs');
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('checkbox', { name: 'Chat' }));
    await waitFor(() =>
      expect(lastSearch(fetch)).toEqual({
        filterId: 'f2',
        filter: { source: ['CHAT'] },
        sort: 'LAST_MESSAGE',
        page: 0,
      }),
    );
    expect(screen.getByRole('button', { name: 'Saved filter: Lapsed VIPs' })).toBeVisible();
    await user.type(screen.getByLabelText('Search contacts'), 'asha');
    await waitFor(() => expect(lastSearch(fetch).filter).toEqual({ source: ['CHAT'], q: 'asha' }));
    expect(lastSearch(fetch).filterId).toBe('f2');
  });

  it('pickingAnAdvancedFilterClearsThePanel', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts');
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: 'Chat' }));
    await pick(user, 'Lapsed VIPs');
    await waitFor(() => expect(lastSearch(fetch)).not.toHaveProperty('filter'));
    expect(screen.getByRole('checkbox', { name: 'Chat' })).not.toBeChecked();
  });

  it('saveFilterIsOffForAnAdvancedFilter', async () => {
    mockFetch(routes());
    const { user } = renderApp('/contacts');
    await openFilters(user);
    await pick(user, 'Lapsed VIPs');
    await user.click(screen.getByRole('checkbox', { name: 'Chat' }));
    expect(screen.getByRole('button', { name: 'Save filter' })).toBeDisabled();
    await pick(user, 'None');
    expect(screen.getByRole('button', { name: 'Save filter' })).toBeEnabled();
  });

  it('bulkAllMatchingOnAdvancedSendsBoth', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [SEARCH]: page([ASHA, RAVI], 300),
        [COUNT]: { status: 200, body: { count: 300 } },
      }),
    );
    const { user } = renderApp('/contacts');
    await openFilters(user);
    await pick(user, 'Lapsed VIPs');
    await user.click(screen.getByRole('checkbox', { name: 'Chat' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Select all rows' }));
    await user.click(screen.getByRole('button', { name: 'Select all 300 matching' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('Delete 300 contacts?');
    expect(requestTo(fetch, COUNT)?.body).toEqual({ selection: { filterId: 'f2', filter: { source: ['CHAT'] } } });
  });

  it('opensWithTheHandedOverFilter', async () => {
    const fetch = mockFetch(routes());
    const first = renderApp({ pathname: '/contacts', state: { filterId: 'f2' } });
    expect(await screen.findByRole('button', { name: 'Saved filter: Lapsed VIPs' })).toBeVisible();
    await rowWith('Asha Rao');
    for (let n = 0; n < callsTo(fetch, SEARCH); n++) expect(requestTo(fetch, SEARCH, n)?.body.filterId).toBe('f2');
    first.unmount();

    const second = mockFetch(routes());
    const { user } = renderApp({ pathname: '/contacts', state: { filterId: 'f1' } });
    expect(await screen.findByRole('button', { name: 'Saved filter: Jaipur VIPs' })).toBeVisible();
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(await screen.findByRole('button', { name: /^Any of these labels/ })).toHaveTextContent('1');
    expect(callsTo(second, SEARCH)).toBeGreaterThan(0);
  });

  it('filterBuilderNeedsBulk', async () => {
    mockFetch(routes(WORKSPACE_MANAGER, { [`GET ${B}/contacts/filters`]: { status: 404, body: {} } }));
    const first = renderApp('/contacts', <LocationProbe />);
    await rowWith('Asha Rao');
    await first.user.click(screen.getByRole('button', { name: 'Filter builder' }));
    expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent('/contacts/filters');
    first.unmount();

    mockFetch(routes(AGENT_IN_BRAND));
    renderApp('/contacts');
    await rowWith('Asha Rao');
    expect(screen.queryByRole('button', { name: 'Filter builder' })).toBeNull();
  });

  it('bulkAllMatchingOnSavedFilterSendsFilterId', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [SEARCH]: page([ASHA, RAVI], 300),
        [COUNT]: { status: 200, body: { count: 300 } },
      }),
    );
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Saved filter: None' }));
    await user.click(await screen.findByRole('option', { name: 'Jaipur VIPs' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Select all rows' }));
    await user.click(screen.getByRole('button', { name: 'Select all 300 matching' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('Delete 300 contacts?');
    expect(requestTo(fetch, COUNT)?.body).toEqual({ selection: { filterId: 'f1' } });
  });

  it('setAttributeSendsValue', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [COUNT]: { status: 200, body: { count: 1 } },
        [BULK]: { status: 200, body: { matched: 1, changed: 1 } },
      }),
    );
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('checkbox', { name: 'Select row 0' }));
    await user.click(screen.getByRole('button', { name: 'Set attribute' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Attribute'), 'City');
    await user.type(within(dialog).getByLabelText('Value'), 'Pune');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(dialog).findByText('Set City on 1 contact?')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Set attribute' }));
    await waitFor(() => expect(callsTo(fetch, BULK)).toBe(1));
    expect(requestTo(fetch, BULK)?.body).toEqual({
      selection: { ids: ['c1'] },
      action: 'SET_ATTRIBUTE',
      attributeId: 'a1',
      value: 'Pune',
    });
  });

  it('clearAttributeSendsAttribute', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [COUNT]: { status: 200, body: { count: 1 } },
        [BULK]: { status: 200, body: { matched: 1, changed: 1 } },
      }),
    );
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('checkbox', { name: 'Select row 0' }));
    await user.click(screen.getByRole('button', { name: 'Clear attribute' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Attribute'), 'City');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await within(dialog).findByText('Clear City on 1 contact?');
    await user.click(within(dialog).getByRole('button', { name: 'Clear attribute' }));
    await waitFor(() => expect(callsTo(fetch, BULK)).toBe(1));
    expect(requestTo(fetch, BULK)?.body).toEqual({
      selection: { ids: ['c1'] },
      action: 'CLEAR_ATTRIBUTE',
      attributeId: 'a1',
    });
  });

  it('selectionClearsOnFilterChange', async () => {
    mockFetch(routes());
    const { user } = renderApp('/contacts');
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: 'Select row 0' }));
    expect(screen.getByText('1 selected')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Import' }));
    await waitFor(() => expect(screen.queryByText('1 selected')).toBeNull());
  });

  it('selectionClearsOnPageChange', async () => {
    mockFetch(routes(WORKSPACE_MANAGER, { [SEARCH]: page([ASHA, RAVI], 120) }));
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('checkbox', { name: 'Select row 0' }));
    await user.click(screen.getAllByRole('button', { name: 'Go to next page' })[0]);
    await waitFor(() => expect(screen.queryByText('1 selected')).toBeNull());
  });

  it('bulkDeleteNeedsContactDelete', async () => {
    mockFetch(routes(TEAM_LEAD));
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('checkbox', { name: 'Select row 0' }));
    expect(screen.getByRole('button', { name: 'Add labels' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('bulkDeleteConfirmsWithCount', async () => {
    const fetch = mockFetch(
      routes(WORKSPACE_MANAGER, {
        [COUNT]: { status: 200, body: { count: 12 } },
        [BULK]: { status: 200, body: { matched: 12, changed: 12 } },
      }),
    );
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(screen.getByRole('checkbox', { name: 'Select row 0' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Delete 12 contacts?')).toBeVisible();
    expect(within(dialog).getByText('Their notes are deleted too. This cannot be undone.')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(callsTo(fetch, BULK)).toBe(1));
    expect(requestTo(fetch, BULK)?.body).toEqual({ selection: { ids: ['c1'] }, action: 'DELETE' });
  });
});
