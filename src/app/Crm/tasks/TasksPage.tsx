import * as React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormSelect,
  FormSelectOption,
  Label,
  Spinner,
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
import { completeTask, myTaskCounts, myTasks } from '@app/api/crm';
import type { Ref, Task, TaskBucket } from '@app/api/crm';
import { listWorkspaceUsers } from '@app/api/workspaceUsers';
import { PageShell } from '@app/admin/PageShell';
import { useAction } from '@app/admin/useAction';
import { useLoad } from '@app/admin/useLoad';
import { useSession } from '@app/session/SessionContext';
import { useCrmCan } from '@app/Crm/status/CrmStatusContext';
import { useRefetchOnFocus } from '@app/Crm/common/useRefetchOnFocus';
import { crmMessage } from '@app/Crm/errors';
import { PRIORITY_LABELS, browserTimeZone, dueLabel, isOverdue, targetPath } from '@app/Crm/tasks/taskDisplay';

const BUCKETS: { key: TaskBucket; title: string }[] = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'today', title: 'Today' },
  { key: 'upcoming', title: 'Upcoming' },
];

/** My tasks by bucket (in the browser's time zone); view-all users may look at someone else's. */
export const TasksPage: React.FunctionComponent = () => {
  const { token, workspace, user } = useSession();
  const ws = workspace?.id ?? '';
  const viewAll = useCrmCan('crm:view-all');
  const canEdit = useCrmCan('crm:edit');
  const tz = React.useMemo(browserTimeZone, []);
  const [bucket, setBucket] = React.useState<TaskBucket>('today');
  const [assigneeId, setAssigneeId] = React.useState('');
  const who = viewAll && assigneeId ? assigneeId : undefined;
  const list = useLoad((t) => myTasks(t, ws, { bucket, tz, assigneeId: who }), [ws, bucket, tz, who ?? '']);
  const counts = useLoad((t) => myTaskCounts(t, ws, { tz, assigneeId: who }), [ws, tz, who ?? ''], {
    keepOnError: true,
  });
  // Brand users for the picker; a manager without user management still sees the people on the tasks.
  const users = useLoad(
    (t) => (viewAll ? listWorkspaceUsers(t, ws).catch(() => []) : Promise.resolve([])),
    [ws, viewAll],
  );
  const action = useAction();
  const reload = () => {
    list.reload();
    counts.reload();
  };
  useRefetchOnFocus(reload);

  const people: Ref[] = [];
  const add = (r: Ref | null | undefined) =>
    r && r.id !== user?.id && !people.some((p) => p.id === r.id) && people.push(r);
  (users.data ?? []).forEach((u) => add({ id: u.id, name: u.name }));
  (list.data ?? []).forEach((t) => add(t.assignee));
  people.sort((a, b) => a.name.localeCompare(b.name));

  const complete = async (task: Task) => {
    const done = await action.run(
      () => completeTask(token as string, ws, task.id),
      (e) => crmMessage(e, 'Could not complete the task. Try again.'),
    );
    if (done) {
      list.setData((items) => items?.filter((x) => x.id !== task.id));
      counts.reload();
    }
  };

  const tasks = list.data ?? [];
  let body: React.ReactNode;
  if (list.error) body = <Alert variant="danger" isInline title={list.error} />;
  else if (!list.data) body = <Spinner aria-label="Loading tasks" />;
  else if (tasks.length === 0) body = <p className="pf-v6-u-color-200 pf-v6-u-my-md">Nothing here.</p>;
  else
    body = (
      <Table aria-label="My tasks" variant="compact">
        <Thead>
          <Tr>
            <Th screenReaderText="Done" />
            <Th>Task</Th>
            <Th>Record</Th>
            <Th>Due</Th>
            <Th>Priority</Th>
            {who && <Th>Assignee</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {tasks.map((t) => (
            <Tr key={t.id}>
              <Td>
                <Checkbox
                  id={`crm-mine-done-${t.id}`}
                  aria-label={`Complete ${t.title}`}
                  isChecked={false}
                  isDisabled={!canEdit || action.busy}
                  onChange={() => void complete(t)}
                />
              </Td>
              <Td dataLabel="Task">{t.title}</Td>
              <Td dataLabel="Record">
                <Link to={targetPath(t.target)}>{t.target.name || 'Open record'}</Link>
              </Td>
              <Td dataLabel="Due">
                <span
                  style={
                    isOverdue(t) ? { color: 'var(--pf-t--global--text--color--status--danger--default)' } : undefined
                  }
                >
                  {dueLabel(t.dueAt)}
                </span>
              </Td>
              <Td dataLabel="Priority">
                <Label isCompact color={t.priority === 'HIGH' ? 'red' : t.priority === 'LOW' ? 'grey' : 'blue'}>
                  {PRIORITY_LABELS[t.priority]}
                </Label>
              </Td>
              {who && <Td dataLabel="Assignee">{t.assignee?.name ?? '—'}</Td>}
            </Tr>
          ))}
        </Tbody>
      </Table>
    );

  const count = (b: TaskBucket) => (counts.data ? ` (${counts.data[b]})` : '');
  return (
    <PageShell title="Tasks">
      <Toolbar>
        <ToolbarContent>
          {viewAll && (
            <ToolbarItem>
              <FormSelect aria-label="Assignee" value={assigneeId} onChange={(_e, v) => setAssigneeId(v)}>
                <FormSelectOption value="" label="Me" />
                {people.map((p) => (
                  <FormSelectOption key={p.id} value={p.id} label={p.name} />
                ))}
              </FormSelect>
            </ToolbarItem>
          )}
          <ToolbarItem>
            <Button variant="plain" aria-label="Refresh" icon={<SyncAltIcon />} onClick={reload} />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {action.error && <Alert variant="danger" isInline title={action.error} className="pf-v6-u-mb-md" />}
      <Tabs activeKey={bucket} onSelect={(_e, k) => setBucket(k as TaskBucket)} aria-label="Task buckets">
        {BUCKETS.map((b) => (
          <Tab key={b.key} eventKey={b.key} title={<TabTitleText>{`${b.title}${count(b.key)}`}</TabTitleText>} />
        ))}
      </Tabs>
      {body}
    </PageShell>
  );
};
