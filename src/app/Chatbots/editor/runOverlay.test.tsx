import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Run } from '@app/api/chatbots';
import { RunOverlayPanel } from '@app/Chatbots/editor/RunOverlayPanel';
import { runByNode, useRunPolling } from '@app/Chatbots/editor/useRunPolling';
import { SessionProvider } from '@app/session/SessionContext';
import {
  CHATBOTS_BASE,
  LEAD_QUALIFIER,
  RUN_AI_THINKING,
  RUN_DONE,
  RUN_FORM_WAITING,
  RUN_WAITING,
} from '../../../test/chatbots';
import { callsTo, mockFetch } from '../../../test/fetchMock';
import type { MockRoute } from '../../../test/fetchMock';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';

const RUN = `${CHATBOTS_BASE}/c1/runs/r1`;

function inTurn(...runs: Run[]): MockRoute {
  let n = 0;
  return () => ({ status: 200, body: runs[Math.min(n++, runs.length - 1)] });
}

/** Polls like the editor does and shows the panel for what came back. */
const Poller: React.FunctionComponent<{ onStop?: () => void }> = ({ onStop }) => {
  const { run } = useRunPolling('c1', 'r1');
  return run ? (
    <RunOverlayPanel
      run={run}
      flow={LEAD_QUALIFIER.flow}
      onStop={onStop ?? (() => undefined)}
      onClose={() => undefined}
    />
  ) : (
    <span>loading</span>
  );
};

function openPolling(route: MockRoute, extra: Record<string, MockRoute> = {}) {
  const f = mockFetch({ ...meAs(WORKSPACE_MANAGER), [`GET ${RUN}`]: route, ...extra });
  render(
    <SessionProvider>
      <Poller />
    </SessionProvider>,
  );
  return f;
}

function openPanel(run: Run, props: Partial<React.ComponentProps<typeof RunOverlayPanel>> = {}) {
  cleanup();
  const onStop = vi.fn();
  render(<RunOverlayPanel run={run} flow={LEAD_QUALIFIER.flow} onStop={onStop} onClose={() => undefined} {...props} />);
  return { onStop, user: userEvent.setup() };
}

describe('run overlay', () => {
  beforeEach(() => storeSession());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pollsEverySecondsWhileActive', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = openPolling(inTurn(RUN_WAITING, RUN_DONE));
    expect(await screen.findByText('Waiting')).toBeVisible();
    expect(callsTo(f, `GET ${RUN}`)).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(await screen.findByText('Completed')).toBeVisible();
    expect(callsTo(f, `GET ${RUN}`)).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(callsTo(f, `GET ${RUN}`)).toBe(2);
  });

  it('showsStepsAndWaitingNode', () => {
    openPanel(RUN_WAITING);
    expect(screen.getByText(/waiting at AskBudget for a WhatsApp reply/)).toBeVisible();
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent('Welcome');
    expect(steps[0]).toHaveTextContent('Reply “Yes”');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
  });

  it('aiStepShowsTurnReplyOutcomeTokens', () => {
    openPanel(RUN_AI_THINKING);
    const step = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')[0];
    expect(step).toHaveTextContent('Turn 2: waiting for the AI');
    // the summary says which turn; the detail line does not repeat it
    expect(step.querySelector('.omni-run__detail')).not.toHaveTextContent('Turn');
    expect(step).toHaveTextContent('We have red shirts in M and L. Which size would you like?');
    expect(step).toHaveTextContent('120 in / 45 out tokens');
    const long = 'x'.repeat(300);
    openPanel({
      ...RUN_AI_THINKING,
      status: 'COMPLETED',
      waiting: null,
      variables: { Sales: { turns: 3, reply: long, outcome: 'booked', usage: { inputTokens: 1, outputTokens: 2 } } },
    });
    const done = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')[0];
    expect(done).toHaveTextContent('Outcome: booked');
    expect(done).toHaveTextContent(`${'x'.repeat(200)}…`);
    expect(done).not.toHaveTextContent('x'.repeat(201));
  });

  it('aiStepDetailSpansTheStepRow', () => {
    openPanel(RUN_AI_THINKING);
    const step = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')[0];
    const detail = step.querySelector('.omni-run__detail') as HTMLElement;
    expect(detail).not.toBeNull();
    // after the time, so the grid's first row keeps icon, name and time together
    expect(step.lastElementChild).toBe(detail);
    const css = readFileSync(resolve(__dirname, '../../app.css'), 'utf8');
    expect(css).toMatch(/\.omni-run__detail\s*\{[^}]*grid-column:\s*2\s*\/\s*4/);
    // the time is pinned to the first row's last column, or auto-placement drops it into the 20px icon column
    expect(css).toMatch(/\.omni-run__time\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1/);
    expect(step.querySelector('time')).toHaveClass('omni-run__time');
  });

  it('waitingOnAiShowsThinking', () => {
    openPanel(RUN_AI_THINKING);
    expect(screen.getByText('The AI is thinking…')).toBeVisible();
    expect(screen.queryByText(/waiting at Sales/)).toBeNull();
  });

  it('formWaitAndFinishedRunHaveNoStop', () => {
    openPanel(RUN_FORM_WAITING);
    expect(screen.getByText(/for the form/)).toBeVisible();
    const { onStop } = openPanel(RUN_DONE);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(screen.getByText('Finished after High')).toBeVisible();
    void onStop;
  });

  it('overlayToleratesMissingNode', () => {
    const run: Run = {
      ...RUN_DONE,
      steps: RUN_DONE.steps.concat([{ ...RUN_DONE.steps[2], index: 3, nodeId: 'gone', nodeName: 'OldNode' }]),
    };
    openPanel(run);
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
    expect(steps[3]).toHaveTextContent('OldNode (removed)');
    expect(runByNode(run)).toEqual({ n1: 'done', n2: 'done', n3: 'done', gone: 'done' });
    expect(runByNode(RUN_WAITING)).toEqual({ n1: 'done', n2: 'waiting' });
  });

  it('copyVariablePath', async () => {
    const { user } = openPanel(RUN_DONE);
    // user-event installs its own clipboard stub at setup; spy on that one
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Variables' }));
    await user.click(await screen.findByRole('button', { name: 'Copy {{AskBudget.answer}}' }));
    expect(writeText).toHaveBeenCalledWith('{{AskBudget.answer}}');
  });

  it('stopCallsApi', async () => {
    const { onStop, user } = openPanel(RUN_WAITING);
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(onStop).toHaveBeenCalled());
  });
});
