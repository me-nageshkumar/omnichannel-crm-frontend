import * as React from 'react';
import { Label } from '@patternfly/react-core';
import type { StepView } from '@app/api/automations';
import { outcomeColor, outcomeLabel } from '@app/Automations/automationDisplay';

/** One line per step of a run: what it did, how it ended and why. */
export const RunSteps: React.FunctionComponent<{ steps: StepView[] }> = ({ steps }) => (
  <ul className="pf-v6-u-font-size-sm">
    {steps.map((s) => (
      <li key={s.index}>
        {s.summary}{' '}
        {s.outcome && (
          <>
            ·{' '}
            <Label isCompact color={outcomeColor(s.outcome)}>
              {outcomeLabel(s.outcome)}
            </Label>
          </>
        )}
        {s.reason && <> · {s.reason}</>}
      </li>
    ))}
  </ul>
);
