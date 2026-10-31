import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { sampleChecklist, sampleRecurrence, sampleTask } from '../../../test/crm';
import { BASE } from '../../../test/crmBoard';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { SessionProvider } from '@app/session/SessionContext';
import { TaskFormModal } from '@app/Crm/tasks/TaskFormModal';
import type { Task } from '@app/api/crm';

const POST = `POST ${BASE}/tasks`;
const PUT = `PUT ${BASE}/tasks/t1`;

function open(task?: Task, routes: Record<string, unknown> = {}) {
  const f = mockFetch({
    ...meAs(WORKSPACE_MANAGER),
    [POST]: { status: 200, body: sampleTask() },
    [PUT]: { status: 200, body: sampleTask() },
    ...(routes as Record<string, never>),
  });
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <SessionProvider>
        <TaskFormModal
          target={{ type: 'DEAL', id: 'd1' }}
          task={task}
          taskTypes={[]}
          onSaved={() => undefined}
          onClose={() => undefined}
        />
      </SessionProvider>
    </MemoryRouter>,
  );
  return { f, user };
}

const dialog = async (name: string) => screen.findByRole('dialog', { name });

describe('CRM task form: steps and repeat (phase E)', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('addsMovesAndRemovesSteps', async () => {
    const { f, user } = open();
    const d = await dialog('New task');
    await user.type(within(d).getByLabelText(/^Title/), 'Onboard');
    const add = within(d).getByLabelText('Add a step');
    await user.type(add, 'Send price list{Enter}');
    await user.type(add, 'Collect GST{Enter}');
    await user.type(add, 'Book demo{Enter}');
    expect(within(d).getByLabelText('Step 1')).toHaveValue('Send price list');
    expect(within(d).getByLabelText('Step 3')).toHaveValue('Book demo');
    await user.click(within(d).getAllByRole('button', { name: 'Move up' })[2]);
    expect(within(d).getByLabelText('Step 2')).toHaveValue('Book demo');
    await user.click(within(d).getAllByRole('button', { name: 'Remove step' })[0]);
    expect(within(d).getByLabelText('Step 1')).toHaveValue('Book demo');
    expect(within(d).queryByLabelText('Step 3')).toBeNull();
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(requestTo(f, POST)).toBeDefined());
    expect(requestTo(f, POST)?.body.checklist).toEqual([{ text: 'Book demo' }, { text: 'Collect GST' }]);
    expect(requestTo(f, POST)?.body.recurrence).toBeNull();
  });

  it('keepsIdsOfExistingSteps', async () => {
    const { f, user } = open(sampleTask({ checklist: sampleChecklist() }));
    const d = await dialog('Edit task');
    expect(within(d).getAllByText('done')).toHaveLength(1);
    const second = within(d).getByLabelText('Step 2');
    await user.clear(second);
    await user.type(second, 'Mention the discount');
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(requestTo(f, PUT)).toBeDefined());
    expect(requestTo(f, PUT)?.body.checklist).toEqual([
      { id: 'c1', text: 'Attach the catalogue' },
      { id: 'c2', text: 'Mention the discount' },
      { id: 'c3', text: 'Ask about quantities' },
    ]);
    expect(requestTo(f, PUT)?.body.version).toBe(0);
  });

  it('repeatNeedsDueDate', async () => {
    const { f, user } = open();
    const d = await dialog('New task');
    await user.type(within(d).getByLabelText(/^Title/), 'Daily call');
    await user.selectOptions(within(d).getByLabelText('Repeat'), 'DAILY');
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    expect(await within(d).findByText('Set a due date to repeat.')).toBeInTheDocument();
    expect(requestTo(f, POST)).toBeUndefined();
    await user.type(within(d).getByLabelText('Due date'), '2026-11-02');
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(requestTo(f, POST)).toBeDefined());
    expect(requestTo(f, POST)?.body.recurrence).toMatchObject({
      frequency: 'DAILY',
      interval: 1,
      endsAfter: null,
      endsOn: null,
    });
  });

  it('weeklyDefaultsToDueWeekday', async () => {
    const { user } = open();
    const d = await dialog('New task');
    await user.type(within(d).getByLabelText('Due date'), '2026-11-05'); // a Thursday
    await user.selectOptions(within(d).getByLabelText('Repeat'), 'WEEKLY');
    expect(within(d).getByRole('checkbox', { name: 'Thu' })).toBeChecked();
    expect(within(d).getByRole('checkbox', { name: 'Mon' })).not.toBeChecked();
    expect(within(d).getByText(/^Repeats weekly on Thu\./)).toBeInTheDocument();
  });

  it('editKeepsStoredDayOfMonthAndZone', async () => {
    const task = sampleTask({
      dueAt: '2026-02-28T09:00:00.000Z',
      recurrence: sampleRecurrence({
        frequency: 'MONTHLY',
        interval: 1,
        weekdays: null,
        dayOfMonth: 31,
        timeZone: 'Asia/Kolkata',
      }),
    });
    const { f, user } = open(task);
    const d = await dialog('Edit task');
    expect(within(d).getByLabelText('Repeat')).toHaveValue('MONTHLY');
    expect(within(d).getByText(/^Repeats monthly on day 31\./)).toBeInTheDocument();
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(requestTo(f, PUT)).toBeDefined());
    expect(requestTo(f, PUT)?.body.recurrence).toMatchObject({
      frequency: 'MONTHLY',
      dayOfMonth: 31,
      timeZone: 'Asia/Kolkata',
    });
  });

  it('endsAfterOutOfRangeBlocked', async () => {
    const { f, user } = open();
    const d = await dialog('New task');
    await user.type(within(d).getByLabelText(/^Title/), 'Daily call');
    await user.type(within(d).getByLabelText('Due date'), '2026-11-02');
    await user.selectOptions(within(d).getByLabelText('Repeat'), 'DAILY');
    await user.click(within(d).getByRole('radio', { name: 'After' }));
    const count = within(d).getByLabelText('Number of times');
    await user.clear(count);
    await user.type(count, '1');
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    expect(await within(d).findByText('2 to 999')).toBeInTheDocument();
    expect(requestTo(f, POST)).toBeUndefined();
    await user.clear(count);
    await user.type(count, '6');
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(requestTo(f, POST)).toBeDefined());
    expect(requestTo(f, POST)?.body.recurrence).toMatchObject({ endsAfter: 6, endsOn: null });
  });

  it('serverRecurrenceErrorShowsOnField', async () => {
    const { user } = open(undefined, {
      [POST]: {
        status: 400,
        body: { code: 'VALIDATION', message: 'Invalid', fields: { 'recurrence.interval': 'must be 1 to 99' } },
      },
    });
    const d = await dialog('New task');
    await user.type(within(d).getByLabelText(/^Title/), 'Daily call');
    await user.type(within(d).getByLabelText('Due date'), '2026-11-02');
    await user.selectOptions(within(d).getByLabelText('Repeat'), 'DAILY');
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    expect(await within(d).findByText('must be 1 to 99')).toBeInTheDocument();
    expect(within(d).queryByText(/recurrence\.interval:/)).toBeNull();
  });

  it('thirtyStepsCap', async () => {
    const { user } = open(
      sampleTask({
        checklist: Array.from({ length: 30 }, (_u, i) => ({
          id: `c${i}`,
          text: `Step ${i + 1}`,
          done: false,
          doneAt: null,
          doneBy: null,
        })),
      }),
    );
    const d = await dialog('Edit task');
    const add = within(d).getByLabelText('Add a step');
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute('placeholder', 'At most 30 steps');
    await user.click(within(d).getAllByRole('button', { name: 'Remove step' })[29]);
    expect(within(d).getByLabelText('Add a step')).toBeEnabled();
  });
});
