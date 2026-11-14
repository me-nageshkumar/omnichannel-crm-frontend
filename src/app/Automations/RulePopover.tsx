import * as React from 'react';
import { Popover } from '@patternfly/react-core';
import type { AutomationOptions, RuleSummary } from '@app/api/automations';
import { describeRule } from '@app/Automations/automationModel';

/**
 * The rule in words, shown on hover or keyboard focus of its name in the rules list (rule-hover-summary spec).
 * Headings sit at depth 0; conditions and actions are indented by their depth.
 */
export const RulePopover: React.FunctionComponent<{
  rule: RuleSummary;
  options: AutomationOptions | null;
  children: React.ReactElement;
}> = ({ rule, options, children }) => {
  const lines = describeRule(rule, options);
  return (
    <Popover
      triggerAction="hover"
      aria-label={rule.name}
      headerContent={rule.name}
      maxWidth="32rem"
      bodyContent={
        <ul className="omni-rule-words">
          {lines.map((l, i) => (
            <li key={i} style={{ paddingInlineStart: `${l.depth * 1.25}rem` }}>
              {l.depth > 0 ? <span aria-hidden="true">• </span> : null}
              {l.text}
            </li>
          ))}
        </ul>
      }
    >
      {children}
    </Popover>
  );
};
