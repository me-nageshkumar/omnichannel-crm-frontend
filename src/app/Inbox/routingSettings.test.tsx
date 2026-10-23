import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { RoutingSetting } from '@app/api/inbox';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { AGENT_IN_BRAND, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const B = '/api/workspaces/w1';
const DEFAULT = `GET ${B}/inbox/settings`;
const PUT_DEFAULT = `PUT ${B}/inbox/settings`;
const TEAMS_SETTINGS = `GET ${B}/inbox/settings/teams`;
const TEAMS = `GET ${B}/teams`;

const base: RoutingSetting = {
  teamId: null,
  inherited: false,
  assignToTeam: true,
  roundRobin: false,
  userId: null,
  stickyDays: 30,
  claimOnReply: true,
  keepAssignmentOnClose: false,
};
const SUPPORT_INHERITED: RoutingSetting = { ...base, teamId: 't1', inherited: true };
const SALES_OVERRIDE: RoutingSetting = { ...base, teamId: 't2', inherited: false, roundRobin: true, stickyDays: 7 };
const TEAM_LIST = [
  {
    id: 't1',
    name: 'Support',
    members: [
      { id: 'u7', name: 'Ishaan Agent', username: 'ishaan' },
      { id: 'u9', name: 'Demo Agent', username: 'demo' },
    ],
    phoneNumbers: [],
  },
  { id: 't2', name: 'Sales', members: [], phoneNumbers: [] },
];

function routes(extra = {}, user = WORKSPACE_MANAGER) {
  return {
    ...meAs(user),
    [DEFAULT]: { status: 200, body: base },
    [TEAMS_SETTINGS]: { status: 200, body: [SALES_OVERRIDE, SUPPORT_INHERITED] },
    [TEAMS]: { status: 200, body: TEAM_LIST },
    ...extra,
  };
}

const card = async (name: string) => within(await screen.findByRole('region', { name }));

describe('inbox routing settings', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rendersDefaultAndTeamCards', async () => {
    mockFetch(routes());
    renderApp('/inbox/routing');
    const brand = await card('Brand default');
    expect(brand.getByLabelText('Assign incoming chats to the team')).toBeChecked();
    expect(brand.getByLabelText('Round robin among available members')).not.toBeChecked();
    expect(brand.getByLabelText('Sticky window (days)')).toHaveValue(30);
    expect(brand.getByLabelText('Claim on reply')).toBeChecked();
    expect(brand.getByLabelText('Keep assignment on close')).not.toBeChecked();
    const support = await card('Support');
    expect(support.getByText('Using brand default')).toBeVisible();
    expect(support.getByRole('button', { name: 'Override' })).toBeVisible();
    const sales = await card('Sales');
    expect(sales.getByLabelText('Round robin among available members')).toBeChecked();
    expect(sales.getByLabelText('Sticky window (days)')).toHaveValue(7);
    expect(sales.getByRole('button', { name: 'Use brand default' })).toBeVisible();
  });

  it('roundRobinSwitchDisabledUntilAssignToTeam', async () => {
    mockFetch(routes());
    const { user } = renderApp('/inbox/routing');
    const brand = await card('Brand default');
    expect(brand.getByLabelText('Round robin among available members')).toBeEnabled();
    await user.click(brand.getByLabelText('Assign incoming chats to the team'));
    expect(brand.getByLabelText('Round robin among available members')).toBeDisabled();
    expect(brand.getByLabelText('Round robin among available members')).not.toBeChecked();
  });

  it('savingDefaultPutsSwitchesMappedToBody', async () => {
    const fetch = mockFetch(
      routes({ [PUT_DEFAULT]: { status: 200, body: { ...base, roundRobin: true, stickyDays: 10 } } }),
    );
    const { user } = renderApp('/inbox/routing');
    const brand = await card('Brand default');
    await user.click(brand.getByLabelText('Round robin among available members'));
    const days = brand.getByLabelText('Sticky window (days)');
    await user.clear(days);
    await user.type(days, '10');
    await user.click(brand.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(fetch, PUT_DEFAULT)).toBe(1));
    expect(requestTo(fetch, PUT_DEFAULT)?.body).toMatchObject({
      assignToTeam: true,
      roundRobin: true,
      userId: null,
      stickyDays: 10,
      claimOnReply: true,
      keepAssignmentOnClose: false,
    });
    expect(await brand.findByText('Saved')).toBeVisible();
  });

  it('overrideThenUseDefaultDeletes', async () => {
    const fetch = mockFetch(
      routes({
        [`PUT ${B}/inbox/settings/teams/t1`]: { status: 200, body: { ...SUPPORT_INHERITED, inherited: false } },
        [`DELETE ${B}/inbox/settings/teams/t2`]: { status: 204 },
      }),
    );
    const { user } = renderApp('/inbox/routing');
    const support = await card('Support');
    expect(support.getByLabelText('Assign incoming chats to the team')).toBeDisabled();
    await user.click(support.getByRole('button', { name: 'Override' }));
    expect(support.getByLabelText('Assign incoming chats to the team')).toBeEnabled();
    await user.click(support.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(fetch, `PUT ${B}/inbox/settings/teams/t1`)).toBe(1));
    expect(await support.findByRole('button', { name: 'Use brand default' })).toBeVisible();

    const sales = await card('Sales');
    await user.click(sales.getByRole('button', { name: 'Use brand default' }));
    await waitFor(() => expect(callsTo(fetch, `DELETE ${B}/inbox/settings/teams/t2`)).toBe(1));
    expect(await sales.findByText('Using brand default')).toBeVisible();
    // back on the brand default's values
    expect(sales.getByLabelText('Sticky window (days)')).toHaveValue(30);
  });

  it('oneMemberOnlyOnTeamCards', async () => {
    const fetch = mockFetch(
      routes({
        [`PUT ${B}/inbox/settings/teams/t1`]: {
          status: 200,
          body: { ...SUPPORT_INHERITED, inherited: false, userId: 'u9' },
        },
      }),
    );
    const { user } = renderApp('/inbox/routing');
    const brand = await card('Brand default');
    expect(brand.queryByText('Advanced')).toBeNull();
    const support = await card('Support');
    await user.click(support.getByRole('button', { name: 'Override' }));
    await user.click(support.getByRole('button', { name: 'Advanced' }));
    await user.selectOptions(support.getByLabelText('Always assign to one member'), 'Demo Agent');
    // one member and round robin exclude each other
    expect(support.getByLabelText('Round robin among available members')).toBeDisabled();
    await user.click(support.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(callsTo(fetch, `PUT ${B}/inbox/settings/teams/t1`)).toBe(1));
    expect(requestTo(fetch, `PUT ${B}/inbox/settings/teams/t1`)?.body).toMatchObject({
      assignToTeam: true,
      roundRobin: false,
      userId: 'u9',
    });
  });

  it('isNotFoundWithoutInboxSettings', async () => {
    mockFetch(routes({}, AGENT_IN_BRAND));
    renderApp('/inbox/routing');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
  });
});
