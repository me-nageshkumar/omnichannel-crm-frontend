import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { mockFetch } from '../../test/fetchMock';
import { renderApp } from '../../test/renderApp';
import { AUTOMATIONS_BASE, EVENT, RULE_SUMMARIES, automationRoutes } from '../../test/automations';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const EVENTS = `${AUTOMATIONS_BASE}/events`;
const open = (items = [EVENT]) =>
  mockFetch({
    ...meAs(WORKSPACE_MANAGER),
    ...automationRoutes({ [`GET ${EVENTS}`]: { status: 200, body: { items, total: items.length, page: 0 } } }),
  });
const eventUrls = (fn: ReturnType<typeof mockFetch>) =>
  fn.mock.calls.map(([u]) => String(u)).filter((u) => u.indexOf(EVENTS) === 0);
const last = (fn: ReturnType<typeof mockFetch>) => eventUrls(fn).slice(-1)[0];
const rowOf = async (text: string) => within((await screen.findByText(text)).closest('tr') as HTMLElement);

describe('event history', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('listsEventsWithMatchedRules', async () => {
    open();
    const { user } = renderApp('/automations?tab=history');
    const row = await rowOf('Message from Asha');
    expect(row.getByText('Welcome · Failed')).toBeVisible();
    expect(row.getByText('Done')).toBeVisible();
    await user.click(row.getByRole('button', { name: /details/i }));
    expect(await screen.findByText(/Demo Agent cannot see this number/)).toBeVisible();
  });

  it('noRuleMatched', async () => {
    open([{ ...EVENT, runs: [], test: true }]);
    renderApp('/automations?tab=history');
    const row = await rowOf('Message from Asha');
    expect(row.getByText('No rule matched.')).toBeVisible();
    expect(row.getByText('Test')).toBeVisible();
  });

  it('filtersByKindAndRule', async () => {
    const fetch = open();
    const { user } = renderApp('/automations?tab=history');
    await screen.findByText('Message from Asha');
    await user.selectOptions(screen.getByLabelText('Event kind'), 'DEAL_LANE_CHANGED');
    await user.selectOptions(screen.getByLabelText('Rule'), 'r1');
    await waitFor(() => expect(last(fetch)).toBe(`${EVENTS}?kind=DEAL_LANE_CHANGED&ruleId=r1&page=0`));
    expect(screen.getByRole('option', { name: 'All events' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: RULE_SUMMARIES[0].name })).toBeInTheDocument();
  });

  it('filtersByDates', async () => {
    const fetch = open();
    const { user } = renderApp('/automations?tab=history');
    await screen.findByText('Message from Asha');
    await user.type(screen.getByLabelText('From'), '2026-03-05');
    await user.type(screen.getByLabelText('To'), '2026-03-06');
    const from = new Date(2026, 2, 5, 0, 0, 0, 0).toISOString();
    const to = new Date(2026, 2, 6, 23, 59, 59, 999).toISOString();
    await waitFor(() => {
      const q = new URL(last(fetch), 'http://localhost').searchParams;
      expect(q.get('from')).toBe(from);
      expect(q.get('to')).toBe(to);
    });
  });

  it('onlyThisContact', async () => {
    const fetch = open();
    const { user } = renderApp('/automations?tab=history');
    await user.click(await screen.findByRole('button', { name: 'Only this contact' }));
    await waitFor(() => expect(last(fetch)).toBe(`${EVENTS}?contactId=c1&page=0`));
    const chip = await screen.findByText('Asha', { selector: '.pf-v6-c-label__text' });
    expect(chip).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove contact filter' }));
    await waitFor(() => expect(last(fetch)).toBe(`${EVENTS}?page=0`));
    expect(screen.queryByText('Asha', { selector: '.pf-v6-c-label__text' })).not.toBeInTheDocument();
  });

  it('failedEventShowsError', async () => {
    open([{ ...EVENT, outcome: 'FAILED', error: 'The rule engine stopped' }]);
    renderApp('/automations?tab=history');
    const row = await rowOf('Message from Asha');
    expect(row.getByText('Failed')).toBeVisible();
    expect(row.getByText('The rule engine stopped')).toBeVisible();
  });
});
