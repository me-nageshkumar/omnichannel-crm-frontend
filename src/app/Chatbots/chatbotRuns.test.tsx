import '../../test/reactFlowStub';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import type { MockRoute } from '../../test/fetchMock';
import { mockFetch } from '../../test/fetchMock';
import { LocationProbe, renderApp } from '../../test/renderApp';
import { CHATBOTS_BASE, RUN_DONE, RUN_WAITING, chatbotRoutes } from '../../test/chatbots';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../test/session';

const RUNS = `${CHATBOTS_BASE}/c1/runs`;
const urls = (fn: ReturnType<typeof mockFetch>) => fn.mock.calls.map(([u]) => String(u));

function open(routes: Record<string, MockRoute> = {}) {
  const f = mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes(routes) });
  return { f, ...renderApp('/chatbots/c1/runs', <LocationProbe />) };
}

describe('chatbot runs', () => {
  beforeEach(() => storeSession());
  afterEach(() => vi.unstubAllGlobals());

  it('listsRunsAndFilters', async () => {
    const { f, user } = open();
    expect(await screen.findByRole('heading', { name: 'Lead qualifier · Runs' })).toBeVisible();
    const rows = within(screen.getByRole('grid', { name: 'Runs' }))
      .getAllByRole('row')
      .slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Veenu');
    expect(rows[0]).toHaveTextContent('Main line');
    expect(rows[0]).toHaveTextContent('Waiting for a WhatsApp reply');
    expect(rows[0]).toHaveTextContent('AskBudget');
    expect(rows[0]).toHaveTextContent('Test');
    expect(rows[1]).toHaveTextContent('Completed');
    expect(rows[1]).toHaveTextContent('High');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'FAILED');
    expect(urls(f).some((u) => u.indexOf(`${RUNS}?status=FAILED`) >= 0)).toBe(true);
  });

  it('backLinkToTheRuleTest', async () => {
    mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes() });
    renderApp('/chatbots/c1?run=r1&back=%2Fautomations%2Fr1%2Ftest');
    const panel = await screen.findByRole('dialog', { name: 'Run' });
    expect(within(panel).getByRole('link', { name: 'Back to rule test' })).toHaveAttribute(
      'href',
      '/automations/r1/test',
    );
  });

  it('backLinkIgnoresForeignTargets', async () => {
    // only a rule test path is followed: absolute URLs, backslash and whitespace tricks the browser resolves
    // cross-origin, and other in-app pages are all ignored
    for (const back of [
      'https%3A%2F%2Fevil.example%2Fx',
      '%2F%5Cevil.example',
      '%2F%09%2Fevil.example',
      '%2Fchatbots%2Fc2',
    ]) {
      cleanup();
      mockFetch({ ...meAs(WORKSPACE_MANAGER), ...chatbotRoutes() });
      renderApp(`/chatbots/c1?run=r1&back=${back}`);
      const panel = await screen.findByRole('dialog', { name: 'Run' });
      expect(within(panel).queryByRole('link', { name: 'Back to rule test' })).toBeNull();
    }
  });

  it('openRunShowsSteps', async () => {
    const { user } = open({ [`GET ${RUNS}`]: { status: 200, body: { items: [RUN_DONE], total: 1 } } });
    await user.click(await screen.findByRole('button', { name: 'Veenu' }));
    const panel = await screen.findByRole('dialog', { name: 'Run' });
    const steps = within(within(panel).getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[2]).toHaveTextContent('High');
    expect(within(panel).getByRole('link', { name: 'Show on canvas' })).toHaveAttribute('href', '/chatbots/c1?run=r2');
  });

  it('showOnCanvasOpensTheEditorWithTheRun', async () => {
    const { user } = open({ [`GET ${RUNS}`]: { status: 200, body: { items: [RUN_WAITING], total: 1 } } });
    await user.click(await screen.findByRole('button', { name: 'Veenu' }));
    await user.click(await screen.findByRole('link', { name: 'Show on canvas' }));
    expect(await screen.findByRole('heading', { name: 'Lead qualifier' })).toBeVisible();
    expect(screen.getByLabelText('Location')).toHaveTextContent('/chatbots/c1');
    const panel = await screen.findByRole('dialog', { name: 'Run' });
    expect(within(panel).getByText(/waiting at AskBudget for a WhatsApp reply/)).toBeVisible();
    expect(screen.getByRole('listitem', { name: 'AskBudget' })).toHaveTextContent('Waiting');
  });

  it('showsAnEmptyState', async () => {
    open({ [`GET ${RUNS}`]: { status: 200, body: { items: [], total: 0 } } });
    expect(await screen.findByText('This chatbot has not run yet.')).toBeVisible();
  });
});
