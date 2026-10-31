import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { callsTo, mockFetch, requestTo } from '../../../test/fetchMock';
import { gate } from '../../../test/gate';
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
    const progress = within(row).getByRole('button', { name: '1/3' });
    expect(progress).toHaveAttribute('aria-expanded', 'false');
    await user.click(progress);
    const controlled = document.getElementById(progress.getAttribute('aria-controls') as string) as HTMLElement;
    expect(within(controlled).getByRole('checkbox', { name: 'Mention the festive discount' })).toBeInTheDocument();
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
    expect(within(row).queryByText('Not done')).toBeNull();
    expect(within(row).queryByRole('checkbox')).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Skip Call back' })).toBeNull();
  });

  it('aFinishedActionLeavesAnotherRowBusy', async () => {
    const f = mockFetch(
      routes([sampleTask(), sampleTask({ id: 't2', title: 'Second' })], {
        [`POST ${BASE}/tasks/t1/complete`]: { status: 200, body: sampleTask({ status: 'DONE' }) },
        [`POST ${BASE}/tasks/t2/complete`]: {
          status: 200,
          body: sampleTask({ id: 't2', title: 'Second', status: 'DONE' }),
        },
      }),
    );
    const first = gate(f, `POST ${BASE}/tasks/t1/complete`, 1);
    const { user } = await openTasks();
    await user.click(await screen.findByRole('checkbox', { name: 'Complete Call back' }));
    await user.click(screen.getByRole('checkbox', { name: 'Complete Second' }));
    await screen.findByRole('checkbox', { name: 'Reopen Second' });
    expect(screen.getByRole('checkbox', { name: 'Complete Call back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit Call back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Call back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit Second' })).toBeEnabled();
    first.release();
    await screen.findByRole('checkbox', { name: 'Reopen Call back' });
    expect(screen.getByRole('button', { name: 'Edit Call back' })).toBeEnabled();
  });

  it.each([
    ['TASK_NOT_OPEN', 'This task is already closed.'],
    ['NOT_RECURRING', 'This task no longer repeats.'],
  ])('%s explains itself and refreshes the list', async (code, text) => {
    const repeating = sampleTask({ recurrence: sampleRecurrence() });
    const f = mockFetch(
      routes([repeating], { [`POST ${BASE}/tasks/t1/skip`]: { status: 400, body: { code, message: 'no' } } }),
    );
    const { user } = await openTasks();
    await screen.findByRole('listitem', { name: 'Call back' });
    const before = callsTo(f, `GET ${BASE}/tasks`);
    await user.click(screen.getByRole('button', { name: 'Skip Call back' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skip this one?' });
    await user.click(within(dialog).getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, `GET ${BASE}/tasks`)).toBe(before + 1));
  });

  it('aFailedDeleteStaysInItsDialog', async () => {
    let fails = true;
    const f = mockFetch(
      routes([sampleTask()], {
        [`DELETE ${BASE}/tasks/t1`]: () =>
          fails ? { status: 500, body: { message: 'down' } } : { status: 204, body: null },
      }),
    );
    const { user } = await openTasks();
    await user.click(await screen.findByRole('button', { name: 'Delete Call back' }));
    const dialog = await screen.findByRole('dialog', { name: /Delete Call back\?/ });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText('Could not delete the task. Try again.')).toBeInTheDocument();
    expect(screen.getAllByText('Could not delete the task. Try again.')).toHaveLength(1);
    fails = false;
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Delete Call back\?/ })).toBeNull());
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Call back' })).toBeNull());
    expect(callsTo(f, `DELETE ${BASE}/tasks/t1`)).toBe(2);
  });

  it('aLaterActionClearsTheSkipNotice', async () => {
    const repeating = sampleTask({ recurrence: sampleRecurrence() });
    const other = sampleTask({ id: 't2', title: 'Other one' });
    mockFetch(
      routes([repeating, other], {
        [`POST ${BASE}/tasks/t1/skip`]: {
          status: 200,
          body: { skipped: { ...repeating, status: 'CANCELLED' }, next: sampleTask({ id: 't3', title: 'Next one' }) },
        },
        [`POST ${BASE}/tasks/t2/complete`]: { status: 200, body: { ...other, status: 'DONE' } },
      }),
    );
    const { user } = await openTasks();
    await user.click(await screen.findByRole('button', { name: 'Skip Call back' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skip this one?' });
    await user.click(within(dialog).getByRole('button', { name: 'Skip' }));
    await screen.findByText('Skipped. Next one scheduled.');
    await user.click(await screen.findByRole('checkbox', { name: 'Complete Other one' }));
    await waitFor(() => expect(screen.queryByText('Skipped. Next one scheduled.')).toBeNull());
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
