import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import type { AutomationOptions, RuleSummary } from '@app/api/automations';
import { describeRule } from '@app/Automations/automationModel';

const NUMBERED = /^\d+\. /;

/** The lines, built only when the summary is shown, so a rule the describer cannot read never blanks the list. */
const RuleWords: React.FunctionComponent<{ rule: RuleSummary; options: AutomationOptions | null }> = ({
  rule,
  options,
}) => (
  <div className="omni-rule-words">
    <strong>{rule.name}</strong>
    <ul>
      {describeRule(rule, options).map((l, i) => (
        <li key={i} style={{ paddingInlineStart: `${l.depth * 1.25}rem` }}>
          {l.depth > 0 && !NUMBERED.test(l.text) ? <span aria-hidden="true">• </span> : null}
          {l.text}
        </li>
      ))}
    </ul>
  </div>
);

/**
 * The rule in words on hover or keyboard focus of its name in the rules list (rule-hover-summary spec): a tooltip, so
 * screen readers read it with the link (aria-describedby) and nothing pretends to be a modal dialog.
 */
export const RulePopover: React.FunctionComponent<{
  rule: RuleSummary;
  options: AutomationOptions | null;
  children: React.ReactElement;
}> = ({ rule, options, children }) => (
  <Tooltip
    content={<RuleWords rule={rule} options={options} />}
    isContentLeftAligned
    maxWidth="32rem"
    aria="describedby"
  >
    {children}
  </Tooltip>
);
