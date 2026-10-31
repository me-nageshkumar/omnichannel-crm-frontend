import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleChecklist, sampleDeal, sampleRecurrence, sampleTask } from '../../../test/crm';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import { storeSession } from '../../../test/session';
import type { Task } from '@app/api/crm';

const AUTH = ['crm:view', 'crm:edit', 'crm:delete'];
const routes = (tasks: Task[], extra = {}, authorities = AUTH) =>
  boardRoutes(
    {
      [`GET ${BASE}/deals/d1`]: { status: 200, body: sampleDeal() },
      [`GET ${BASE}/activities`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
      [`GET ${BASE}/tasks`]: { status: 200, body: { items: tasks, total: tasks.length, page: 0 } },
      ...extra,
    },
    { authorities },
  );

async function openTasks() {
  const rendered = renderApp('/crm/deals/d1?pipelineId=p1');
  await rendered.user.click(await screen.findByRole('tab', { name: 'Tasks' }));
  return rendered;
}

const stepped = () => sampleTask({ checklist: sampleChecklist() });

describe('CRM task row (phase E)', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('tickExpandsAndPostsThenRendersServerTask', async () => {
    const ticked = stepped();
    ticked.checklist[1] = { ...ticked.checklist[1], done: true, doneBy: { id: 'u4', name: 'Meera Manager' } };
    const f = mockFetch(routes([stepped()], { [`POST ${BASE}/tasks/t1/checklist/c2`]: { status: 200, body: ticked } }));
    const { user } = await openTasks();
    const row = await screen.findByRole('listitem', { name: 'Call back' });
    expect(within(row).queryByRole('checkbox', { name: 'Mention the festive discount' })).toBeNull();
    await user.click(within(row).getByRole('button', { name: '1/3' }));
    await user.click(within(row).getByRole('checkbox', { name: 'Mention the festive discount' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/tasks/t1/checklist/c2`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/tasks/t1/checklist/c2`)?.body).toEqual({ done: true });
    expect(await within(row).findByRole('button', { name: '2/3' })).toBeInTheDocument();
    expect(within(row).getByRole('checkbox', { name: 'Mention the festive discount' })).toBeChecked();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lastTickOffersToComplete', async () => {
    const start = stepped();
    start.checklist = start.checklist.map((s, i) => (i < 2 ? { ...s, done: true } : s));
    const allDone = stepped();
    allDone.checklist = allDone.checklist.map((s) => ({ ...s, done: true }));
    const f = mockFetch(
      routes([start], {
        [`POST ${BASE}/tasks/t1/checklist/c3`]: { status: 200, body: allDone },
        [`POST ${BASE}/tasks/t1/complete`]: { status: 200, body: { ...allDone, status: 'DONE' } },
      }),
    );
    const { user } = await openTasks();
    const row = await screen.findByRole('listitem', { name: 'Call back' });
    await user.click(within(row).getByRole('button', { name: '2/3' }));
    await user.click(within(row).getByRole('checkbox', { name: 'Ask about quantities' }));
    const dialog = await screen.findByRole('dialog', { name: 'All steps done' });
    expect(within(dialog).getByText('Mark the task done?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Mark done' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/tasks/t1/complete`)).toBeDefined());
  });

  it('completeWithUntickedStepsAsks', async () => {
    const f = mockFetch(routes([stepped()], { [`POST ${BASE}/tasks/t1/complete`]: { status: 200, body: stepped() } }));
    const { user } = await openTasks();
    await user.click(await screen.findByRole('checkbox', { name: 'Complete Call back' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark the task done?' });
    expect(within(dialog).getByText('2 steps are not ticked yet.')).toBeInTheDocument();
    expect(requestTo(f, `POST ${BASE}/tasks/t1/complete`)).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Mark done' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/tasks/t1/complete`)).toBeDefined());
  });

  it('skipConfirmsAndReportsNext', async () => {
    const repeating = sampleTask({ recurrence: sampleRecurrence() });
    const f = mockFetch(
      routes([repeating], {
        [`POST ${BASE}/tasks/t1/skip`]: {
          status: 200,
          body: {
            skipped: { ...repeating, status: 'CANCELLED', nextOccurrenceId: 't2' },
            next: sampleTask({ id: 't2', occurrence: 2, recurrence: sampleRecurrence() }),
          },
        },
      }),
    );
    const { user } = await openTasks();
    const row = await screen.findByRole('listitem', { name: 'Call back' });
    expect(within(row).getByLabelText('Repeats weekly on Mon, Thu')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Skip Call back' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skip this one?' });
    expect(within(dialog).getByText('The next one is scheduled straight away.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/tasks/t1/skip`)).toBeDefined());
    expect(await screen.findByText('Skipped. Next one scheduled.')).toBeInTheDocument();
  });

  it('fromMarkerForDelegatedTask', async () => {
    mockFetch(
      routes([
        sampleTask({ assignedBy: { id: 'u2', name: 'Priya Agent' } }),
        sampleTask({ id: 't2', title: 'Own one', assignedBy: { id: 'u4', name: 'Meera Manager' } }),
      ]),
    );
    await openTasks();
    const mine = await screen.findByRole('listitem', { name: 'Call back' });
    expect(within(mine).getByText(/from Priya Agent/)).toBeInTheDocument();
    const own = screen.getByRole('listitem', { name: 'Own one' });
    expect(within(own).queryByText(/from /)).toBeNull();
  });

  it('viewOnlyAssigneeCanWorkOwnTaskOnly', async () => {
    mockFetch(
      routes(
        [
          sampleTask({ recurrence: sampleRecurrence(), checklist: sampleChecklist() }),
          sampleTask({
            id: 't2',
            title: 'Theirs',
            assignee: { id: 'u2', name: 'Priya Agent' },
            recurrence: sampleRecurrence(),
          }),
        ],
        {},
        ['crm:view'],
      ),
    );
    await openTasks();
    const mine = await screen.findByRole('listitem', { name: 'Call back' });
    expect(within(mine).getByRole('checkbox', { name: 'Complete Call back' })).toBeEnabled();
    expect(within(mine).getByRole('button', { name: 'Skip Call back' })).toBeInTheDocument();
    expect(within(mine).queryByRole('button', { name: 'Edit Call back' })).toBeNull();
    expect(within(mine).queryByRole('button', { name: 'Delete Call back' })).toBeNull();
    const theirs = screen.getByRole('listitem', { name: 'Theirs' });
    expect(within(theirs).getByRole('checkbox', { name: 'Complete Theirs' })).toBeDisabled();
    expect(within(theirs).queryByRole('button', { name: 'Skip Theirs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
  });

  it('cancelledTaskShowsSkipped', async () => {
    mockFetch(routes([sampleTask({ status: 'CANCELLED', recurrence: sampleRecurrence() })]));
    await openTasks();
    const row = await screen.findByRole('listitem', { name: 'Call back' });
    expect(within(row).getByText('Skipped')).toBeInTheDocument();
    expect(within(row).queryByRole('checkbox')).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Skip Call back' })).toBeNull();
  });

  it('completingRepeatingTaskReloadsList', async () => {
    const repeating = sampleTask({ recurrence: sampleRecurrence() });
    const f = mockFetch(
      routes([repeating], {
        [`POST ${BASE}/tasks/t1/complete`]: {
          status: 200,
          body: { ...repeating, status: 'DONE', nextOccurrenceId: 't2' },
        },
      }),
    );
    const { user } = await openTasks();
    await screen.findByRole('listitem', { name: 'Call back' });
    const before = callsTo(f, `GET ${BASE}/tasks`);
    await user.click(screen.getByRole('checkbox', { name: 'Complete Call back' }));
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/tasks`)).toBe(before + 1));
  });

  it('conflictOnSaveReloadsList', async () => {
    const f = mockFetch(
      routes([sampleTask()], {
        [`PUT ${BASE}/tasks/t1`]: {
          status: 409,
          body: { code: 'VERSION_CONFLICT', message: 'The task was changed by someone else; reload and retry' },
        },
      }),
    );
    const { user } = await openTasks();
    await screen.findByRole('listitem', { name: 'Call back' });
    const before = callsTo(f, `GET ${BASE}/tasks`);
    await user.click(screen.getByRole('button', { name: 'Edit Call back' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit task' });
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
    expect(await within(dialog).findByText(/Someone else changed this task/)).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/tasks`)).toBe(before + 1));
  });
});
