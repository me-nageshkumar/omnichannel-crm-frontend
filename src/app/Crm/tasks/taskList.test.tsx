import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { crmSettings, sampleDeal, sampleTask } from '../../../test/crm';
import { BASE, boardRoutes } from '../../../test/crmBoard';
import { WORKSPACE_MANAGER, meAs, storeSession } from '../../../test/session';
import { SessionProvider } from '@app/session/SessionContext';
import { TaskFormModal } from '@app/Crm/tasks/TaskFormModal';
import { dueLabel } from '@app/Crm/tasks/taskDisplay';

const AUTH = ['crm:view', 'crm:edit', 'crm:delete'];
const drawerRoutes = (extra = {}) =>
  boardRoutes(
    {
      [`GET ${BASE}/deals/d1`]: { status: 200, body: sampleDeal() },
      [`GET ${BASE}/activities`]: { status: 200, body: { items: [], total: 0, page: 0 } },
      [`GET ${BASE}/settings`]: { status: 200, body: crmSettings() },
      ...extra,
    },
    { authorities: AUTH },
  );

describe('CRM task list and form', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reminderAfterDueBlocked', async () => {
    const f = mockFetch({ ...meAs(WORKSPACE_MANAGER), [`POST ${BASE}/tasks`]: { status: 200, body: sampleTask() } });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SessionProvider>
          <TaskFormModal
            target={{ type: 'DEAL', id: 'd1' }}
            taskTypes={[]}
            onSaved={() => undefined}
            onClose={() => undefined}
          />
        </SessionProvider>
      </MemoryRouter>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText(/^Title/), 'Call back');
    await user.type(within(dialog).getByLabelText('Due date'), '2026-11-02');
    await user.type(within(dialog).getByLabelText('Due time'), '10:00');
    await user.type(within(dialog).getByLabelText('Reminder date'), '2026-11-02');
    await user.type(within(dialog).getByLabelText('Reminder time'), '11:00');
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
    expect(await within(dialog).findByText('The reminder must be at or before the due time.')).toBeInTheDocument();
    expect(requestTo(f, `POST ${BASE}/tasks`)).toBeUndefined();
    await user.clear(within(dialog).getByLabelText('Reminder time'));
    await user.type(within(dialog).getByLabelText('Reminder time'), '09:30');
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/tasks`)).toBeDefined());
    const body = requestTo(f, `POST ${BASE}/tasks`)?.body;
    expect(body).toMatchObject({ title: 'Call back', priority: 'NORMAL', target: { type: 'DEAL', id: 'd1' } });
    expect(new Date(body.dueAt).getTime() - new Date(body.reminderAt).getTime()).toBe(30 * 60_000);
  });

  it('addTaskFromDealDrawer', async () => {
    const f = mockFetch(
      drawerRoutes({
        [`GET ${BASE}/tasks`]: { status: 200, body: { items: [], total: 0, page: 0 } },
        [`POST ${BASE}/tasks`]: { status: 200, body: sampleTask({ title: 'Send quote' }) },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await user.click(await screen.findByRole('tab', { name: 'Tasks' }));
    await user.click(await screen.findByRole('button', { name: 'Add task' }));
    const dialog = await screen.findByRole('dialog', { name: 'New task' });
    await user.type(within(dialog).getByLabelText(/^Title/), 'Send quote');
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/tasks`)).toBeDefined());
    expect(requestTo(f, `POST ${BASE}/tasks`)?.body).toMatchObject({
      title: 'Send quote',
      target: { type: 'DEAL', id: 'd1' },
    });
    expect(await screen.findByText('Send quote')).toBeInTheDocument();
  });

  it('reopenDoneTask', async () => {
    const done = sampleTask({ status: 'DONE', completedAt: '2026-10-20T10:00:00Z' });
    const f = mockFetch(
      drawerRoutes({
        [`GET ${BASE}/tasks`]: {
          status: 200,
          body: { items: [sampleTask({ id: 't2', title: 'Open one' }), done], total: 2, page: 0 },
        },
        [`POST ${BASE}/tasks/t1/reopen`]: { status: 200, body: sampleTask() },
      }),
    );
    const { user } = renderApp('/crm/deals/d1?pipelineId=p1');
    await user.click(await screen.findByRole('tab', { name: 'Tasks' }));
    const items = await screen.findAllByRole('listitem', { name: /Open one|Call back/ });
    expect(items[0]).toHaveAccessibleName('Open one');
    await user.click(screen.getByRole('button', { name: 'Reopen Call back' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/tasks/t1/reopen`)).toBeDefined());
  });

  it('dueLabelReadsRelative', () => {
    const now = new Date('2026-10-24T10:00:00Z');
    expect(dueLabel('2026-10-24T12:00:00Z', now)).toBe('in 2 hours');
    expect(dueLabel('2026-10-21T10:00:00Z', now)).toBe('3 days overdue');
    expect(dueLabel(null, now)).toBe('No due date');
  });
});
