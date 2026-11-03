import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { mockFetch } from '../../test/fetchMock';
import { renderApp } from '../../test/renderApp';
import { AUTOMATIONS_BASE, RUN, WELCOME_RULE, automationRoutes } from '../../test/automations';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const RULE = `${AUTOMATIONS_BASE}/rules/r1`;
const routes = (items = [RUN], total = items.length) =>
  automationRoutes({
    [`GET ${RULE}`]: { status: 200, body: { ...WELCOME_RULE, name: 'Welcome' } },
    [`GET ${RULE}/runs`]: { status: 200, body: { items, total, page: 0 } },
  });

const urls = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.map(([u]) => String(u));

describe('automation runs', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('listsRunsNewestFirstWithSteps', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...routes() });
    const { user } = renderApp('/automations/r1/runs');
    expect(await screen.findByRole('heading', { name: 'Runs of “Welcome”' })).toBeVisible();
    const row = within((await screen.findByText('Message from Asha')).closest('tr') as HTMLElement);
    expect(row.getByText('Asha')).toBeVisible();
    expect(row.getByText('Failed')).toBeVisible();
    await user.click(row.getByRole('button', { name: /details/i }));
    const steps = await screen.findAllByRole('listitem');
    expect(steps.map((s) => s.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Send “Welcome” · Done · Sent “Welcome”',
      'Assign chat · Failed · Demo Agent cannot see this number',
    ]);
  });

  it('testRunsAreLabelled', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...routes([{ ...RUN, test: true, status: 'TESTING' }]) });
    renderApp('/automations/r1/runs');
    const row = within((await screen.findByText('Message from Asha')).closest('tr') as HTMLElement);
    expect(row.getByText('Test')).toBeVisible();
    expect(row.getByText('Testing')).toBeVisible();
  });

  it('showsAPhoneWhenTheContactHasNoName', async () => {
    mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...routes([{ ...RUN, contact: { id: 'c9', name: null, phone: '919811100009' } }]),
    });
    renderApp('/automations/r1/runs');
    expect(await screen.findByText('+919811100009')).toBeVisible();
  });

  it('showsAnEmptyState', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...routes([]) });
    renderApp('/automations/r1/runs');
    expect(await screen.findByText('This rule has not run yet.')).toBeVisible();
  });

  it('pagesOlder', async () => {
    const fetch = mockFetch({ ...meAs(WORKSPACE_MANAGER), ...routes([RUN], 51) });
    const { user } = renderApp('/automations/r1/runs');
    expect(await screen.findByRole('button', { name: 'Newer' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Older' }));
    expect(await screen.findByRole('button', { name: 'Newer' })).toBeEnabled();
    expect(urls(fetch)).toContain(`${RULE}/runs?page=1`);
    expect(urls(fetch)).toContain(`${RULE}/runs?page=0`);
  });
});
