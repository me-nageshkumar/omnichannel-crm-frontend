import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleCrmContact } from '../../../test/crm';
import { storeSession } from '../../../test/session';
import { BASE, boardRoutes } from '../../../test/crmBoard';

const SEARCH = `POST ${BASE}/contacts/search`;
const settings = crmSettings({
  lifecycleStatuses: [
    { key: 'lead', label: 'Lead', color: null, position: 1, active: true, isDefault: true },
    { key: 'customer', label: 'Customer', color: null, position: 2, active: true, isDefault: false },
  ],
});
const page = (items = [sampleCrmContact()]) => ({ status: 200, body: { items, total: items.length, page: 0 } });
const routes = (extra = {}) =>
  boardRoutes({ [SEARCH]: page(), [`GET ${BASE}/settings`]: { status: 200, body: settings }, ...extra });

describe('CRM contacts page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listsAndFiltersByLifecycle', async () => {
    const f = mockFetch(
      routes({
        [SEARCH]: ({ body }) =>
          body.lifecycleStatus === 'customer'
            ? page([sampleCrmContact({ id: 'c2', name: 'Ravi Kumar', lifecycleStatus: 'customer', openDealCount: 2, openDealAmount: 3000 })])
            : page([sampleCrmContact({ lifecycleStatus: 'lead' })]),
      }),
    );
    const { user } = renderApp('/crm/contacts');
    const table = await screen.findByRole('grid', { name: 'CRM contacts' });
    expect(within(table).getByRole('link', { name: 'Priya Shah' })).toHaveAttribute('href', '/crm/contacts/c1');
    expect(within(table).getByText('919812345678')).toBeInTheDocument();
    expect(requestTo(f, SEARCH)?.body).toMatchObject({ page: 0, size: 50 });
    await user.selectOptions(screen.getByLabelText('Lifecycle'), 'Customer');
    expect(await screen.findByRole('link', { name: 'Ravi Kumar' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Priya Shah' })).toBeNull();
    expect(screen.getByText(/2 · /)).toBeInTheDocument();
  });

  it('searchDebounced', async () => {
    const f = mockFetch(routes());
    const { user } = renderApp('/crm/contacts');
    await screen.findByRole('link', { name: 'Priya Shah' });
    const before = f.mock.calls.filter(([, i]) => i?.method === 'POST' && String(i.body).includes('page')).length;
    await user.type(screen.getByRole('textbox', { name: 'Search contacts' }), 'priya');
    await waitFor(() => expect(requestTo(f, SEARCH, before)?.body).toMatchObject({ q: 'priya' }));
    // One request for the whole word, not one per keystroke.
    expect(requestTo(f, SEARCH, before + 1)).toBeUndefined();
  });

  it('emptyStateCopy', async () => {
    mockFetch(routes({ [SEARCH]: page([]) }));
    renderApp('/crm/contacts');
    expect(
      await screen.findByText('No CRM contacts yet. Capture one from the inbox or add one from Pipelines.'),
    ).toBeInTheDocument();
  });
});
