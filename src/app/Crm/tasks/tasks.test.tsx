import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../../test/renderApp';
import { mockFetch, requestTo } from '../../../test/fetchMock';
import { sampleTask } from '../../../test/crm';
import { BASE, boardRoutes, queryOf } from '../../../test/crmBoard';
import { storeSession } from '../../../test/session';

const MINE = `GET ${BASE}/tasks/mine`;
const COUNTS = `GET ${BASE}/tasks/mine/counts`;
const DELEGATED = `GET ${BASE}/tasks/delegated`;

function routes(extra = {}, authorities = ['crm:view', 'crm:edit']) {
  return boardRoutes(
    {
      [MINE]: { status: 200, body: [sampleTask()] },
      [COUNTS]: { status: 200, body: { overdue: 2, today: 1, upcoming: 5, delegated: 2 } },
      [DELEGATED]: { status: 200, body: [] },
      ...extra,
    },
    { authorities },
  );
}

describe('CRM tasks page', () => {
  beforeEach(() => {
    localStorage.clear();
    storeSession();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('tasksPageSendsBrowserTimeZone', async () => {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: 'Asia/Kolkata' };
    });
    const f = mockFetch(routes());
    renderApp('/crm/tasks');
    expect(await screen.findByText('Call back')).toBeInTheDocument();
    expect(queryOf(f, `${BASE}/tasks/mine`).get('tz')).toBe('Asia/Kolkata');
    expect(queryOf(f, `${BASE}/tasks/mine`).get('bucket')).toBe('today');
    expect(queryOf(f, `${BASE}/tasks/mine/counts`).get('tz')).toBe('Asia/Kolkata');
  });

  it('bucketTabsShowCounts', async () => {
    const f = mockFetch(routes());
    const { user } = renderApp('/crm/tasks');
    expect(await screen.findByRole('tab', { name: 'Overdue (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Today (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Upcoming (5)' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Overdue (2)' }));
    await waitFor(() => expect(queryOf(f, `${BASE}/tasks/mine`).get('bucket')).toBe('overdue'));
  });

  it('completeFromListMovesItOut', async () => {
    const f = mockFetch(
      routes({ [`POST ${BASE}/tasks/t1/complete`]: { status: 200, body: sampleTask({ status: 'DONE' }) } }),
    );
    const { user } = renderApp('/crm/tasks');
    await user.click(await screen.findByRole('checkbox', { name: 'Complete Call back' }));
    await waitFor(() => expect(requestTo(f, `POST ${BASE}/tasks/t1/complete`)).toBeDefined());
    await waitFor(() => expect(screen.queryByText('Call back')).toBeNull());
    const link = screen.queryByRole('link', { name: 'Acme order' });
    expect(link).toBeNull();
  });

  it('targetLinksToTheRecord', async () => {
    mockFetch(routes());
    renderApp('/crm/tasks');
    const row = (await screen.findByText('Call back')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('link', { name: 'Acme order' })).toHaveAttribute('href', '/crm/deals/d1');
  });

  it('assigneePickerOnlyWithViewAll', async () => {
    mockFetch(routes());
    const { unmount } = renderApp('/crm/tasks');
    await screen.findByText('Call back');
    expect(screen.queryByLabelText('Assignee')).toBeNull();
    unmount();
    mockFetch(routes({}, ['crm:view', 'crm:edit', 'crm:view-all']));
    renderApp('/crm/tasks');
    expect(await screen.findByLabelText('Assignee')).toBeInTheDocument();
  });

  it('navShowsTasksWhenCrmOn', async () => {
    mockFetch(routes());
    renderApp('/crm/tasks');
    expect(await screen.findByRole('link', { name: 'Tasks', hidden: true })).toHaveAttribute('href', '/crm/tasks');
  });

  it('delegatedTabListsHandOffs', async () => {
    const handed = [
      sampleTask({
        id: 't5',
        title: 'For Priya',
        assignee: { id: 'u2', name: 'Priya Agent' },
        assignedBy: { id: 'u4', name: 'Meera Manager' },
      }),
      sampleTask({
        id: 't6',
        title: 'For Ravi',
        assignee: { id: 'u3', name: 'Ravi Agent' },
        assignedBy: { id: 'u4', name: 'Meera Manager' },
      }),
    ];
    let calls = 0;
    // the first call lists the open hand-offs; the one after "Show done" finds none done
    const f = mockFetch(routes({ [DELEGATED]: () => ({ status: 200, body: calls++ === 0 ? handed : [] }) }));
    const { user } = renderApp('/crm/tasks');
    await user.click(await screen.findByRole('tab', { name: 'Delegated (2)' }));
    expect(await screen.findByText('For Priya')).toBeInTheDocument();
    expect(queryOf(f, `${BASE}/tasks/delegated`).get('status')).toBe('OPEN');
    const row = screen.getByText('For Ravi').closest('tr') as HTMLElement;
    expect(within(row).getAllByText(/Ravi Agent/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('switch', { name: 'Show done' }));
    await waitFor(() => expect(queryOf(f, `${BASE}/tasks/delegated`).get('status')).toBe('DONE'));
    expect(await screen.findByText('None of the tasks you handed over are done yet.')).toBeInTheDocument();
  });

  it('delegatedIgnoresAssigneePicker', async () => {
    const f = mockFetch(
      routes(
        {
          [`GET /api/workspaces/w1/users`]: { status: 200, body: [{ id: 'u2', name: 'Priya Agent', active: true }] },
          [DELEGATED]: { status: 200, body: [sampleTask({ id: 't5', title: 'For Priya' })] },
        },
        ['crm:view', 'crm:edit', 'crm:view-all'],
      ),
    );
    const { user } = renderApp('/crm/tasks');
    await screen.findByText('Call back');
    await user.selectOptions(await screen.findByLabelText('Assignee'), 'u2');
    await waitFor(() => expect(queryOf(f, `${BASE}/tasks/mine`).get('assigneeId')).toBe('u2'));
    await user.click(screen.getByRole('tab', { name: 'Delegated (2)' }));
    expect(await screen.findByText('For Priya')).toBeInTheDocument();
    expect(screen.queryByLabelText('Assignee')).toBeNull();
    expect(queryOf(f, `${BASE}/tasks/delegated`).get('assigneeId')).toBeNull();
  });

  it('emptyCopyPerTab', async () => {
    mockFetch(routes({ [MINE]: { status: 200, body: [] } }));
    const { user } = renderApp('/crm/tasks');
    expect(await screen.findByText('Nothing due today.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Overdue (2)' }));
    expect(await screen.findByText('Nothing overdue.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Upcoming (5)' }));
    expect(await screen.findByText('Nothing coming up.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Delegated (2)' }));
    expect(await screen.findByText('You have no open tasks with other people.')).toBeInTheDocument();
  });
});
