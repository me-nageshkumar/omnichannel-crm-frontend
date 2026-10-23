import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../test/fetchMock';
import { BRAND_VIEWER, WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';
import { campaignSettings } from '../../test/campaigns';
import type { CampaignSettings } from '@app/api/campaigns';

const SET = '/api/workspaces/w1/campaigns/settings';
const GET = `GET ${SET}`;
const PUT = `PUT ${SET}`;
const WARNING = 'Looser than the recommended value';

function routes(settings: CampaignSettings = campaignSettings(), extra = {}, user = WORKSPACE_MANAGER) {
  return { ...meAs(user), [GET]: { status: 200, body: settings }, ...extra };
}

type User = ReturnType<typeof renderApp>['user'];

async function setField(user: User, label: string, value: string) {
  const input = await screen.findByLabelText(label, { exact: true });
  await user.clear(input);
  await user.type(input, value);
}

describe('campaign settings', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loadsTheSettings', async () => {
    mockFetch(routes());
    renderApp('/campaigns/settings');
    expect(await screen.findByLabelText('Hourly cap', { exact: true })).toHaveValue(12);
    expect(screen.getByLabelText('Start time')).toHaveValue('10:00');
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) expect(screen.getByLabelText(d)).toBeChecked();
    expect(screen.getByLabelText('Sun')).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'Back to campaigns' })).toHaveAttribute('href', '/campaigns');
  });

  it('keepsATimezoneMissingFromTheBrowserList', async () => {
    mockFetch(routes());
    renderApp('/campaigns/settings');
    expect(await screen.findByLabelText('Timezone')).toHaveValue('Asia/Kolkata');
    expect(screen.getByRole('option', { name: 'Asia/Kolkata' })).toBeInTheDocument();
  });

  it('warnsWhenLooserThanRecommended', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/settings');
    await setField(user, 'Minimum gap (seconds)', '30');
    expect(screen.getAllByText(WARNING)).toHaveLength(1);
    await setField(user, 'Hourly cap', '13');
    expect(screen.getAllByText(WARNING)).toHaveLength(2);
    await setField(user, 'End time', '20:00');
    expect(screen.getAllByText(WARNING)).toHaveLength(2);
  });

  it('stricterValuesShowNoWarning', async () => {
    mockFetch(routes());
    const { user } = renderApp('/campaigns/settings');
    await setField(user, 'Minimum gap (seconds)', '60');
    await setField(user, 'Hourly cap', '10');
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('savesTheWholeDocument', async () => {
    const fn = mockFetch(
      routes(campaignSettings(), { [PUT]: { status: 200, body: campaignSettings({ hourlyCap: 10, version: 1 }) } }),
    );
    const { user } = renderApp('/campaigns/settings');
    await setField(user, 'Hourly cap', '10');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Settings saved.')).toBeVisible();
    expect(requestTo(fn, PUT)?.body).toEqual(campaignSettings({ hourlyCap: 10 }));
  });

  it('checksTheGapsBeforeSaving', async () => {
    const fn = mockFetch(routes());
    const { user } = renderApp('/campaigns/settings');
    await setField(user, 'Minimum gap (seconds)', '200');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Must not exceed the maximum gap')).toBeVisible();
    expect(callsTo(fn, PUT)).toBe(0);
  });

  it('serverFieldErrorsLandUnderTheirField', async () => {
    mockFetch(
      routes(campaignSettings(), {
        [PUT]: {
          status: 400,
          body: { code: 'VALIDATION', message: 'invalid', fields: { hourlyCap: 'must be at most 60' } },
        },
      }),
    );
    const { user } = renderApp('/campaigns/settings');
    await setField(user, 'Hourly cap', '70');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('must be at most 60')).toBeVisible();
  });

  it('settingsRouteIsNotFoundWithoutSettings', async () => {
    const fn = mockFetch(routes(campaignSettings(), {}, BRAND_VIEWER));
    renderApp('/campaigns/settings');
    expect(await screen.findByText('404 Page not found')).toBeVisible();
    expect(callsTo(fn, GET)).toBe(0);
  });
});
