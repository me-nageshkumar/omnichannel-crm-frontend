import * as React from 'react';
import { Button, Popover } from '@patternfly/react-core';
import { ExclamationCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import type { Problem } from '@app/api/chatbots';

/** "n problems" with the list; a click on one selects its node (spec §8.1). */
export const ProblemsPopover: React.FunctionComponent<{ problems: Problem[]; onPick(nodeId: string | null): void }> = ({
  problems,
  onPick,
}) => {
  if (problems.length === 0) return null;
  const errors = problems.filter((p) => p.severity === 'ERROR').length;
  const label = `${problems.length} problem${problems.length === 1 ? '' : 's'}`;
  return (
    <Popover
      aria-label="Problems"
      headerContent="Problems"
      bodyContent={
        <ul className="omni-problems">
          {problems.map((p, i) => (
            <li key={i}>
              <Button variant="link" isInline onClick={() => onPick(p.nodeId)}>
                {p.severity === 'ERROR' ? (
                  <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />
                ) : (
                  <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--status--warning--default)" />
                )}{' '}
                {p.nodeName ? `${p.nodeName}: ` : 'Flow: '}
                {p.message}
              </Button>
            </li>
          ))}
        </ul>
      }
    >
      <Button variant={errors > 0 ? 'danger' : 'warning'} size="sm">
        {label}
      </Button>
    </Popover>
  );
};
