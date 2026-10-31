import * as React from 'react';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  FormSelect,
  FormSelectOption,
  Spinner,
  Switch,
  Tab,
  TabTitleText,
  Tabs,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { SyncAltIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import { delegatedTasks, myTaskCounts, myTasks } from '@app/api/crm';
import { personName } from '@app/Crm/personName';
import type { Ref, Task, TaskBucket, TaskCounts } from '@app/api/crm';
import { listWorkspaceUsers } from '@app/api/workspaceUsers';
import { PageShell } from '@app/admin/PageShell';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useCrmCan } from '@app/Crm/status/CrmStatusContext';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { TaskRow } from '@app/Crm/tasks/TaskRow';
import { browserTimeZone, targetPath } from '@app/Crm/tasks/taskDisplay';
import { useTaskActions } from '@app/Crm/tasks/useTaskActions';

type Tab = TaskBucket | 'delegated';

const TABS: { key: Tab; title: string; count: keyof TaskCounts }[] = [
  { key: 'overdue', title: 'Overdue', count: 'overdue' },
  { key: 'today', title: 'Today', count: 'today' },
  { key: 'upcoming', title: 'Upcoming', count: 'upcoming' },
  { key: 'delegated', title: 'Delegated', count: 'delegated' },
];

const EMPTY: Record<TaskBucket, string> = {
  overdue: 'Nothing overdue.',
  today: 'Nothing due today.',
  upcoming: 'Nothing coming up.',
};

/**
 * My tasks by bucket (in the browser's time zone), plus the tasks I handed to others (spec E C16); view-all users may
 * look at someone else's buckets. The Delegated list is always the caller's own.
 */
export const TasksPage: React.FunctionComponent = () => {
  const { workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const viewAll = useCrmCan('crm:view-all');
  const canEdit = useCrmCan('crm:edit');
  const tz = React.useMemo(browserTimeZone, []);
  const [tab, setTab] = React.useState<Tab>('today');
  const [showDone, setShowDone] = React.useState(false);
  const [assigneeId, setAssigneeId] = React.useState('');
  const delegated = tab === 'delegated';
  const who = viewAll && assigneeId ? assigneeId : undefined;
  const list = useLoad(
    (t) =>
      delegated
        ? delegatedTasks(t, ws, { status: showDone ? 'DONE' : 'OPEN', limit: 100 })
        : myTasks(t, ws, { bucket: tab, tz, assigneeId: who }),
    [ws, tab, tz, who ?? '', delegated && showDone],
  );
  const counts = useLoad((t) => myTaskCounts(t, ws, { tz, assigneeId: who }), [ws, tz, who ?? ''], {
    keepOnError: true,
  });
  // Brand users for the picker; a manager without user management still sees the people on the tasks.
  const users = useLoad(
    (t) => (viewAll ? listWorkspaceUsers(t, ws).catch(() => []) : Promise.resolve([])),
    [ws, viewAll],
  );
  const reload = () => {
    list.reload();
    counts.reload();
  };
  useRefetchOnFocus(reload);
  const actions = useTaskActions(
    (saved) => {
      const keep = delegated ? (showDone ? saved.status === 'DONE' : saved.status === 'OPEN') : saved.status === 'OPEN';
      list.setData(
        (items) =>
          items && (keep ? items.map((x) => (x.id === saved.id ? saved : x)) : items.filter((x) => x.id !== saved.id)),
      );
      counts.reload();
    },
    undefined,
    list.reload,
  );

  const people: Ref[] = [];
  const add = (r: Ref | null | undefined) =>
    r && r.id !== user?.id && !people.some((p) => p.id === r.id) && people.push(r);
  (users.data ?? []).forEach((u) => add({ id: u.id, name: u.name }));
  (list.data ?? []).forEach((t) => add(t.assignee));
  people.sort((a, b) => personName(a).localeCompare(personName(b)));

  const tasks = list.data ?? [];
  const showAssignee = !!who || delegated;
  let body: React.ReactNode;
  if (list.error) body = <Alert variant="danger" isInline title={list.error} />;
  else if (!list.data) body = <Spinner aria-label="Loading tasks" />;
  else if (tasks.length === 0)
    body = (
      <p className="pf-v6-u-color-200 pf-v6-u-my-md">
        {delegated
          ? showDone
            ? 'None of the tasks you handed over are done yet.'
            : 'You have no open tasks with other people.'
          : EMPTY[tab]}
      </p>
    );
  else
    body = (
      <Table aria-label="My tasks" variant="compact">
        <Thead>
          <Tr>
            <Th>Task</Th>
            <Th>Record</Th>
            {showAssignee && <Th>Assignee</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {tasks.map((t: Task) => (
            <Tr key={t.id}>
              <Td dataLabel="Task">
                <TaskRow
                  task={t}
                  canEdit={canEdit}
                  userId={user?.id}
                  busy={actions.busyId === t.id}
                  onToggle={(task) => void actions.toggle(task)}
                  onTick={(task, itemId, done) => void actions.tick(task, itemId, done)}
                  onSkip={actions.skip}
                />
              </Td>
              <Td dataLabel="Record">
                <Link to={targetPath(t.target)}>{t.target.name || 'Open record'}</Link>
              </Td>
              {showAssignee && <Td dataLabel="Assignee">{personName(t.assignee) || '—'}</Td>}
            </Tr>
          ))}
        </Tbody>
      </Table>
    );

  const count = (k: keyof TaskCounts) => (counts.data ? ` (${counts.data[k]})` : '');
  return (
    <PageShell title="Tasks">
      <Toolbar>
        <ToolbarContent>
          {viewAll && !delegated && (
            <ToolbarItem>
              <FormSelect aria-label="Assignee" value={assigneeId} onChange={(_e, v) => setAssigneeId(v)}>
                <FormSelectOption value="" label="Me" />
                {people.map((p) => (
                  <FormSelectOption key={p.id} value={p.id} label={personName(p)} />
                ))}
              </FormSelect>
            </ToolbarItem>
          )}
          {delegated && (
            <ToolbarItem>
              <Switch
                id="crm-delegated-done"
                aria-label="Show done"
                label="Show done"
                isChecked={showDone}
                onChange={(_e, v) => setShowDone(v)}
              />
            </ToolbarItem>
          )}
          <ToolbarItem>
            <Button variant="plain" aria-label="Refresh" icon={<SyncAltIcon />} onClick={reload} />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {actions.error && <Alert variant="danger" isInline title={actions.error} className="pf-v6-u-mb-md" />}
      {actions.notice && (
        <Alert
          variant="info"
          isInline
          title={actions.notice}
          className="pf-v6-u-mb-md"
          actionClose={<AlertActionCloseButton onClose={actions.clearNotice} />}
        />
      )}
      <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as Tab)} aria-label="Task buckets">
        {TABS.map((b) => (
          <Tab key={b.key} eventKey={b.key} title={<TabTitleText>{`${b.title}${count(b.count)}`}</TabTitleText>} />
        ))}
      </Tabs>
      {body}
      {actions.dialogs}
    </PageShell>
  );
};
