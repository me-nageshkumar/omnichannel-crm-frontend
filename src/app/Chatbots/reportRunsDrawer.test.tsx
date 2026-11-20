import '../../test/reactFlowStub';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { ChatbotReport, ReportRunRow } from '@app/api/chatbots';
import type { MockRoute } from '../../test/fetchMock';
import { mockFetch } from '../../test/fetchMock';
import { LocationProbe, renderApp } from '../../test/renderApp';
import { CHATBOTS_BASE, chatbotRoutes } from '../../test/chatbots';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const REPORT_URL = `${CHATBOTS_BASE}/c1/report`;
const RUNS_URL = `${CHATBOTS_BASE}/c1/report/runs`;

const REPORT: ChatbotReport = {
  totals: {
    started: 60,
    running: 0,
    completed: 10,
    wentSilent: 30,
    stopped: 0,
    failed: 0,
    handedOver: 20,
    jumped: 0,
    chat: { toAgent: 20, toQueue: 0, closed: 10, left: 0, notRecorded: 30 },
  },
  steps: [{ nodeId: 'ai1', name: 'Counsellor', type: 'ai', removed: false, reached: 60, endedHere: { ENDED: 30 } }],
  progress: [],
};

const OWNED_NOBODY: ReportRunRow = {
  runId: 'r1',
  contactName: 'Veenu',
  phone: '919799750743',
  numberLabel: 'Main line',
  startedAt: '2026-11-20T10:00:00Z',
  finishedAt: '2026-11-20T12:00:00Z',
  status: 'HANDED_OVER',
  ending: { chat: 'HANDED_OVER', agentUserId: 'u1', teamId: 't1', at: '2026-11-20T12:00:00Z' },
  agentName: 'Asha',
  teamName: 'Counsellors',
  progress: { name: 'Veenu', city: 'Indore' },
  chatId: 'ch1',
  dealId: 'd1',
  dealPipelineId: 'p1',
  leadOwnerName: null,
};

const NO_DEAL: ReportRunRow = {
  ...OWNED_NOBODY,
  runId: 'r2',
  contactName: 'Ravi',
  status: 'ENDED',
  ending: { chat: 'ROUTED', agentUserId: null, teamId: 't1', at: '2026-11-20T12:00:00Z' },
  agentName: null,
  chatId: 'ch2',
  dealId: null,
  dealPipelineId: null,
  leadOwnerName: null,
  progress: null,
};

const runsCalls = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.map(([u]) => String(u)).filter((u) => new URL(u, 'http://localhost').pathname === RUNS_URL);

function open(runs: MockRoute) {
  const f = mockFetch({
    ...meAs(WORKSPACE_MANAGER),
    ...chatbotRoutes({ [`GET ${REPORT_URL}`]: { status: 200, body: REPORT }, [`GET ${RUNS_URL}`]: runs }),
  });
  return { f, ...renderApp('/chatbots/report?chatbot=c1', <LocationProbe />) };
}

const page = (items: ReportRunRow[], total = items.length): MockRoute => ({
  status: 200,
  body: { items, total, page: 0, size: 25 },
});

describe('report runs drawer', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('lists the runs for the clicked number', async () => {
    const { f, user } = open(page([OWNED_NOBODY, NO_DEAL]));
    const steps = await screen.findByRole('grid', { name: 'Steps' });
    await user.click(within(steps).getByRole('button', { name: 'Ended at Counsellor: 30 runs' }));
    const drawer = await screen.findByRole('dialog', { name: 'Ended at Counsellor' });
    await waitFor(() => expect(within(drawer).getAllByRole('row')).toHaveLength(3));
    const q = new URL(runsCalls(f)[0], 'http://localhost').searchParams;
    expect(q.get('nodeId')).toBe('ai1');
    expect(q.get('reached')).toBeNull();
    expect(q.get('page')).toBe('0');
    expect(q.get('size')).toBe('25');
    expect(q.get('from')).not.toBeNull();
    const first = within(drawer).getAllByRole('row')[1];
    expect(first).toHaveTextContent('Veenu');
    expect(first).toHaveTextContent('Main line');
    expect(first).toHaveTextContent('Handed over · Asha');
    expect(first).toHaveTextContent('name, city');
    expect(within(drawer).getAllByRole('row')[2]).toHaveTextContent('waiting in Counsellors');
  });

  it('row links to chat, lead and run', async () => {
    const { user } = open(page([OWNED_NOBODY]));
    await user.click(
      within(await screen.findByRole('grid', { name: 'Steps' })).getByRole('button', {
        name: 'Ended at Counsellor: 30 runs',
      }),
    );
    const row = within(await screen.findByRole('dialog', { name: 'Ended at Counsellor' })).getAllByRole('row')[1];
    await waitFor(() =>
      expect(within(row).getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/inbox/chats/ch1'),
    );
    expect(within(row).getByRole('link', { name: 'Lead' })).toHaveAttribute('href', '/crm/deals/d1?pipelineId=p1');
    expect(within(row).getByRole('link', { name: 'Run' })).toHaveAttribute('href', '/chatbots/c1?run=r1');
  });

  it('unowned lead shows No owner', async () => {
    const { user } = open(page([OWNED_NOBODY]));
    await user.click(
      within(await screen.findByRole('grid', { name: 'Steps' })).getByRole('button', {
        name: 'Ended at Counsellor: 30 runs',
      }),
    );
    const drawer = await screen.findByRole('dialog', { name: 'Ended at Counsellor' });
    expect(await within(drawer).findByText('No owner')).toBeVisible();
  });

  it('noDealNoLeadLink', async () => {
    const { user } = open(page([NO_DEAL]));
    await user.click(
      within(await screen.findByRole('grid', { name: 'Steps' })).getByRole('button', {
        name: 'Ended at Counsellor: 30 runs',
      }),
    );
    const drawer = await screen.findByRole('dialog', { name: 'Ended at Counsellor' });
    const row = (await within(drawer).findAllByRole('row'))[1];
    await waitFor(() => expect(row).toHaveTextContent('Ravi'));
    expect(within(row).queryByRole('link', { name: 'Lead' })).toBeNull();
    expect(within(row).queryByText('No owner')).toBeNull();
  });

  it('pages through results', async () => {
    const { f, user } = open(page([OWNED_NOBODY], 60));
    await user.click(
      within(await screen.findByRole('grid', { name: 'Steps' })).getByRole('button', {
        name: 'Ended at Counsellor: 30 runs',
      }),
    );
    const drawer = await screen.findByRole('dialog', { name: 'Ended at Counsellor' });
    await user.click(await within(drawer).findByRole('button', { name: 'Older' }));
    await waitFor(() =>
      expect(runsCalls(f).some((u) => new URL(u, 'http://localhost').searchParams.get('page') === '1')).toBe(true),
    );
  });

  it('Running opens the active runs', async () => {
    const f = mockFetch({
      ...meAs(WORKSPACE_MANAGER),
      ...chatbotRoutes({
        [`GET ${REPORT_URL}`]: { status: 200, body: { ...REPORT, totals: { ...REPORT.totals, running: 2 } } },
        [`GET ${RUNS_URL}`]: page([OWNED_NOBODY]),
      }),
    });
    const { user } = renderApp('/chatbots/report?chatbot=c1');
    const totals = await screen.findByRole('region', { name: 'Totals' });
    await user.click(within(totals).getByRole('button', { name: 'Running 2' }));
    await screen.findByRole('dialog', { name: 'Running' });
    await waitFor(() => expect(new URL(runsCalls(f)[0], 'http://localhost').searchParams.get('active')).toBe('true'));
  });

  it('a total opens the runs filtered by how the chat went', async () => {
    const { f, user } = open(page([OWNED_NOBODY]));
    const totals = await screen.findByRole('region', { name: 'Totals' });
    await user.click(within(totals).getByRole('button', { name: 'To an agent 20' }));
    await screen.findByRole('dialog', { name: 'To an agent' });
    await waitFor(() => expect(new URL(runsCalls(f)[0], 'http://localhost').searchParams.get('chat')).toBe('TO_AGENT'));
  });
});
