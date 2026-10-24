import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { crmStatus } from '../../../test/crm';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { rowWith, summary } from '../../../test/admin';
import type { Pipeline } from '@app/api/crm';

const ARUN = {
  ...summary({
    id: 'u5',
    name: 'Arun Agent',
    username: 'arun',
    workspaceRoles: [{ workspaceId: 'w1', workspaceName: 'Brand A', role: { id: 'r-ag', name: 'AGENT' } }],
  }),
  allBrands: false,
  manageable: true,
};
const pipeline = (id: string, name: string, active = true): Pipeline => ({
  id,
  name,
  isDefault: false,
  active,
  rottingDays: null,
  stages: [],
  version: 1,
});
const SALES = pipeline('p1', 'Sales');
const SUPPORT = pipeline('p2', 'Support');
const OLD = pipeline('p3', 'Legacy', false);

const STATUS = 'GET /api/workspaces/w1/crm/status';
const PUT = 'PUT /api/workspaces/w1/crm/users/u5/pipelines';

function routes(status = crmStatus({ authorities: ['crm:view', 'crm:settings'] }), extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    'GET /api/workspaces/w1/users': { status: 200, body: [ARUN] },
    'GET /api/workspaces/w1/assignable-roles': { status: 200, body: [] },
    [STATUS]: { status: 200, body: status },
    'GET /api/workspaces/w1/crm/pipelines': { status: 200, body: [SALES, SUPPORT, OLD] },
    'GET /api/workspaces/w1/crm/users/u5/pipelines': { status: 200, body: { userId: 'u5', pipelineIds: ['p1'] } },
    ...extra,
  };
}

/** Opens Arun's kebab once the CRM status has been requested and applied. */
async function kebabItems(user: ReturnType<typeof renderApp>['user'], f: ReturnType<typeof mockFetch>) {
  await vi.waitFor(() => expect(requestTo(f, STATUS)).toBeDefined());
  await act(() => new Promise((r) => setTimeout(r, 50)));
  await user.click(within(await rowWith('Arun Agent')).getByRole('button', { name: 'Kebab toggle' }));
  return screen.findAllByRole('menuitem');
}

describe('user pipelines', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('actionHiddenWhenCrmOff', async () => {
    const f = mockFetch(routes(crmStatus({ enabled: false, authorities: ['crm:view', 'crm:settings'] })));
    const { user } = renderApp('/users');
    await kebabItems(user, f);
    expect(screen.queryByRole('menuitem', { name: 'CRM pipelines…' })).toBeNull();
  });

  it('actionHiddenWithoutSettingsAuthority', async () => {
    const f = mockFetch(routes(crmStatus({ authorities: ['crm:view', 'crm:edit'] })));
    const { user } = renderApp('/users');
    await kebabItems(user, f);
    expect(screen.queryByRole('menuitem', { name: 'CRM pipelines…' })).toBeNull();
  });

  it('modalLoadsAndSavesSelection', async () => {
    const f = mockFetch(
      routes(undefined, {
        [PUT]: ({ body }: { body: unknown }) => ({ status: 200, body: { userId: 'u5', ...(body as object) } }),
      }),
    );
    const { user } = renderApp('/users');
    await kebabItems(user, f);
    await user.click(await screen.findByRole('menuitem', { name: 'CRM pipelines…' }));
    const sales = await screen.findByRole('checkbox', { name: 'Sales' });
    expect(sales).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Support' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Legacy/ })).toBeVisible();
    expect(screen.getByText('Inactive')).toBeVisible();
    expect(screen.getByText("Users with 'see every pipeline' access see all pipelines anyway.")).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Support' }));
    await user.click(sales);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(f, PUT)?.body).toEqual({ pipelineIds: ['p2'] });
  });
});
