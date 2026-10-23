import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, crmStatus, samplePipeline } from '../../../test/crm';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';

const BASE = '/api/workspaces/w1/crm';
const SALES = samplePipeline();
const SUPPORT = samplePipeline({ id: 'p2', name: 'Support', isDefault: false, rottingDays: null, version: 1 });
const OLD = samplePipeline({ id: 'p3', name: 'Legacy', isDefault: false, active: false, version: 1 });

function routes(authorities = ['crm:view', 'crm:settings'], limit: number | null = 5, extra = {}) {
  return {
    ...meAs(WORKSPACE_MANAGER),
    [`GET ${BASE}/status`]: {
      status: 200,
      body: crmStatus({ authorities, limits: { maxPipelines: limit, maxCustomFields: 20 } }),
    },
    [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
    [`GET ${BASE}/pipelines`]: { status: 200, body: [SALES, SUPPORT, OLD] },
    ...extra,
  };
}

describe('CRM settings', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('generalSavesWithVersion', async () => {
    const f = mockFetch(
      routes(undefined, undefined, {
        [`PUT ${BASE}/settings`]: ({ body }: { body: object }) => ({ status: 200, body }),
      }),
    );
    const { user } = renderApp('/crm/settings');
    const currency = await screen.findByLabelText('Default currency');
    await waitFor(() => expect(currency).toHaveValue('INR'));
    await user.clear(currency);
    await user.type(currency, 'usd');
    expect(currency).toHaveValue('USD');
    await user.selectOptions(screen.getByLabelText('Default pipeline'), 'Support');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(f, `PUT ${BASE}/settings`)).toBeDefined());
    expect(requestTo(f, `PUT ${BASE}/settings`)?.body).toMatchObject({
      defaultCurrency: 'USD',
      defaultPipelineId: 'p2',
      dealRottingDays: 14,
      version: 4,
      lifecycleStatuses: crmSettings().lifecycleStatuses,
    });
  });

  it('readOnlyWithoutSettingsAuthority', async () => {
    mockFetch(routes(['crm:view']));
    renderApp('/crm/settings');
    expect(
      await screen.findByText('You can view these settings. Changing them needs the CRM settings permission.'),
    ).toBeInTheDocument();
    const currency = screen.getByLabelText('Default currency');
    await waitFor(() => expect(currency).toHaveValue('INR'));
    expect(currency).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('newPipelineDisabledAtLimit', async () => {
    mockFetch(routes(undefined, 3));
    const { user } = renderApp('/crm/settings');
    await user.click(await screen.findByRole('tab', { name: 'Pipelines' }));
    const button = await screen.findByRole('button', { name: 'New pipeline' });
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
    await user.hover(button);
    expect(await screen.findByText('Your plan allows 3 pipelines')).toBeInTheDocument();
  });

  it('deleteWithDealsAsksForTarget', async () => {
    const del = vi
      .fn()
      .mockReturnValueOnce({ status: 409, body: { code: 'PIPELINE_HAS_DEALS', message: 'x', count: '5' } })
      .mockReturnValueOnce({ status: 204 });
    const f = mockFetch(routes(undefined, undefined, { [`DELETE ${BASE}/pipelines/p2`]: () => del() }));
    const { user } = renderApp('/crm/settings');
    await user.click(await screen.findByRole('tab', { name: 'Pipelines' }));
    await user.click(await screen.findByRole('button', { name: 'Actions for Support' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: /Delete Support\?/ });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    const asks = await screen.findByRole('dialog', { name: /Move deals before deleting/ });
    expect(within(asks).getByText(/5 deals/)).toBeInTheDocument();
    const move = within(asks).getByRole('button', { name: 'Move deals and delete' });
    expect(move).toBeDisabled();
    // Only active pipelines other than the one being deleted are offered.
    expect(within(asks).queryByRole('option', { name: 'Legacy' })).toBeNull();
    expect(within(asks).queryByRole('option', { name: 'Support' })).toBeNull();
    await user.selectOptions(within(asks).getByLabelText('Move deals to'), 'Sales');
    await user.click(move);

    await waitFor(() => expect(del).toHaveBeenCalledTimes(2));
    const urls = f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/pipelines/p2'));
    expect(urls).toEqual([`${BASE}/pipelines/p2`, `${BASE}/pipelines/p2?moveDealsToPipelineId=p1`]);
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/pipelines`)).toBe(3));
  });

  const CONFLICT_COPY = 'Someone else changed this. Reload to see their changes.';
  const PUT_P2 = `PUT ${BASE}/pipelines/p2`;

  async function openRowAction(user: ReturnType<typeof renderApp>['user'], pipeline: string, item: string) {
    await user.click(await screen.findByRole('tab', { name: 'Pipelines' }));
    await user.click(await screen.findByRole('button', { name: `Actions for ${pipeline}` }));
    await user.click(await screen.findByRole('menuitem', { name: item }));
  }

  it('makeDefaultSendsTheWholePipeline', async () => {
    const f = mockFetch(routes(undefined, undefined, { [PUT_P2]: { status: 200, body: SUPPORT } }));
    const { user } = renderApp('/crm/settings');
    await openRowAction(user, 'Support', 'Make default');
    await waitFor(() => expect(requestTo(f, PUT_P2)).toBeDefined());
    expect(requestTo(f, PUT_P2)?.body).toEqual({
      name: 'Support',
      active: true,
      isDefault: true,
      rottingDays: null,
      version: 1,
    });
  });

  it('deactivateSendsTheWholePipeline', async () => {
    const f = mockFetch(routes(undefined, undefined, { [PUT_P2]: { status: 200, body: SUPPORT } }));
    const { user } = renderApp('/crm/settings');
    await openRowAction(user, 'Support', 'Deactivate');
    await waitFor(() => expect(requestTo(f, PUT_P2)).toBeDefined());
    expect(requestTo(f, PUT_P2)?.body).toEqual({
      name: 'Support',
      active: false,
      isDefault: false,
      rottingDays: null,
      version: 1,
    });
  });

  it('editSendsTheWholePipelineAndClearingRottingSendsZero', async () => {
    const PUT_P1 = `PUT ${BASE}/pipelines/p1`;
    const f = mockFetch(
      routes(undefined, undefined, {
        [`GET ${BASE}/pipelines/p1`]: { status: 200, body: SALES },
        [PUT_P1]: { status: 200, body: SALES },
      }),
    );
    const { user } = renderApp('/crm/settings');
    await openRowAction(user, 'Sales', 'Edit');
    const dialog = await screen.findByRole('dialog', { name: 'Edit pipeline' });
    const rotting = await within(dialog).findByLabelText('Rotting days');
    await waitFor(() => expect(rotting).toHaveValue(7));
    await user.clear(rotting);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestTo(f, PUT_P1)).toBeDefined());
    expect(requestTo(f, PUT_P1)?.body).toEqual({
      name: 'Sales',
      active: true,
      isDefault: true,
      rottingDays: 0,
      version: 3,
    });
  });

  it('rowActionConflictOffersReload', async () => {
    const f = mockFetch(
      routes(undefined, undefined, { [PUT_P2]: { status: 409, body: { code: 'VERSION_CONFLICT', message: 'x' } } }),
    );
    const { user } = renderApp('/crm/settings');
    await openRowAction(user, 'Support', 'Make default');
    expect(await screen.findByText(CONFLICT_COPY)).toBeVisible();
    expect(screen.queryByText(/Could not/)).toBeNull();
    const before = callsTo(f, `GET ${BASE}/pipelines`);
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/pipelines`)).toBe(before + 1));
    await waitFor(() => expect(screen.queryByText(CONFLICT_COPY)).toBeNull());
  });

  it('cancellingAfterPartialSaveReloadsTheList', async () => {
    const PUT_P1 = `PUT ${BASE}/pipelines/p1`;
    const f = mockFetch(
      routes(undefined, undefined, {
        [`GET ${BASE}/pipelines/p1`]: { status: 200, body: SALES },
        [PUT_P1]: { status: 200, body: { ...SALES, name: 'Sales 2', version: 4 } },
        [`PUT ${BASE}/pipelines/p1/stages`]: { status: 409, body: { code: 'VERSION_CONFLICT', message: 'x' } },
      }),
    );
    const { user } = renderApp('/crm/settings');
    await openRowAction(user, 'Sales', 'Edit');
    const dialog = await screen.findByRole('dialog', { name: 'Edit pipeline' });
    const name = await within(dialog).findByLabelText(/^Name/);
    await waitFor(() => expect(name).toHaveValue('Sales'));
    await user.type(name, ' 2');
    await user.click(within(dialog).getByRole('button', { name: 'Add lane' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(CONFLICT_COPY)).toBeVisible();
    const before = callsTo(f, `GET ${BASE}/pipelines`);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/pipelines`)).toBe(before + 1));
  });
});
