import '../../test/reactFlowStub';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { ChatbotReport } from '@app/api/chatbots';
import type { MockRoute } from '../../test/fetchMock';
import { mockFetch } from '../../test/fetchMock';
import { LocationProbe, renderApp } from '../../test/renderApp';
import { CHATBOTS_BASE, chatbotRoutes } from '../../test/chatbots';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const REPORT_URL = `${CHATBOTS_BASE}/c1/report`;

const REPORT: ChatbotReport = {
  totals: {
    started: 120,
    running: 2,
    completed: 18,
    wentSilent: 28,
    stopped: 1,
    failed: 1,
    handedOver: 70,
    jumped: 0,
    chat: { toAgent: 74, toQueue: 6, closed: 18, left: 2, notRecorded: 0 },
  },
  steps: [
    { nodeId: 'n1', name: 'AddLead', type: 'add_to_crm', removed: false, reached: 120, endedHere: {} },
    {
      nodeId: 'ai1',
      name: 'Counsellor',
      type: 'ai',
      removed: false,
      reached: 120,
      endedHere: { ENDED: 28, FAILED: 1 },
    },
    { nodeId: 'n3', name: 'SaveDetails', type: 'update_contact', removed: false, reached: 79, endedHere: {} },
    { nodeId: 'old', name: 'OldAsk', type: null, removed: true, reached: 3, endedHere: { ENDED: 3 } },
  ],
  progress: [
    {
      nodeId: 'ai1',
      fields: [
        { key: 'name', label: 'name', given: 29 },
        { key: 'city', label: null, given: 20 },
      ],
      byCount: [12, 9, 11, 0],
    },
  ],
};

const reportCalls = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.map(([u]) => String(u)).filter((u) => new URL(u, 'http://localhost').pathname === REPORT_URL);

function open(path = '/chatbots/report?chatbot=c1', routes: Record<string, MockRoute> = {}) {
  const f = mockFetch({
    ...meAs(WORKSPACE_MANAGER),
    ...chatbotRoutes({ [`GET ${REPORT_URL}`]: { status: 200, body: REPORT }, ...routes }),
  });
  return { f, ...renderApp(path, <LocationProbe />) };
}

describe('chatbot report page', () => {
  it('a mistyped date in the link falls back to the default', async () => {
    const { f } = open('/chatbots/report?chatbot=c1&from=2026-13-01&to=2026-11-00');
    expect(await screen.findByRole('region', { name: 'Totals' })).toHaveTextContent('Started 120');
    const q = new URL(reportCalls(f)[0], 'http://localhost').searchParams;
    expect(Number.isNaN(new Date(q.get('from') ?? '').getTime())).toBe(false);
  });

  it('typing over a chosen date does not snap back', async () => {
    const { f, user } = open('/chatbots/report?chatbot=c1&from=2026-11-05&to=2026-11-20');
    await screen.findByRole('region', { name: 'Totals' });
    const fromBox = screen.getByRole('textbox', { name: 'From' });
    await user.clear(fromBox);
    await user.type(fromBox, '2026-11-10');
    expect(fromBox).toHaveValue('2026-11-10');
    const want = new Date('2026-11-10T00:00:00').toISOString();
    await waitFor(() =>
      expect(reportCalls(f).some((u) => new URL(u, 'http://localhost').searchParams.get('from') === want)).toBe(true),
    );
  });

  it('counts have names that say what they count', async () => {
    open();
    const grid = await screen.findByRole('grid', { name: 'Steps' });
    expect(within(grid).getByRole('button', { name: 'Reached Counsellor: 120 runs' })).toBeVisible();
    expect(within(grid).getByRole('button', { name: 'Ended at Counsellor: 29 runs' })).toBeVisible();
  });

  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('shows totals and the chat line', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Chatbot report' })).toBeVisible();
    const totals = await screen.findByRole('region', { name: 'Totals' });
    expect(totals).toHaveTextContent('Started 120');
    expect(totals).toHaveTextContent('Finished 18');
    expect(totals).toHaveTextContent('Went silent 28');
    expect(totals).toHaveTextContent('Handed over 70');
    expect(totals).toHaveTextContent('Running 2');
    expect(totals).toHaveTextContent('To an agent 74');
    expect(totals).toHaveTextContent('Waiting in a queue 6');
    expect(totals).toHaveTextContent('Closed by the chatbot 18');
    expect(totals).toHaveTextContent('Taken by someone else 2');
    expect(totals).not.toHaveTextContent('Not recorded');
  });

  it('steps in server order, removed under their heading', async () => {
    open();
    const grid = await screen.findByRole('grid', { name: 'Steps' });
    const rows = within(grid).getAllByRole('row').slice(1);
    const text = rows.map((r) => r.textContent ?? '');
    expect(text[0]).toContain('AddLead');
    expect(text[1]).toContain('Counsellor');
    expect(text[2]).toContain('SaveDetails');
    expect(text[3]).toContain('Removed steps');
    expect(text[4]).toContain('OldAsk');
  });

  it('AI row expands to progress and fields', async () => {
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: 'Counsellor' }));
    const grid = screen.getByRole('grid', { name: 'Steps' });
    expect(grid).toHaveTextContent('gave nothing 12 · 1 detail 9 · 2 details 11');
    expect(grid).toHaveTextContent('name 29 · city 20');
  });

  it('unknownProgressKeysShowByKey', async () => {
    const { user } = open('/chatbots/report?chatbot=c1', {
      [`GET ${REPORT_URL}`]: {
        status: 200,
        body: {
          ...REPORT,
          progress: [{ nodeId: 'ai1', fields: [{ key: 'budget', label: null, given: 4 }], byCount: [1, 4] }],
        },
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Counsellor' }));
    expect(screen.getByRole('grid', { name: 'Steps' })).toHaveTextContent('budget 4');
  });

  it('showsEmptyStateWithoutRuns', async () => {
    open('/chatbots/report?chatbot=c1', {
      [`GET ${REPORT_URL}`]: {
        status: 200,
        body: { ...REPORT, totals: { ...REPORT.totals, started: 0 }, steps: [], progress: [] },
      },
    });
    expect(await screen.findByText('No runs in this period')).toBeVisible();
    expect(screen.queryByRole('grid', { name: 'Steps' })).toBeNull();
  });

  it('defaults to the first chatbot and the last 30 days', async () => {
    const { f } = open('/chatbots/report');
    await screen.findByRole('region', { name: 'Totals' });
    const url = new URL(reportCalls(f)[0], 'http://localhost');
    const from = new Date(url.searchParams.get('from') ?? '');
    const to = new Date(url.searchParams.get('to') ?? '');
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(30);
  });

  it('number filter reloads with the number', async () => {
    const { f, user } = open();
    await screen.findByRole('region', { name: 'Totals' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Number' }), 'n1');
    await waitFor(() => expect(reportCalls(f).some((u) => u.indexOf('phoneNumberId=n1') >= 0)).toBe(true));
  });

  it('staleResponseIsIgnored', async () => {
    const base = mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes() });
    const pending: ((r: Response) => void)[] = [];
    const f = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(String(input), 'http://localhost').pathname === REPORT_URL)
        return new Promise<Response>((resolve) => pending.push(resolve));
      return base(input, init);
    });
    vi.stubGlobal('fetch', f);
    const { user } = renderApp('/chatbots/report?chatbot=c1');
    await waitFor(() => expect(pending).toHaveLength(1));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Number' }), 'n1');
    await waitFor(() => expect(pending).toHaveLength(2));
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    pending[1](json(REPORT));
    expect(await screen.findByRole('region', { name: 'Totals' })).toHaveTextContent('Started 120');
    pending[0](json({ ...REPORT, totals: { ...REPORT.totals, started: 5 } }));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('region', { name: 'Totals' })).toHaveTextContent('Started 120');
  });

  it('blocks ranges over 92 days without calling', async () => {
    const { f, user } = open();
    await screen.findByRole('region', { name: 'Totals' });
    const before = reportCalls(f).length;
    const fromBox = screen.getByRole('textbox', { name: 'From' });
    const toBox = screen.getByRole('textbox', { name: 'To' });
    await user.clear(fromBox);
    await user.type(fromBox, '2026-01-01');
    await user.clear(toBox);
    await user.type(toBox, '2026-06-01');
    expect(await screen.findByText('Choose at most 92 days')).toBeVisible();
    expect(reportCalls(f)).toHaveLength(before);
  });
});
