import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, crmStatus } from '../../../test/crm';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';

const BASE = '/api/workspaces/w1/crm';
const SETTINGS = crmSettings({
  dealSources: [{ key: 'website', label: 'Website', color: '#4394e5', position: 1, active: true, isDefault: false }],
});

function routes(extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${BASE}/status`]: { status: 200, body: crmStatus({ authorities: ['crm:view', 'crm:settings'] }) },
    [`GET ${BASE}/settings`]: { status: 200, body: SETTINGS },
    [`GET ${BASE}/pipelines`]: { status: 200, body: [] },
    ...extra,
  };
}

async function openPicklists(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('tab', { name: 'Picklists' }));
  return screen.findByRole('region', { name: 'Lifecycle stages' });
}

describe('CRM picklists', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('addItemDerivesKeyFromLabel', async () => {
    const f = mockFetch(routes({ [`PUT ${BASE}/settings`]: ({ body }: { body: object }) => ({ status: 200, body }) }));
    const { user } = renderApp('/crm/settings');
    await openPicklists(user);
    const sources = screen.getByRole('region', { name: 'Deal sources' });
    await user.click(within(sources).getByRole('button', { name: 'Add item' }));
    const labels = within(sources).getAllByLabelText('Item label');
    await user.type(labels[1], 'Trade fair 2026');
    expect(within(sources).getByText('Key: trade_fair_2026')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save picklists' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/settings`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/settings`)?.body.dealSources).toEqual([
      { key: 'website', label: 'Website', color: '#4394e5', position: 1, active: true, isDefault: false },
      expect.objectContaining({ key: 'trade_fair_2026', label: 'Trade fair 2026', active: true, isDefault: false }),
    ]);
  });

  it('savedItemHasNoDelete', async () => {
    mockFetch(routes());
    const { user } = renderApp('/crm/settings');
    const lifecycle = await openPicklists(user);
    expect(within(lifecycle).queryByRole('button', { name: /Remove Lead/ })).toBeNull();
    expect(within(lifecycle).getByText("Items in use can't be removed; switch them off instead.")).toBeInTheDocument();
    await user.click(within(lifecycle).getByRole('button', { name: 'Add item' }));
    await user.type(within(lifecycle).getAllByLabelText('Item label')[1], 'Prospect');
    await user.click(within(lifecycle).getByRole('button', { name: 'Remove Prospect' }));
    expect(within(lifecycle).getAllByLabelText('Item label')).toHaveLength(1);
    await user.click(within(lifecycle).getByRole('switch', { name: 'Lead active' }));
    expect(within(lifecycle).getByRole('switch', { name: 'Lead active' })).not.toBeChecked();
  });

  it('singleDefaultPerList', async () => {
    const f = mockFetch(routes({ [`PUT ${BASE}/settings`]: ({ body }: { body: object }) => ({ status: 200, body }) }));
    const { user } = renderApp('/crm/settings');
    const lifecycle = await openPicklists(user);
    expect(within(lifecycle).getByRole('radio', { name: 'Default: Lead' })).toBeChecked();
    await user.click(within(lifecycle).getByRole('button', { name: 'Add item' }));
    await user.type(within(lifecycle).getAllByLabelText('Item label')[1], 'Prospect');
    await user.click(within(lifecycle).getByRole('radio', { name: 'Default: Prospect' }));
    expect(within(lifecycle).getByRole('radio', { name: 'Default: Lead' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save picklists' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/settings`)).toBeDefined());
    const sent = requestTo(f, `PUT ${BASE}/settings`)?.body.lifecycleStatuses;
    expect(sent.filter((i: { isDefault: boolean }) => i.isDefault).map((i: { key: string }) => i.key)).toEqual([
      'prospect',
    ]);
  });

  it('saveSendsVersion', async () => {
    const put = vi
      .fn()
      .mockReturnValueOnce({ status: 409, body: { code: 'VERSION_CONFLICT', message: 'x' } })
      .mockImplementationOnce(({ body }: { body: object }) => ({ status: 200, body }));
    const f = mockFetch(routes({ [`PUT ${BASE}/settings`]: (req: { body: object }) => put(req) }));
    const { user } = renderApp('/crm/settings');
    await openPicklists(user);
    await user.click(screen.getByRole('button', { name: 'Save picklists' }));
    expect(await screen.findByText('Someone else changed this. Reload to see their changes.')).toBeInTheDocument();
    expect(requestTo(f, `PUT ${BASE}/settings`)?.body).toMatchObject({
      version: 4,
      defaultCurrency: 'INR',
      dealRottingDays: 14,
      dealSources: SETTINGS.dealSources,
    });
  });
});
