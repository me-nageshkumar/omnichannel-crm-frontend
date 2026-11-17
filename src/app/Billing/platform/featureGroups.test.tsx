import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { ACCOUNT_MANAGER, SUPER_ADMIN, meAs, storeSession } from '../../../test/session';
import { SEEDED_GROUPS, billingRoutes, group, plan } from '../../../test/billing';
import { fill, rowAction, rowWith } from '../../../test/admin';

const authority = (code: string, description: string, level = 'BRAND') => ({
  code,
  group: code.slice(0, code.indexOf(':')),
  level,
  description,
  builtIn: true,
  status: 'ACTIVE',
  checkedIn: [],
  roles: [],
  updatedAt: null,
  updatedBy: null,
});

const AUTHORITIES = [
  authority('crm:view', 'Open the CRM'),
  authority('crm:export', 'Export CRM records'),
  authority('report:view', 'See reports'),
  authority('customer:view', 'See the customer list', 'PLATFORM'),
];

const GROUPS_TAB = '/platform/plans?tab=groups';

describe('feature groups', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists the groups and warns about permissions in no group', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes({
        'GET /api/billing/feature-groups/ungrouped': {
          status: 200,
          body: [{ code: 'report:view', description: 'See reports', level: 'BRAND' }],
        },
        'GET /api/billing/feature-groups': {
          status: 200,
          body: SEEDED_GROUPS.map((g) => (g.code === 'crm' ? { ...g, planCodes: ['gold-monthly'] } : g)),
        },
      }),
    });
    renderApp(GROUPS_TAB);
    const crm = await rowWith('CRM');
    expect(within(crm).getByText('Paid')).toBeVisible();
    expect(within(crm).getByText('gold-monthly')).toBeVisible();
    expect(within(await rowWith('Core')).getByText('Default')).toBeVisible();
    expect(within(await rowWith('AI')).getByText('Chatbots')).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(10);
    expect(await screen.findByText(/1 permission is in no group/)).toBeVisible();
    expect(screen.getByText('report:view')).toBeVisible();
  });

  it('creates a group from permissions no other group holds', async () => {
    const created = group({
      code: 'reports',
      name: 'Reports',
      authorities: ['report:view'],
      builtIn: false,
      sortOrder: 95,
    });
    const fetch = mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes(),
      'GET /api/authorities': { status: 200, body: AUTHORITIES },
      'POST /api/billing/feature-groups': { status: 201, body: created },
    });
    const { user } = renderApp(GROUPS_TAB);
    await user.click(await screen.findByRole('button', { name: 'Add feature group' }));
    const dialog = await screen.findByRole('dialog');
    await fill(user, 'Code', 'reports');
    await fill(user, 'Name', 'Reports');
    // a platform permission is not offered; one in another group is there but cannot be picked
    expect(within(dialog).queryByRole('checkbox', { name: /See the customer list/ })).toBeNull();
    expect(await within(dialog).findByRole('checkbox', { name: /Open the CRM/ })).toBeDisabled();
    expect(within(dialog).getAllByText(/In group CRM/).length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('checkbox', { name: /See reports/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(requestTo(fetch, 'POST /api/billing/feature-groups')?.body).toMatchObject({
        code: 'reports',
        name: 'Reports',
        category: 'PAID',
        authorities: ['report:view'],
        requires: [],
      }),
    );
    expect(await rowWith('Reports')).toBeVisible();
  });

  it('shows what the server refuses next to the field', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes(),
      'GET /api/authorities': { status: 200, body: AUTHORITIES },
      'PUT /api/billing/feature-groups/crm': {
        status: 400,
        body: { code: 'VALIDATION', fields: { authorities: 'crm:export is already in group Exports' } },
      },
    });
    const { user } = renderApp(GROUPS_TAB);
    await rowAction(user, 'CRM', 'Edit');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue('CRM');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('crm:export is already in group Exports')).toBeVisible();
  });

  it('says which plans keep a group from being deleted', async () => {
    const extras = group({ code: 'extras', name: 'Extras', builtIn: false, authorities: [], sortOrder: 99 });
    mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes({
        'GET /api/billing/feature-groups': { status: 200, body: [...SEEDED_GROUPS, extras] },
        'GET /api/billing/plans': { status: 200, body: [plan()] },
      }),
      'DELETE /api/billing/feature-groups/extras': {
        status: 409,
        body: { code: 'GROUP_IN_USE', message: 'The group is listed in a plan', plans: 'gold-monthly' },
      },
    });
    const { user } = renderApp(GROUPS_TAB);
    await rowAction(user, 'Extras', 'Delete');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Used by plans: gold-monthly')).toBeVisible();
    // a built-in group has no Delete
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(within(await rowWith('CRM')).getByRole('button', { name: 'Kebab toggle' }));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
  });

  it('lets an account manager look but not change', async () => {
    mockFetch({
      ...meAs(ACCOUNT_MANAGER),
      ...billingRoutes(),
      'GET /api/billing/feature-groups/crm/history': {
        status: 200,
        body: [
          {
            id: 'e1',
            kind: 'UPDATED',
            by: 'u1',
            byName: 'Nagesh Kumar',
            at: '2026-11-17T10:00:00Z',
            summary: 'Removed crm:export',
          },
        ],
      },
    });
    const { user } = renderApp(GROUPS_TAB);
    await rowWith('CRM');
    expect(screen.queryByRole('button', { name: 'Add feature group' })).toBeNull();
    await user.click(within(await rowWith('CRM')).getByRole('button', { name: 'Kebab toggle' }));
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
    await user.click(await screen.findByRole('menuitem', { name: 'History' }));
    expect(await screen.findByText('Removed crm:export')).toBeVisible();
    expect(screen.getByText('Nagesh Kumar')).toBeVisible();
  });

  it('names the plans that keep a category from changing', async () => {
    mockFetch({
      ...meAs(SUPER_ADMIN),
      ...billingRoutes(),
      'GET /api/authorities': { status: 200, body: AUTHORITIES },
      'PUT /api/billing/feature-groups/crm': {
        status: 409,
        body: { code: 'GROUP_IN_USE', message: 'The group is listed in a plan', plans: 'gold-monthly' },
      },
    });
    const { user } = renderApp(GROUPS_TAB);
    await rowAction(user, 'CRM', 'Edit');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: /Default/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Used by plans: gold-monthly')).toBeVisible();
  });
});
