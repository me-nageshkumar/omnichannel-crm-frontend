import * as React from 'react';
import { Button, Flex, FlexItem, HelperText, HelperTextItem, Label } from '@patternfly/react-core';
import type { StepView } from '@app/api/automations';
import { outcomeColor, outcomeLabel } from '@app/Automations/automationDisplay';

export const RUN_HELP = 'This really happens to the test contact.';

/** A test's actions in order: the next one offers Run and Skip, done ones show how they ended. */
export const TestSteps: React.FunctionComponent<{
  steps: StepView[];
  nextAction: number | null;
  busy: boolean;
  onRun(i: number): void;
  onSkip(i: number): void;
}> = ({ steps, nextAction, busy, onRun, onSkip }) => (
  <ul aria-label="Test actions" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
    {steps.map((s, i) => (
      <li
        key={s.index}
        aria-label={`Action ${i + 1}`}
        style={{
          padding: 'var(--pf-t--global--spacer--sm) 0',
          borderBottom: 'var(--pf-t--global--border--width--regular) solid var(--pf-t--global--border--color--default)',
        }}
      >
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
          <FlexItem>{i + 1}.</FlexItem>
          <FlexItem>{s.summary}</FlexItem>
          {s.outcome && (
            <FlexItem>
              <Label color={outcomeColor(s.outcome)}>
                {s.reason ? `${outcomeLabel(s.outcome)} · ${s.reason}` : outcomeLabel(s.outcome)}
              </Label>
            </FlexItem>
          )}
          {i === nextAction && (
            <>
              <FlexItem>
                <Button variant="primary" size="sm" isDisabled={busy} onClick={() => onRun(i)}>
                  Run
                </Button>
              </FlexItem>
              <FlexItem>
                <Button variant="secondary" size="sm" isDisabled={busy} onClick={() => onSkip(i)}>
                  Skip
                </Button>
              </FlexItem>
            </>
          )}
        </Flex>
        {i === nextAction && (
          <HelperText>
            <HelperTextItem>{RUN_HELP}</HelperTextItem>
          </HelperText>
        )}
      </li>
    ))}
  </ul>
);
