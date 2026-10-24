import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, CUSTOMER_ADMIN, meAs, storeSession } from '../../../test/session';
import { fill, rowAction, rowWith } from '../../../test/admin';

const ACME = { id: 'c1', name: 'Acme', active: true, disabled: null, creationTime: '2026-10-20T10:00:00Z' };
const DETAIL = {
  customer: ACME,
  workspaces: [
    { id: 'w1', name: 'Acme Retail', disabled: null },
    { id: 'w2', name: 'Acme Online', disabled: null },
  ],
  admins: [],
};
const SWITCH_W1 = 'GET /api/customers/c1/workspaces/w1/crm';
const PUT_W1 = 'PUT /api/customers/c1/workspaces/w1/crm';

function routes(extra = {}) {
  return {
    'GET /api/customers/c1': { status: 200, body: DETAIL },
    'GET /api/customers/c1/users': { status: 200, body: [] },
    [SWITCH_W1]: { status: 200, body: { enabled: true, maxPipelines: 3, maxCustomFields: 20 } },
    'GET /api/customers/c1/workspaces/w2/crm': {
      status: 200,
      body: { enabled: false, maxPipelines: null, maxCustomFields: null },
    },
    ...extra,
  };
}

describe('CRM switch on the customer page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('staffSeesCrmColumnAndOpensModal', async () => {
    mockFetch({ ...meAs(ACCOUNT_MANAGER), ...routes() });
    const { user } = renderApp('/customers/c1');
    const retail = await rowWith('Acme Retail');
    expect(await within(retail).findByText('On')).toBeVisible();
    expect(await within(await rowWith('Acme Online')).findByText('Off')).toBeVisible();
    await rowAction(user, 'Acme Retail', 'CRM settings…');
    expect(await screen.findByRole('switch', { name: 'CRM on' })).toBeChecked();
    expect(screen.getByLabelText('Max pipelines')).toHaveValue(3);
    expect(screen.getByLabelText('Max custom fields per record type')).toHaveValue(20);
  });

  it('savingSendsLimitsAndUpdatesRow', async () => {
    const f = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...routes({ [PUT_W1]: ({ body }: { body: unknown }) => ({ status: 200, body }) }),
    });
    const { user } = renderApp('/customers/c1');
    await rowAction(user, 'Acme Retail', 'CRM settings…');
    await user.click(await screen.findByRole('switch', { name: 'CRM on' }));
    await fill(user, 'Max pipelines', '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestTo(f, PUT_W1)?.body).toEqual({ enabled: false, maxPipelines: 5, maxCustomFields: 20 });
    expect(within(await rowWith('Acme Retail')).getByText('Off')).toBeVisible();
  });

  it('blankLimitMeansUnlimited', async () => {
    const f = mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...routes({ [PUT_W1]: ({ body }: { body: unknown }) => ({ status: 200, body }) }),
    });
    const { user } = renderApp('/customers/c1');
    await rowAction(user, 'Acme Retail', 'CRM settings…');
    await fill(user, 'Max pipelines', '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(requestTo(f, PUT_W1)).toBeDefined());
    expect(requestTo(f, PUT_W1)?.body).toEqual({ enabled: true, maxPipelines: null, maxCustomFields: 20 });
  });

  it('showsFieldErrorsFromTheServer', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...routes({
        [PUT_W1]: { status: 422, body: { code: 'VALIDATION', fields: { maxPipelines: 'Must be at least 1.' } } },
      }),
    });
    const { user } = renderApp('/customers/c1');
    await rowAction(user, 'Acme Retail', 'CRM settings…');
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Must be at least 1.')).toBeVisible();
  });

  it('noCrmActionWithoutAuthority', async () => {
    const f = mockFetch({
      ...meAs({ ...CUSTOMER_ADMIN, authorities: ['customer:view', 'customer:manage'] }),
      ...routes(),
    });
    const { user } = renderApp('/customers/c1');
    await rowWith('Acme Retail');
    expect(screen.queryByText('On')).toBeNull();
    await user.click(within(await rowWith('Acme Retail')).getByRole('button', { name: 'Kebab toggle' }));
    expect(screen.queryByRole('menuitem', { name: 'CRM settings…' })).toBeNull();
    expect(requestTo(f, SWITCH_W1)).toBeUndefined();
  });
});
