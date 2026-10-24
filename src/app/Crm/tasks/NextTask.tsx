import * as React from 'react';
import type { Task } from '@app/api/crm';
import { dueLabel, isOverdue } from '@app/Crm/tasks/taskDisplay';

/** A record's next open task: its title and when it is due, in red once overdue. */
export const NextTask: React.FunctionComponent<{ task: Task }> = ({ task }) => (
  <div>
    <div>{task.title}</div>
    <small
      style={{
        color: isOverdue(task)
          ? 'var(--pf-t--global--text--color--status--danger--default)'
          : 'var(--pf-t--global--text--color--subtle)',
      }}
    >
      {dueLabel(task.dueAt)}
    </small>
  </div>
);
