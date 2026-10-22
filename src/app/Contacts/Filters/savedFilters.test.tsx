import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { messageFor } from '@app/api/messages';
import type { CurrentUser } from '@app/api/users';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { AGENT_IN_BRAND, WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { fill, rowAction, rowWith } from '../../../test/admin';
import { advancedFilter, attribute, contact, filterPreview, label, savedFilter } from '../../../test/contacts';

const B = '/api/workspaces/w1';
const COUNT = `POST ${B}/contacts/count`;
const SEARCH = `POST ${B}/contacts/search`;
const DELETE = `DELETE ${B}/contact-filters/f2`;
const VIP = label({ id: 'l1', name: 'VIP', color: 'purple' });
const CITY = attribute({ id: 'a1', name: 'City' });
const ASHA = contact({ id: 'c1', name: 'Asha Rao', phone: '919900000001', labels: ['l1'] });
const SAVED = savedFilter({ id: 'f1', name: 'Jaipur VIPs', filter: { labelsAny: ['l1'] } });
const ADV = advancedFilter({ id: 'f2', name: 'Lapsed VIPs' });

function routes(user: CurrentUser = WORKSPACE_MANAGER, extra: Record<string, unknown> = {}, filters = [SAVED, ADV]) {
  return {
    ...meAs(user),
    [`GET ${B}/contact-filters`]: { status: 200, body: filters },
    [`GET ${B}/contact-filters/f2`]: { status: 200, body: ADV },
    [`GET ${B}/contact-labels`]: { status: 200, body: [VIP] },
    [`GET ${B}/contact-attributes`]: { status: 200, body: [CITY] },
    [COUNT]: { status: 200, body: { count: 1204 } },
    [DELETE]: { status: 204 },
    [`POST ${B}/contact-filters`]: { status: 201, body: advancedFilter({ id: 'f9', name: 'VIPs' }) },
    [`POST ${B}/contact-filters/preview`]: { status: 200, body: filterPreview({ sample: [ASHA] }) },
    [SEARCH]: { status: 200, body: { items: [ASHA], total: 1, page: 0 } },
    ...extra,
  };
}

const button = (n: string) => screen.getByRole('button', { name: n });

describe('saved filters page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsBothKinds', async () => {
    mockFetch(routes());
    renderApp('/contacts/filters');
    expect(within(await rowWith('Jaipur VIPs')).getByText('Simple')).toBeVisible();
    expect(within(await rowWith('Lapsed VIPs')).getByText('Advanced')).toBeVisible();
    for (const n of ['Name', 'Kind', 'Contacts', 'Updated'])
      expect(screen.getByRole('columnheader', { name: n })).toBeVisible();
  });

  it('countsOnlyOnRequest', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts/filters');
    const row = await rowWith('Lapsed VIPs');
    expect(callsTo(fetch, COUNT)).toBe(0);
    await user.click(within(row).getByRole('button', { name: 'Count' }));
    await waitFor(() => expect(within(row).getByText('1,204 contacts')).toBeVisible());
    expect(requestTo(fetch, COUNT)?.body).toEqual({ selection: { filterId: 'f2' } });
    expect(within(await rowWith('Jaipur VIPs')).getByRole('button', { name: 'Count' })).toBeVisible();
  });

  it('countTimeoutStaysInTheRow', async () => {
    let calls = 0;
    mockFetch(
      routes(WORKSPACE_MANAGER, {
        [COUNT]: () =>
          ++calls === 1 ? { status: 504, body: { code: 'QUERY_TIMEOUT' } } : { status: 200, body: { count: 7 } },
      }),
    );
    const { user } = renderApp('/contacts/filters');
    const row = await rowWith('Lapsed VIPs');
    await user.click(within(row).getByRole('button', { name: 'Count' }));
    expect(await within(row).findByText('This filter takes too long to run. Make it more specific.')).toBeVisible();
    await user.click(within(row).getByRole('button', { name: 'Count' }));
    expect(await within(row).findByText('7 contacts')).toBeVisible();
    expect(within(row).queryByText(/too long/)).toBeNull();
  });

  it('loadErrorShowsOnlyTheAlert', async () => {
    mockFetch(routes(WORKSPACE_MANAGER, { [`GET ${B}/contact-filters`]: { status: 500, body: {} } }));
    renderApp('/contacts/filters');
    expect(await screen.findByText(messageFor(new Error('load')))).toBeVisible();
    expect(screen.queryByText('No saved filters yet.')).toBeNull();
  });

  it('editAdvancedOpensTheBuilder', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts/filters');
    await rowWith('Lapsed VIPs');
    await rowAction(user, 'Lapsed VIPs', 'Edit');
    expect(await screen.findByRole('heading', { name: 'Edit filter' })).toBeVisible();
    expect(callsTo(fetch, `GET ${B}/contact-filters/f2`)).toBe(1);
  });

  it('editSimpleOpensContactsWithIt', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts/filters');
    await rowAction(user, 'Jaipur VIPs', 'Edit');
    expect(await screen.findByRole('heading', { name: 'Contacts' })).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Saved filter: Jaipur VIPs' })).toBeVisible();
    await waitFor(() => {
      const n = fetch.mock.calls.filter(
        ([i, init]) => String(i).endsWith('/contacts/search') && init?.method === 'POST',
      ).length;
      expect(n).toBeGreaterThan(0);
      expect(requestTo(fetch, SEARCH, n - 1)?.body).toHaveProperty('filterId', 'f1');
    });
  });

  it('deleteConfirmsFirst', async () => {
    const fetch = mockFetch(routes());
    const { user } = renderApp('/contacts/filters');
    await rowAction(user, 'Lapsed VIPs', 'Delete');
    const dialog = await screen.findByRole('dialog', { name: /Delete this saved filter\?/ });
    expect(
      within(dialog).getByText('Contacts are not affected. Everyone in the brand loses the filter.'),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(callsTo(fetch, DELETE)).toBe(0);

    await rowAction(user, 'Lapsed VIPs', 'Delete');
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(callsTo(fetch, DELETE)).toBe(1));
    await waitFor(() => expect(screen.queryByRole('row', { name: /Lapsed VIPs/ })).toBeNull());
    expect(screen.queryByText('Lapsed VIPs')).toBeNull();
  });

  it('newFilterOpensTheBuilder', async () => {
    mockFetch(routes());
    const { user } = renderApp('/contacts/filters');
    await rowWith('Jaipur VIPs');
    await user.click(button('New filter'));
    expect(await screen.findByRole('heading', { name: 'New filter' })).toBeVisible();
  });

  it('viewerSeesNoWriteActions', async () => {
    mockFetch(routes(AGENT_IN_BRAND));
    renderApp('/contacts/filters');
    const row = await rowWith('Lapsed VIPs');
    expect(within(row).getByRole('button', { name: 'Count' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'New filter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kebab toggle' })).toBeNull();
  });

  it('emptyListSaysSo', async () => {
    mockFetch(routes(WORKSPACE_MANAGER, {}, []));
    renderApp('/contacts/filters');
    expect(await screen.findByText('No saved filters yet.')).toBeVisible();
  });

  it('filterBuilderButtonOpensThisPage', async () => {
    mockFetch(routes());
    const { user } = renderApp('/contacts');
    await rowWith('Asha Rao');
    await user.click(button('Filter builder'));
    expect(await screen.findByRole('heading', { name: 'Saved filters' })).toBeVisible();
  });

  it('builderSaveLandsHere', async () => {
    mockFetch(routes());
    const { user } = renderApp('/contacts/filters/new');
    await fill(user, 'Name', 'VIPs');
    const rule = within(await screen.findByRole('group', { name: 'Rule 1' }));
    await user.selectOptions(rule.getByLabelText('Field'), 'Labels');
    await user.selectOptions(rule.getByLabelText('Operator'), 'has');
    await user.selectOptions(rule.getByLabelText('Value'), 'VIP');
    await user.click(button('Save'));
    expect(await screen.findByRole('heading', { name: 'Saved filters' })).toBeVisible();
  });
});
